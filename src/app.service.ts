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
}
