import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { getTransactionParserPrompt } from './prompts/transaction-parser.prompt';
import { PrismaService } from './prisma/prisma.service';

@Injectable()
export class TransactionService {
  private openai: OpenAI;
  private genAI: GoogleGenerativeAI;

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    this.openai = new OpenAI({
      baseURL: 'https://openrouter.ai/api/v1',
      apiKey: this.configService.get<string>('OPENAI_API_KEY'),
    });
    this.genAI = new GoogleGenerativeAI(
      this.configService.get<string>('GOOGLE_API_KEY') || '',
    );
  }

  async processText(
    input: string,
    type: 'auto' | 'openrouter' | 'gemma3' | 'manual',
    userId?: string,
  ): Promise<any> {
    try {
      let result;
      if (type === 'openrouter') {
        result = await this.processTextWithOpenRouter(input);
      } else if (type === 'gemma3') {
        result = await this.processTextWithGemma3(input, 'gemma-3-27b-it');
      } else if (type === 'manual') {
        result = await this.processTextWithManual(input);
      } else {
        result = await this.processTextAuto(input);
        type = result.model;
        delete result.model;
      }

      await this.recordLLMUsage(userId, type, result.success);
      return result;
    } catch (error) {
      await this.recordLLMUsage(userId, type, false);
      return {
        success: false,
        transactions: [],
      };
    }
  }

  async processTextAuto(input: string): Promise<any> {
    let data = await this.processTextWithGemma3(input, 'gemma-3-27b-it');
    if (data.type != 'system') {
      data.model = 'gemma-3-27b-it';
      return data;
    }

    data = await this.processTextWithGemma3(input, 'gemma-3-12b-it');
    if (data.type != 'system') {
      data.model = 'gemma-3-12b-it';
      return data;
    }

    data = await this.processTextWithOpenRouter(input);
    data.model = 'openrouter';
    return data;
  }

  async processTextWithOpenRouter(input: string): Promise<any> {
    try {
      console.log(new Date(), 'Processing text with OpenRouter');
      const completion = await this.openai.chat.completions.create({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: getTransactionParserPrompt(),
          },
          {
            role: 'user',
            content: input,
          },
        ],
        temperature: 1,
        response_format: { type: 'json_object' },
      });

      const response = completion.choices[0]?.message?.content?.trim() || '{}';

      return JSON.parse(response || '{}');
    } catch (error) {
      return {
        success: false,
        type: 'system',
        transactions: [],
      };
    }
  }

  async processTextWithGemma3(input: string, modelName: string): Promise<any> {
    console.log(new Date(), 'Processing text with Gemma3 model: ', modelName);

    try {
      const model = this.genAI.getGenerativeModel({
        model: modelName,
      });

      const systemPrompt = getTransactionParserPrompt();

      const result = await model.generateContent([
        { text: systemPrompt },
        { text: `User input: ${input}` },
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

  async processTextWithManual(input: string): Promise<any> {
    try {
      const json = await fetch('http://localhost:8000/api/parse', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: input,
        }),
      });
      const data = await json.json();
      if (data.success) {
        return data;
      } else {
        return {
          success: false,
          transactions: [],
        };
      }
    } catch (error) {
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
  ): Promise<void> {
    try {
      await this.prisma.lLMUsage.create({
        data: {
          userId,
          modelName,
          success,
        },
      });
    } catch (error) {
      console.error('Error recording LLM usage:', error);
    }
  }
}
