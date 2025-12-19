import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';

@Injectable()
export class AppService {
  constructor(private prisma: PrismaService) {}

  getHello(): string {
    return 'Hello World!';
  }

  async upsertUser(installationId: string) {
    const now = new Date();
    return this.prisma.user.upsert({
      where: { installationId },
      update: { lastAccess: now },
      create: { installationId, lastAccess: now },
    });
  }

  async recordInteraction(userId: string, type: 'ping' | 'llm_usage'): Promise<void> {
    // Check if user exists
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    // Only record interaction if user exists
    if (user) {
      await this.prisma.interaction.create({
        data: { userId, type },
      });
    }
  }
}
