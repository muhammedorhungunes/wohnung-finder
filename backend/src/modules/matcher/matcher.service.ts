import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Platform } from '@prisma/client';

/**
 * Yeni/güncel listing'leri aktif filtrelerle eşleştirir ve matches tablosuna yazar.
 * Idempotent: (filter_id, listing_id) unique olduğu için aynı çift tekrar eklenmez.
 */
@Injectable()
export class MatcherService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Son scrape turunda eklenen/güncellenen listing'ler için match oluşturur.
   * Şimdilik basit: tüm EBAY listing'leri, EBAY içeren filtrelerle kontrol edilir.
   */
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
          // unique violation = zaten var, skip
        }
      }
    }
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
