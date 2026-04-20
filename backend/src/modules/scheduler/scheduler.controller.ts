import { Controller, Post } from '@nestjs/common';
import { SchedulerService } from './scheduler.service';

@Controller('scheduler')
export class SchedulerController {
  constructor(private readonly scheduler: SchedulerService) {}

  @Post('run')
  async run() {
    await this.scheduler.handleScrapeAndNotify();
    return { ok: true };
  }
}
