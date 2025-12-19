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

    const installationId = body.installationId;
    if (installationId) {
      const user = await this.appService.upsertUser(installationId);
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
    
    const result = await this.transactionService.processText(dto.input, dto.type || 'auto', user?.id);
    return result;
  }
}
