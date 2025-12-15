import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { LLMUsageService } from './llm-usage.service';
import { LLMUsageController } from './llm-usage.controller';

@Module({
  imports: [PrismaModule],
  controllers: [LLMUsageController],
  providers: [LLMUsageService],
  exports: [LLMUsageService],
})
export class LLMUsageModule {}
