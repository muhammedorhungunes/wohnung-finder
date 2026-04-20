import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Platform } from '@prisma/client';

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
        try {
          await this.prisma.match.create({
            data: { filterId: filter.id, listingId: listing.id },
          });
          created++;
        } catch {
          // Unique-Verletzung = bereits vorhanden, überspringen
        }
      }
    }
    this.logger.log(`${created} neue Treffer gefunden`);
    return created;
  }

  private matchesFilter(
    listing: { city: string | null; price: number | null; rooms: number | null },
    filter: {
      city: string;
      minPrice: number | null;
      maxPrice: number | null;
      minRooms: number | null;
      maxRooms: number | null;
    },
  ): boolean {
    if (filter.city && listing.city) {
      if (!listing.city.toLowerCase().includes(filter.city.toLowerCase())) return false;
    }
    if (listing.price != null) {
      if (filter.minPrice != null && listing.price < filter.minPrice) return false;
      if (filter.maxPrice != null && listing.price > filter.maxPrice) return false;
    }
    if (listing.rooms != null) {
      if (filter.minRooms != null && listing.rooms < filter.minRooms) return false;
      if (filter.maxRooms != null && listing.rooms > filter.maxRooms) return false;
    }
    return true;
  }
}
