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
    const updateData: any = {
      lastAccess: now,
      appVersion: appVersion || 'unknown',
      deviceType,
    };

    const createData: any = {
      installationId,
      lastAccess: now,
      appVersion: appVersion || 'unknown',
      deviceType,
    };

    if (city !== undefined) {
      updateData.city = city;
      createData.city = city;
    }

    if (country !== undefined) {
      updateData.country = country;
      createData.country = country;
    }

    return userDelegate.upsert({
      where: { installationId },
      update: updateData,
      create: createData,
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

      const apiKey = process.env.IPGEOLOCATION_API_KEY;
      if (!apiKey) {
        return {};
      }

      // Uses ipgeolocation.io API
      // Docs: https://ipgeolocation.io/documentation/ip-geolocation-api.html
      const url = `https://api.ipgeolocation.io/ipgeo?apiKey=${encodeURIComponent(
        apiKey,
      )}&ip=${encodeURIComponent(ipAddress)}&fields=city,country_name`;

      const response = await fetchFn(url);
      if (!response.ok) {
        return {};
      }

      const data = (await response.json()) as any;

      const city =
        data && typeof data.city === 'string' && data.city.length > 0
          ? data.city
          : undefined;
      const country =
        data && typeof data.country_name === 'string' && data.country_name.length > 0
          ? data.country_name
          : undefined;

      return { city, country };
    } catch {
      return {};
    }
  }

  async updateUserLocation(
    userId: string,
    city?: string,
    country?: string,
  ): Promise<void> {
    if (!city && !country) {
      return;
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(city ? { city } : {}),
        ...(country ? { country } : {}),
      },
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
