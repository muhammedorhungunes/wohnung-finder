import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Platform } from '@prisma/client';
import { normalizeCity } from '../../utils/city.util';

type FilterRow = {
  id: string;
  city: string;
  minPrice: number | null;
  maxPrice: number | null;
  minRooms: number | null;
  maxRooms: number | null;
  minSizeM2: number | null;
};

type ListingRow = {
  id: string;
  city: string | null;
  price: number | null;
  rooms: number | null;
  sizeM2: number | null;
  firstSeenAt: Date;
};

@Injectable()
export class MatcherService {
  private readonly logger = new Logger(MatcherService.name);

  constructor(private readonly prisma: PrismaService) {}

  async matchNewListings(): Promise<number> {
    const activeFilters = await this.prisma.filter.findMany({
      where: { isActive: true, platforms: { has: Platform.EBAY } },
    });
    const listings = await this.prisma.listing.findMany({
      where: { platform: Platform.EBAY },
      orderBy: { firstSeenAt: 'desc' },
      take: 500,
    });

    let created = 0;
    for (const filter of activeFilters) {
      for (const listing of listings) {
        if (!this.matchesFilter(listing, filter)) continue;
        const score = this.scoreListingForFilter(listing, filter);
        try {
          await this.prisma.match.create({
            data: { filterId: filter.id, listingId: listing.id, score },
          });
          created++;
        } catch {
          // Unique constraint violation — already exists
        }
      }
    }
    this.logger.log(`${created} new matches found`);
    return created;
  }

  private matchesFilter(listing: ListingRow, filter: FilterRow): boolean {
    if (filter.city && listing.city) {
      if (!normalizeCity(listing.city).includes(normalizeCity(filter.city))) return false;
    }
    if (listing.price != null) {
      if (filter.minPrice != null && listing.price < filter.minPrice) return false;
      if (filter.maxPrice != null && listing.price > filter.maxPrice) return false;
    }
    if (listing.rooms != null) {
      if (filter.minRooms != null && listing.rooms < filter.minRooms) return false;
      if (filter.maxRooms != null && listing.rooms > filter.maxRooms) return false;
    }
    if (listing.sizeM2 != null && filter.minSizeM2 != null) {
      if (listing.sizeM2 < filter.minSizeM2) return false;
    }
    return true;
  }

  // Score 0–100: higher = better match
  private scoreListingForFilter(listing: ListingRow, filter: FilterRow): number {
    let score = 0;

    // Price (0–40 pts): cheaper relative to budget = higher score
    if (listing.price == null) {
      score += 20;
    } else if (filter.maxPrice != null) {
      const min = filter.minPrice ?? 0;
      const range = filter.maxPrice - min;
      const ratio = range > 0 ? (listing.price - min) / range : 0;
      score += Math.round(40 * (1 - Math.min(ratio, 1)));
    } else {
      score += 20;
    }

    // Rooms (0–30 pts): closest to midpoint of range = full score
    if (listing.rooms == null || (filter.minRooms == null && filter.maxRooms == null)) {
      score += 15;
    } else {
      const min = filter.minRooms ?? listing.rooms;
      const max = filter.maxRooms ?? listing.rooms;
      const mid = (min + max) / 2;
      const distance = Math.abs(listing.rooms - mid);
      const half = (max - min) / 2 || 0.5;
      score += Math.round(30 * Math.max(0, 1 - distance / half));
    }

    // Recency (0–30 pts)
    const ageHours = (Date.now() - listing.firstSeenAt.getTime()) / 3_600_000;
    if (ageHours < 24) score += 30;
    else if (ageHours < 48) score += 20;
    else if (ageHours < 168) score += 10;

    return Math.min(100, Math.max(0, score));
  }
}
