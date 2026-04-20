import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { FiltersService } from './filters.service';
import { Platform } from '@prisma/client';

@Controller('filters')
export class FiltersController {
  constructor(private readonly filters: FiltersService) {}

  @Get()
  list() {
    return this.filters.findAll();
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.filters.findById(id);
  }

  @Post()
  create(
    @Body()
    body: {
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
      whatsappNumber?: string;
    },
  ) {
    return this.filters.create(body);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() body: Partial<Parameters<FiltersService['create']>[0]>,
  ) {
    return this.filters.update(id, body);
  }

  @Patch(':id/toggle')
  toggle(@Param('id') id: string) {
    return this.filters.toggleActive(id);
  }
}
