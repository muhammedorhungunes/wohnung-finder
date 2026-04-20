import { Controller, Get, Param, Query } from '@nestjs/common';
import { ListingsService } from './listings.service';
import { Platform } from '@prisma/client';

@Controller('listings')
export class ListingsController {
  constructor(private readonly listings: ListingsService) {}

  @Get()
  list(
    @Query('city') city?: string,
    @Query('platform') platform?: Platform,
    @Query('limit') limit?: string,
  ) {
    return this.listings.findMany({
      city,
      platform,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.listings.findById(id);
  }
}
