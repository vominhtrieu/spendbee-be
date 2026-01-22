import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { getTransactionParserPromptV2 } from './prompts/transaction-parser.prompt';
import { PrismaService } from './prisma/prisma.service';
import Groq, { toFile } from "groq-sdk";

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

@Injectable()
export class TransactionServiceV3 {
  private genAI: GoogleGenerativeAI;
  private groq: Groq;
  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    this.genAI = new GoogleGenerativeAI(
      this.configService.get<string>('GOOGLE_API_KEY') || '',
    );
    this.groq = new Groq({
      apiKey: this.configService.get<string>('GROQ_API_KEY') || '',
    });
  }

  async processAudio(
    file: MulterFile,
    userId?: string,
    incomeCategories?: string[],
    expenseCategories?: string[],
  ): Promise<any> {
    const startTime = Date.now();
    try {
      // Get file extension from original filename or use mime type
      const filename = file.originalname || 'audio';
      const extension = filename.split('.').pop() || 'mp3';
      const mimeType = file.mimetype || `audio/${extension}`;

      // Convert Buffer to File using toFile utility from Groq SDK
      const groqFile = await toFile(file.buffer, filename, { type: mimeType });

      // Create transcription using Groq API
      const transcription = await this.groq.audio.transcriptions.create({
        file: groqFile,
        model: 'whisper-large-v3-turbo',
        response_format: 'json',
        temperature: 0.1,
      });

      // Extract transcribed text from response
      const transcribedText = transcription.text;

      const result = await this.processTextWithGemma3(
        transcribedText,
        'gemma-3-27b-it',
        incomeCategories,
        expenseCategories,
      );
      const duration = Date.now() - startTime;
      await this.recordLLMUsage(userId, 'gemma3', result.success, duration);
      return result;
    } catch (error) {
      console.error('Error in processAudio:', error);
      const duration = Date.now() - startTime;
      await this.recordLLMUsage(userId, 'gemma3', false, duration);
      return {
        success: false,
        type: 'system',
        transactions: [],
      };
    }
  }

  async processTextWithGemma3(
    transcribedText: string, // base64 encoded audio
    modelName: string,
    incomeCategories?: string[],
    expenseCategories?: string[],
  ): Promise<any> {
    try {
      const systemPrompt = getTransactionParserPromptV2(
        undefined,
        incomeCategories,
        expenseCategories,
      );
      const model = this.genAI.getGenerativeModel({
        model: modelName,
      });

      const result = await model.generateContent([
        { text: systemPrompt },
        {
          text: transcribedText,
        }
      ]);

      const response = result.response;
      const text = response.text();

      // Extract JSON from markdown code blocks if present
      let jsonText = text.trim();
      if (jsonText.startsWith('```json')) {
        jsonText = jsonText
          .replace(/```json\n?/g, '')
          .replace(/```$/g, '')
          .trim();
      } else if (jsonText.startsWith('```')) {
        jsonText = jsonText
          .replace(/```\n?/g, '')
          .replace(/```$/g, '')
          .trim();
      }

      return JSON.parse(jsonText);
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



