import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Platform } from '@prisma/client';

export interface UpsertListingInput {
  platform: Platform;
  externalId: string;
  title: string;
  price?: number | null;
  rooms?: number | null;
  sizeM2?: number | null;
  address?: string | null;
  city?: string | null;
  url: string;
  images?: string[];
}

@Injectable()
export class ListingsService {
  constructor(private readonly prisma: PrismaService) {}

  async findMany(params?: { city?: string; platform?: Platform; limit?: number }) {
    return this.prisma.listing.findMany({
      where: {
        ...(params?.city && { city: { contains: params.city, mode: 'insensitive' } }),
        ...(params?.platform && { platform: params.platform }),
      },
      orderBy: { firstSeenAt: 'desc' },
      take: params?.limit ?? 50,
    });
  }

  async findById(id: string) {
    return this.prisma.listing.findUnique({ where: { id } });
  }

  async upsert(input: UpsertListingInput) {
    return this.prisma.listing.upsert({
      where: {
        platform_externalId: { platform: input.platform, externalId: input.externalId },
      },
      create: {
        platform: input.platform,
        externalId: input.externalId,
        title: input.title,
        price: input.price ?? undefined,
        rooms: input.rooms ?? undefined,
        sizeM2: input.sizeM2 ?? undefined,
        address: input.address ?? undefined,
        city: input.city ?? undefined,
        url: input.url,
        images: input.images ?? [],
      },
      update: {
        title: input.title,
        price: input.price,
        rooms: input.rooms,
        sizeM2: input.sizeM2,
        address: input.address,
        city: input.city,
        url: input.url,
        images: input.images ?? [],
      },
    });
  }

  async upsertMany(inputs: UpsertListingInput[]) {
    const results = [];
    for (const input of inputs) {
      results.push(await this.upsert(input));
    }
    return results;
  }
}
