import { Controller, Get, Post, Body } from '@nestjs/common';
import { AppService } from './app.service';
import { TransactionService } from './transaction.service';
import { ProcessTextDto } from './sentiment.dto';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly transactionService: TransactionService,
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Post('process-text')
  async processText(@Body() dto: ProcessTextDto) {
    return await this.transactionService.processText(dto.input, dto.type || 'auto');
  }
}
