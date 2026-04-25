import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Platform } from '@prisma/client';
import { normalizeCity } from '../../utils/city.util';

@Injectable()
export class FiltersService {
  constructor(private readonly prisma: PrismaService) {}

  async findActive() {
    return this.prisma.filter.findMany({ where: { isActive: true } });
  }

  async findAll() {
    return this.prisma.filter.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async findById(id: string) {
    return this.prisma.filter.findUnique({ where: { id } });
  }

  async create(data: {
    name: string;
    city: string;
    address?: string;
    radiusKm?: number;
    minPrice?: number;
    maxPrice?: number;
    minRooms?: number;
    maxRooms?: number;
    minSizeM2?: number;
    platforms?: Platform[];
    email?: string;
  }) {
    return this.prisma.filter.create({
      data: {
        ...data,
        city: normalizeCity(data.city),
        platforms: data.platforms ?? [Platform.EBAY],
      },
    });
  }

  async update(id: string, data: Partial<Parameters<FiltersService['create']>[0]>) {
    return this.prisma.filter.update({
      where: { id },
      data: { ...data, ...(data.city ? { city: normalizeCity(data.city) } : {}) },
    });
  }

  async toggleActive(id: string) {
    const f = await this.prisma.filter.findUnique({ where: { id } });
    if (!f) return null;
    return this.prisma.filter.update({
      where: { id },
      data: { isActive: !f.isActive },
    });
  }
}
