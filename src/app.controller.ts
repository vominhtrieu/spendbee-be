import { Controller, Get, Post, Body, Headers } from '@nestjs/common';
import { AppService } from './app.service';
import { TransactionService } from './transaction.service';
import { ProcessTextDto } from './sentiment.dto';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly transactionService: TransactionService,
  ) { }

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Post('ping')
  async ping(@Body() body: Record<string, any>, @Headers() headers: Record<string, string>) {
    console.log(new Date(), 'Request Headers: ', headers);
    console.log(new Date(), 'Request Body: ', body);
    return { message: 'pong' };
  }

  @Post('process-text')
  async processText(@Body() dto: ProcessTextDto, @Headers() headers: Record<string, string>) {
    console.log(new Date(), 'Request Headers: ', headers);
    const result = await this.transactionService.processText(dto.input, dto.type || 'auto');
    console.log(new Date(), 'Result: ', result.success ? 'Success' : 'Failed');
    return result;
  }
}
