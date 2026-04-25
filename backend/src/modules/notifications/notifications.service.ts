import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import * as nodemailer from 'nodemailer';

const TOP_N = 5;

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private transporter: nodemailer.Transporter | null = null;
  private fromAddress: string = '';

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    const user = this.config.get<string>('GMAIL_USER');
    const pass = this.config.get<string>('GMAIL_APP_PASSWORD');
    if (user && pass) {
      this.fromAddress = user;
      this.transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: { user, pass },
      });
    }
  }

  async sendPendingMatches(): Promise<number> {
    if (!this.transporter) {
      this.logger.warn('Gmail nicht konfiguriert — keine E-Mails gesendet');
      return 0;
    }

    const pending = await this.prisma.match.findMany({
      where: { notifiedAt: null },
      include: { filter: true, listing: true },
    });

    // Gruppiere nach Filter
    const byFilter = new Map<string, typeof pending>();
    for (const m of pending) {
      const list = byFilter.get(m.filterId) ?? [];
      list.push(m);
      byFilter.set(m.filterId, list);
    }

    let sent = 0;
    for (const [, matches] of byFilter) {
      const filter = matches[0].filter;
      if (!filter.email) continue;

      // Top N nach Score sortieren
      const top = [...matches]
        .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
        .slice(0, TOP_N);

      const ok = await this.sendDigestEmail(filter.email, filter.name, top);
      if (ok) {
        for (const m of top) {
          await this.prisma.match.update({
            where: { filterId_listingId: { filterId: m.filterId, listingId: m.listingId } },
            data: { notifiedAt: new Date() },
          });
        }
        sent += top.length;
      }
    }

    this.logger.log(`${sent} Treffer per E-Mail gesendet`);
    return sent;
  }

  private async sendDigestEmail(
    to: string,
    filterName: string,
    matches: Array<{ listing: { title: string; price: number | null; city: string | null; address: string | null; url: string; images: string[]; rooms: number | null; sizeM2: number | null }; score: number | null }>,
  ): Promise<boolean> {
    try {
      await this.transporter!.sendMail({
        from: `"Wohnung Finder" <${this.fromAddress}>`,
        to,
        subject: `🏠 ${matches.length} neue Treffer – ${filterName}`,
        html: this.buildHtml(filterName, matches),
      });
      return true;
    } catch (err) {
      this.logger.error(`E-Mail-Fehler an ${to}: ${err}`);
      return false;
    }
  }

  private buildHtml(
    filterName: string,
    matches: Array<{ listing: { title: string; price: number | null; city: string | null; address: string | null; url: string; images: string[]; rooms: number | null; sizeM2: number | null }; score: number | null }>,
  ): string {
    const cards = matches.map((m) => {
      const l = m.listing;
      const price = l.price != null ? `${l.price.toLocaleString('de-DE')} €` : 'Preis auf Anfrage';
      const location = l.address ?? l.city ?? '–';
      const rooms = l.rooms != null ? `${l.rooms} Zimmer` : '';
      const size = l.sizeM2 != null ? `${l.sizeM2} m²` : '';
      const details = [rooms, size].filter(Boolean).join(' · ');
      const img = l.images[0]
        ? `<img src="${l.images[0]}" alt="" style="width:100%;height:180px;object-fit:cover;border-radius:8px 8px 0 0;">`
        : `<div style="width:100%;height:60px;background:#f0f4f8;border-radius:8px 8px 0 0;display:flex;align-items:center;justify-content:center;font-size:24px;">🏠</div>`;
      const score = m.score != null ? Math.round(m.score) : '–';

      return `
        <div style="background:#fff;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,0.08);margin-bottom:20px;overflow:hidden;">
          ${img}
          <div style="padding:16px;">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">
              <h2 style="margin:0 0 8px;font-size:15px;font-weight:600;color:#1a202c;line-height:1.4;">${this.esc(l.title)}</h2>
              <span style="background:#ebf8ff;color:#2b6cb0;font-size:12px;font-weight:700;padding:3px 8px;border-radius:99px;white-space:nowrap;">Score ${score}</span>
            </div>
            ${details ? `<p style="margin:0 0 6px;font-size:13px;color:#718096;">${this.esc(details)}</p>` : ''}
            <p style="margin:0 0 6px;font-size:13px;color:#718096;">📍 ${this.esc(location)}</p>
            <p style="margin:0 0 14px;font-size:18px;font-weight:700;color:#2d3748;">💶 ${price}</p>
            <a href="${l.url}" style="display:inline-block;background:#3182ce;color:#fff;text-decoration:none;padding:10px 20px;border-radius:6px;font-size:14px;font-weight:600;">Anzeige ansehen →</a>
          </div>
        </div>`;
    }).join('');

    return `<!DOCTYPE html>
<html lang="de">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f7fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:24px 16px;">
    <div style="text-align:center;margin-bottom:24px;">
      <div style="font-size:32px;margin-bottom:8px;">🏠</div>
      <h1 style="margin:0;font-size:22px;font-weight:700;color:#1a202c;">Wohnung Finder</h1>
      <p style="margin:4px 0 0;font-size:14px;color:#718096;">Top ${matches.length} Treffer für <strong>${this.esc(filterName)}</strong></p>
    </div>

    ${cards}

    <p style="text-align:center;font-size:12px;color:#a0aec0;margin-top:24px;">
      Automatisch generiert von Wohnung Finder · Scraping alle 2 Stunden
    </p>
  </div>
</body>
</html>`;
  }

  private esc(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
}
