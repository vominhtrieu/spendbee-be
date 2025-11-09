import { Controller, Get, Post, Body } from '@nestjs/common';
import { AppService } from './app.service';
import { SentimentService } from './sentiment.service';
import { ProcessTextDto } from './sentiment.dto';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly sentimentService: SentimentService,
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Post('process-text')
  async processText(@Body() dto: ProcessTextDto) {
    return await this.sentimentService.processText(dto.input);
  }
}
