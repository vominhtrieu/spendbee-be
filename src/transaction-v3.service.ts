import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  getTransactionParserPromptV2,
  getTransactionParserPromptForImage,
} from './prompts/transaction-parser.prompt';
import { PrismaService } from './prisma/prisma.service';
import Groq from 'groq-sdk';

interface MulterFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
  destination?: string;
  filename?: string;
  path?: string;
}

const ELEVENLABS_STT_URL = 'https://api.elevenlabs.io/v1/speech-to-text';

@Injectable()
export class TransactionServiceV3 {
  private groq: Groq;
  private elevenLabsApiKeys: string[];
  /** Index of the current ElevenLabs API key. On rotatable error, advance by 1 and wrap to 0 when past end. */
  private elevenLabsCurrentKeyIndex = 0;

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    this.groq = new Groq({
      apiKey: this.configService.get<string>('GROQ_API_KEY') || '',
    });
    const keysRaw = this.configService.get<string>('ELEVENLABS_API_KEYS') || '';
    this.elevenLabsApiKeys = keysRaw
      .split(',')
      .map((k) => k.trim())
      .filter(Boolean);
  }

  /**
   * Transcribe audio using ElevenLabs Speech-to-Text.
   * Uses the stored key index; if the key works, keep it. On 401/429/5xx, advance index by 1
   * (wrapping to 0 when past the end) for the next call.
   */
  private async transcribeWithElevenLabs(file: MulterFile): Promise<string> {
    if (this.elevenLabsApiKeys.length === 0) {
      throw new Error('ELEVENLABS_API_KEYS is not configured (comma-separated)');
    }

    const keyIndex = this.elevenLabsCurrentKeyIndex;
    const formData = new FormData();
    formData.append('model_id', 'scribe_v2');
    formData.append(
      'file',
      new Blob([new Uint8Array(file.buffer)], {
        type: file.mimetype || 'audio/mpeg',
      }),
      file.originalname || 'audio',
    );

    const res = await fetch(ELEVENLABS_STT_URL, {
      method: 'POST',
      headers: { 'xi-api-key': this.elevenLabsApiKeys[keyIndex] },
      body: formData,
    });

    if (res.ok) {
      const data = (await res.json()) as { text?: string };
      return data.text?.replaceAll("?", ".") ?? '';
    }

    const status = res.status;
    const body = await res.text();
    const isRotatable =
      status === 401 || status === 429 || (status >= 500 && status < 600);
    const err = new Error(`ElevenLabs STT failed: ${status} ${body}`);

    if (isRotatable) {
      this.elevenLabsCurrentKeyIndex =
        (this.elevenLabsCurrentKeyIndex + 1) % this.elevenLabsApiKeys.length;
      console.warn(
        `[TransactionServiceV3] ElevenLabs key rotated: ${keyIndex} -> ${this.elevenLabsCurrentKeyIndex} (status ${status})`,
      );
    }
    throw err;
  }

  async processAudio(
    file: MulterFile,
    userId?: string,
    incomeCategories?: string[],
    expenseCategories?: string[],
  ): Promise<any> {
    const startTime = Date.now();
    try {
      const transcribedText = await this.transcribeWithElevenLabs(file);

      const result = await this.processTextWithGroq(
        transcribedText,
        'openai/gpt-oss-20b',
        incomeCategories,
        expenseCategories,
      );
      const duration = Date.now() - startTime;
      await this.recordLLMUsage(userId, 'openai/gpt-oss-20b', result.success, duration);
      result.transcribedText = transcribedText;
      return result;
    } catch (error) {
      console.error('Error in processAudio:', error);
      const duration = Date.now() - startTime;
      await this.recordLLMUsage(userId, 'openai/gpt-oss-20b', false, duration);
      return {
        success: false,
        type: 'system',
        transactions: [],
      };
    }
  }

  private static readonly ALLOWED_IMAGE_MIMES = [
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
  ];

  private static readonly GROQ_IMAGE_MODEL =
    'meta-llama/llama-4-scout-17b-16e-instruct';

  async processImage(
    file: MulterFile,
    userId?: string,
    incomeCategories?: string[],
    expenseCategories?: string[],
  ): Promise<any> {
    const startTime = Date.now();
    try {
      const mime = (file.mimetype || '').toLowerCase();
      if (!TransactionServiceV3.ALLOWED_IMAGE_MIMES.includes(mime)) {
        throw new Error(
          `Unsupported image type: ${file.mimetype}. Allowed: ${TransactionServiceV3.ALLOWED_IMAGE_MIMES.join(', ')}`,
        );
      }

      const prompt = getTransactionParserPromptForImage(
        undefined,
        incomeCategories,
        expenseCategories,
      );

      const base64Image = file.buffer.toString('base64');

      const completion = await this.groq.chat.completions.create({
        model: TransactionServiceV3.GROQ_IMAGE_MODEL,
        messages: [
          {
            role: 'system',
            content: prompt,
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Analyze the following image and extract transaction(s).',
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:${mime};base64,${base64Image}`,
                },
              },
            ],
          },
        ],
        temperature: 1,
        response_format: { type: 'json_object' },
      });

      const responseText =
        completion.choices[0]?.message?.content?.trim() || '{}';
      const parsed = JSON.parse(responseText || '{}');
      const duration = Date.now() - startTime;
      await this.recordLLMUsage(
        userId,
        TransactionServiceV3.GROQ_IMAGE_MODEL,
        parsed.success === true,
        duration,
      );
      return parsed;
    } catch (error) {
      console.error('Error in processImage:', error);
      const duration = Date.now() - startTime;
      await this.recordLLMUsage(
        userId,
        TransactionServiceV3.GROQ_IMAGE_MODEL,
        false,
        duration,
      );
      return {
        success: false,
        type: 'system',
        transactions: [],
      };
    }
  }

  async processTextWithGroq(
    transcribedText: string, // base64 encoded audio
    modelName: string,
    incomeCategories?: string[],
    expenseCategories?: string[],
  ): Promise<any> {
    try {
      const completion = await this.groq.chat.completions.create({
        model: 'qwen/qwen3-32b',
        messages: [
          {
            role: 'system',
            content: getTransactionParserPromptV2(
              undefined,
              incomeCategories,
              expenseCategories,
            ),
          },
          {
            role: 'user',
            content: transcribedText,
          },
        ],
        temperature: 1,
        response_format: { type: 'json_object' },
      });

      const response = completion.choices[0]?.message?.content?.trim() || '{}';
      return JSON.parse(response || '{}');
    } catch (error) {
      console.error('Error in processTextWithGemma3:', error);
      return {
        success: false,
        type: 'system',
        transactions: [],
      };
    }
  }

  private async recordLLMUsage(
    userId: string | undefined,
    modelName: string,
    success: boolean,
    duration?: number,
  ): Promise<void> {
    try {
      await this.prisma.lLMUsage.create({
        data: {
          userId,
          modelName,
          success,
          duration,
        },
      });
    } catch (error) {
      console.error('Error recording LLM usage:', error);
    }
  }
}



