import { Module } from '@nestjs/common';
import { EbayScraperService } from './ebay.scraper.service';
import { ListingsModule } from '../listings/listings.module';

@Module({
  imports: [ListingsModule],
  providers: [EbayScraperService],
  exports: [EbayScraperService],
})
export class ScrapersModule {}
