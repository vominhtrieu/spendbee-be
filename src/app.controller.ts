import { Controller, Get, Post, Body, Headers } from '@nestjs/common';
import { AppService } from './app.service';
import { TransactionService } from './transaction.service';
import { TransactionServiceV2 } from './transaction-v2.service';
import { ProcessTextDto, ProcessTextV2Dto } from './sentiment.dto';
import { BadRequestException } from '@nestjs/common';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly transactionService: TransactionService,
    private readonly transactionServiceV2: TransactionServiceV2,
  ) { }

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Post('ping')
  async ping(@Body() body: Record<string, any>, @Headers() headers: Record<string, string>) {
    console.log(new Date(), 'Request Headers: ', headers);
    console.log(new Date(), 'Request Body: ', body);

    const installationId = body.installationId;
    const appVersion = body.appVersion;
    if (installationId) {
      const user = await this.appService.upsertUser(installationId, appVersion);
      await this.appService.recordInteraction(user.id, 'ping');
    }

    return { message: 'pong' };
  }

  @Post('process-text')
  async processText(@Body() dto: ProcessTextDto, @Headers() headers: Record<string, string>) {
    const user = dto.installationId
      ? await this.appService.upsertUser(dto.installationId)
      : null;
    
    if (user) {
      await this.appService.recordInteraction(user.id, 'llm_usage');
    }
    
    const result = await this.transactionService.processText(
      dto.input,
      dto.type || 'auto',
      user?.id,
    );
    return result;
  }

  @Post('v2/process-text')
  async processTextV2(
    @Body() dto: ProcessTextV2Dto,
    @Headers() headers: Record<string, string>,
  ) {
    const { incomeCategories, expenseCategories } = dto;

    const validateCategoriesArray = (arr: unknown, label: string) => {
      if (arr === undefined || arr === null) return;

      if (!Array.isArray(arr)) {
        throw new BadRequestException(
          `${label} must be an array of strings`,
        );
      }

      for (const cat of arr) {
        if (typeof cat !== 'string') {
          throw new BadRequestException(
            `each category in ${label} must be a string`,
          );
        }
        const trimmed = cat.trim();
        if (trimmed.length === 0) {
          throw new BadRequestException(
            `${label} must not contain empty category names`,
          );
        }
        if (trimmed.length >= 30) {
          throw new BadRequestException(
            'each category name must be less than 30 characters',
          );
        }
      }
    };

    validateCategoriesArray(incomeCategories, 'incomeCategories');
    validateCategoriesArray(expenseCategories, 'expenseCategories');

    const totalCategories =
      (incomeCategories?.length || 0) + (expenseCategories?.length || 0);
    if (totalCategories > 20) {
      throw new BadRequestException(
        'combined incomeCategories and expenseCategories must contain no more than 20 items',
      );
    }

    const user = dto.installationId
      ? await this.appService.upsertUser(dto.installationId)
      : null;

    if (user) {
      await this.appService.recordInteraction(user.id, 'llm_usage');
    }

    const result = await this.transactionServiceV2.processText(
      dto.input,
      dto.type || 'auto',
      user?.id,
      incomeCategories,
      expenseCategories,
    );

    return result;
  }
}
