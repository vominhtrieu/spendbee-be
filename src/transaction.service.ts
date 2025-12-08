import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

@Injectable()
export class TransactionService {
  private openai: OpenAI;

  constructor(private configService: ConfigService) {
    this.openai = new OpenAI({
      baseURL: 'https://openrouter.ai/api/v1',
      apiKey: this.configService.get<string>('OPENAI_API_KEY'),
    });
  }

  async processText(
    input: string,
    type: 'auto' | 'gemini' | 'manual',
  ): Promise<any> {
    try {
      if (type === 'gemini') {
        return await this.processTextWithGemini(input);
      } else if (type === 'manual') {
        return await this.processTextWithManual(input);
      } else {
        return await this.processTextAuto(input);
      }
    } catch (error) {
      return {
        success: false,
        transactions: [],
      };
    }
  }

  async processTextAuto(input: string): Promise<any> {
    let data = await this.processTextWithGemini(input);
    if (data.success) {
      return data;
    } else {
      return await this.processTextWithManual(input);
    }
  }

  async processTextWithGemini(input: string): Promise<any> {
    try {
      const completion = await this.openai.chat.completions.create({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: `
You are a helpful assistant that can analyze the text to help the user with their spending. User will provide a text and you will need to respond with a JSON object with this format:
{
  "success": true | false,
  "transactions": [
    {
      "name": "Transaction name",
      "type": "income" | "expense",
      "category": "Food",
      "date": "2025-01-01",
      "amount": 100,
    }
  ]
}

Fields:
- success: Whether the transaction was successfully parsed. If not, you should set it to false and leave the transactions array empty.
- name: The name of the transaction, depending on the user's input language, the name should be in the same language. But other field should be in English. Try use correct capitalization for this field despecially for the brand name, product name, etc. For example: "iphone 15 pro max" should be "iPhone 15 Pro Max", "a gucci bag" should be "A Gucci bag". In unsual case, uppercase the first letter of the name if it's not a proper noun.
- type: The type of the transaction, either "income" or "expense"
- category: The category of the transaction. This is a list of categories that the user can choose from. If the user doesn't provide a category, you must find the category that best fits the transaction.
If they provide a category, but it's not in the list, you should use "Other".
For type "income", the category list is: ['Salary', 'Freelance', 'Investment', 'Business', 'Gift', 'Bonus', 'Rental', 'Other']
For type "expense", the category should be['Food', 'Entertainment', 'Transportation', 'Shopping', 'Bills', 'Healthcare', 'Education', 'Other'].
Keep the capitalization of the category as is, if the user provides a category but incorrect capitalization, you should correct it.
- date: The date of the transaction, if the user doesn't provide a date, you should use the current date, which is ${new Date().toISOString().split('T')[0]}.
- amount: The amount of the transaction. Only the number, no currency symbol or other text. But you must convert the amount to number if it is not a number or have these character "K", "M",... to the number.
For example, if the amount is "1K", you should convert it to 1000. Or 1k5 should be 1500.

Note: the text from user is transcribed from a voice recording, so it may contain errors. You should try to understand the user's intent and correct the errors.
If user does not provide a field, leave it null.
`,
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
        transactions: [],
      };
    }
  }
}
