import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { join } from 'path';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TransactionService } from './transaction.service';
import { PrismaModule } from './prisma/prisma.module';
import { LLMUsageModule } from './llm-usage/llm-usage.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PrismaModule,
    LLMUsageModule,
  ],
  controllers: [AppController],
  providers: [AppService, TransactionService],
})
export class AppModule {}
