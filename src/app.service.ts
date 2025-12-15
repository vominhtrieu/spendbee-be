import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';

@Injectable()
export class AppService {
  constructor(private prisma: PrismaService) {}

  getHello(): string {
    return 'Hello World!';
  }

  async upsertUser(installionId: string) {
    const now = new Date();
    return this.prisma.user.upsert({
      where: { installionId },
      update: { lastAccess: now },
      create: { installionId, lastAccess: now },
    });
  }
}
