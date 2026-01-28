import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';

@Injectable()
export class AppService {
  constructor(private prisma: PrismaService) {}

  getHello(): string {
    return 'Hello World!';
  }

  async upsertUser(
    installationId: string,
    appVersion?: string,
    deviceType?: string,
    city?: string,
    country?: string,
  ) {
    const now = new Date();
    const userDelegate: any = this.prisma.user as any;
    return userDelegate.upsert({
      where: { installationId },
      update: {
        lastAccess: now,
        appVersion: appVersion || 'unknown',
        deviceType,
        city,
        country,
      },
      create: {
        installationId,
        lastAccess: now,
        appVersion: appVersion || 'unknown',
        deviceType,
        city,
        country,
      },
    });
  }

  async getLocationFromIp(
    ipAddress?: string,
  ): Promise<{ city?: string; country?: string }> {
    if (!ipAddress) {
      return {};
    }

    try {
      const fetchFn = (globalThis as any).fetch;
      if (!fetchFn) {
        return {};
      }

      // Uses ip-api.com free endpoint (no API key, HTTP only)
      // Docs: http://ip-api.com/docs/api:json
      const response = await fetchFn(`http://ip-api.com/json/${encodeURIComponent(ipAddress)}`);
      if (!response.ok) {
        return {};
      }

      const data = (await response.json()) as any;

      if (!data || data.status !== 'success') {
        return {};
      }

      const city =
        typeof data.city === 'string' && data.city.length > 0 ? data.city : undefined;
      const country =
        typeof data.country === 'string' && data.country.length > 0
          ? data.country
          : undefined;

      return { city, country };
    } catch {
      return {};
    }
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
