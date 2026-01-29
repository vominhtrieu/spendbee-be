import { Controller, Get, Post, Body, Headers, UseInterceptors, UploadedFile, Req } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AppService } from './app.service';
import { TransactionService } from './transaction.service';
import { TransactionServiceV2 } from './transaction-v2.service';
import { ProcessTextDto, ProcessTextV2Dto, ProcessAudioDto } from './sentiment.dto';
import { BadRequestException } from '@nestjs/common';
import { TransactionServiceV3 } from './transaction-v3.service';
import type { Request } from 'express';

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

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly transactionService: TransactionService,
    private readonly transactionServiceV2: TransactionServiceV2,
    private readonly transactionServiceV3: TransactionServiceV3,
  ) { }

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Post('ping')
  async ping(
    @Body() body: Record<string, any>,
    @Headers() headers: Record<string, string>,
    @Req() req: Request,
  ) {
    console.log(new Date(), 'Request Headers: ', headers);
    console.log(new Date(), 'Request Body: ', body);

    const installationId = body.installationId;
    const appVersion = body.appVersion;

    const ipFromHeaders =
      (headers['x-forwarded-for'] as string | undefined) ||
      (headers['cf-connecting-ip'] as string | undefined) ||
      (headers['x-real-ip'] as string | undefined);

    const ipAddress =
      (ipFromHeaders ? ipFromHeaders.split(',')[0].trim() : undefined) ||
      req.ip ||
      (req.socket && req.socket.remoteAddress) ||
      undefined;

    const userAgent = (headers['user-agent'] as string | undefined) || '';
    const deviceType = this.getDeviceTypeFromUserAgent(userAgent);

    if (installationId) {
      const user = await this.appService.upsertUser(
        installationId,
        appVersion,
        deviceType,
      );

      // Only fetch and update location if country is not already set
      if (!user.city || !user.country) {
        const { city, country } = await this.appService.getLocationFromIp(ipAddress);
        if (city && country) {
          await this.appService.updateUserLocation(user.id, city, country);
        }
      }

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

  @Post('v3/process-audio')
  @UseInterceptors(FileInterceptor('audio'))
  async processAudio(
    @UploadedFile() file: MulterFile,
    @Body() dto: ProcessAudioDto,
    @Headers() headers: Record<string, string>,
  ) {
    if (!file) {
      throw new BadRequestException('Audio file is required');
    }

    const result = await this.transactionServiceV3.processAudio(
      file,
      dto.installationId,
      dto.incomeCategories,
      dto.expenseCategories,
    );
    return result;
  }

  private getDeviceTypeFromUserAgent(userAgent: string): string {
    const ua = userAgent.toLowerCase();

    if (!ua) {
      // Client is always a mobile app; if we can't detect, default to iOS
      return 'ios';
    }

    const isAndroid = ua.includes('android') || ua.includes('okhttp');

    if (isAndroid) {
      return 'android';
    }

    // If it's not clearly Android, treat it as iOS
    return 'ios';
  }
}
