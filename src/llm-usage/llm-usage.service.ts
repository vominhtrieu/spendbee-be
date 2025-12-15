import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class LLMUsageService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(limit: number = 100, offset: number = 0) {
    const [data, total] = await Promise.all([
      this.prisma.lLMUsage.findMany({
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.lLMUsage.count(),
    ]);

    return { data, total };
  }

  async create(modelName: string, success: boolean, userId?: string) {
    return this.prisma.lLMUsage.create({
      data: {
        modelName,
        success,
        userId,
      },
    });
  }
}
