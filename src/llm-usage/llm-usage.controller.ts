import { Controller, Get, Query } from '@nestjs/common';
import { LLMUsageService } from './llm-usage.service';

@Controller('llm-usage')
export class LLMUsageController {
  constructor(private readonly llmUsageService: LLMUsageService) {}

  @Get()
  async findAll(
    @Query('limit') limit: string = '100',
    @Query('offset') offset: string = '0',
  ) {
    return this.llmUsageService.findAll(
      parseInt(limit, 10),
      parseInt(offset, 10),
    );
  }
}
