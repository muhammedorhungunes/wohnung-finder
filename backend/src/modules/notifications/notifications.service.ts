import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import * as twilio from 'twilio';

/**
 * Twilio WhatsApp ile bildirim gönderir.
 * matches tablosunda notified_at IS NULL olan kayıtları işler.
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private twilioClient: twilio.Twilio | null = null;
  private fromNumber: string = '';

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    const sid = this.config.get<string>('TWILIO_ACCOUNT_SID');
    const token = this.config.get<string>('TWILIO_AUTH_TOKEN');
    this.fromNumber = this.config.get<string>('TWILIO_WHATSAPP_FROM') ?? '';
    if (sid && token) this.twilioClient = twilio(sid, token);
  }

  async sendPendingMatches(): Promise<number> {
    const pending = await this.prisma.match.findMany({
      where: { notifiedAt: null },
      include: { filter: true, listing: true },
    });
    let sent = 0;
    for (const m of pending) {
      const ok = await this.sendWhatsApp(
        m.filter.whatsappNumber ?? '',
        this.formatListingMessage(m.listing, m.filter.name),
      );
      if (ok) {
        await this.prisma.match.update({
          where: { filterId_listingId: { filterId: m.filterId, listingId: m.listingId } },
          data: { notifiedAt: new Date() },
        });
        await this.prisma.listing.update({
          where: { id: m.listingId },
          data: { isNotified: true },
        });
        sent++;
      }
    }
    this.logger.log(`${sent} WhatsApp-Nachrichten gesendet`);
    return sent;
  }

  private formatListingMessage(listing: { title: string; price: number | null; url: string; city: string | null; address: string | null }, filterName: string): string {
    const price = listing.price != null ? `${listing.price} €` : 'Preis unbekannt';
    const location = listing.address ?? listing.city ?? '—';
    return [
      '🏠 *Neue Wohnung* — Kleinanzeigen',
      '',
      `*${listing.title}*`,
      '',
      `📍 ${location}`,
      `💶 ${price}`,
      `🔗 ${listing.url}`,
      '',
      `Filter: ${filterName}`,
    ].join('\n');
  }

  async sendWhatsApp(to: string, body: string): Promise<boolean> {
    if (!this.twilioClient || !this.fromNumber || !to) return false;
    try {
      await this.twilioClient.messages.create({
        from: this.fromNumber,
        to: to.startsWith('whatsapp:') ? to : `whatsapp:${to}`,
        body,
      });
      return true;
    } catch (err) {
      this.logger.error(`WhatsApp-Fehler an ${to}: ${err}`);
      return false;
    }
  }
}
