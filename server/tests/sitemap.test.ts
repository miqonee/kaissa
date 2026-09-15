import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import express from 'express';
import {
  generateSitemapXml,
  generateRobotsTxt,
  validateSitemapXml,
  getCachedSitemapXml,
  clearSitemapCache,
  formatUrlXml,
  escapeXml,
  formatW3CDate,
  VALID_CHANGEFREQS,
} from '../src/seo/sitemap.js';
import { seoRouter } from '../src/seo/seoRouter.js';
import { prisma } from '../src/prisma.js';
import { generateStaticFiles } from '../src/seo/generateStatic.js';

describe('SEO & Sitemap Specification', () => {
  beforeEach(() => {
    clearSitemapCache();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('escapeXml & formatW3CDate', () => {
    it('escapes all XML special characters', () => {
      expect(escapeXml('<script>alert("xss" & \'test\')</script>')).toBe(
        '&lt;script&gt;alert(&quot;xss&quot; &amp; &apos;test&apos;)&lt;/script&gt;',
      );
    });

    it('formats valid dates to W3C Datetime YYYY-MM-DD', () => {
      const d = new Date('2026-09-15T14:30:00.000Z');
      expect(formatW3CDate(d)).toBe('2026-09-15');
    });

    it('falls back to current date on invalid date', () => {
      const today = new Date().toISOString().split('T')[0];
      expect(formatW3CDate('invalid-date')).toBe(today);
      expect(formatW3CDate(null)).toBe(today);
    });
  });

  describe('formatUrlXml sequence and tag ordering', () => {
    it('strictly maintains xsd:sequence order: loc -> lastmod -> changefreq -> priority', () => {
      const xml = formatUrlXml({
        loc: 'https://duochess.ru/leaderboard',
        lastmod: '2026-09-15',
        changefreq: 'hourly',
        priority: 0.8,
      });

      const locIdx = xml.indexOf('<loc>');
      const lastmodIdx = xml.indexOf('<lastmod>');
      const cfIdx = xml.indexOf('<changefreq>');
      const prioIdx = xml.indexOf('<priority>');

      expect(locIdx).toBeGreaterThan(-1);
      expect(lastmodIdx).toBeGreaterThan(locIdx);
      expect(cfIdx).toBeGreaterThan(lastmodIdx);
      expect(prioIdx).toBeGreaterThan(cfIdx);
    });
  });

  describe('generateSitemapXml with static and dynamic pages', () => {
    it('includes all 4 static pages: /, /leaderboard, /history, /login with proper attributes', async () => {
      vi.spyOn(prisma.user, 'findMany').mockResolvedValue([] as any);
      vi.spyOn(prisma.game, 'findFirst').mockResolvedValue(null as any);
      vi.spyOn(prisma.ratingHistory, 'findFirst').mockResolvedValue(null as any);

      const xml = await generateSitemapXml({ baseUrl: 'https://duochess.ru' });

      expect(xml).toContain('<loc>https://duochess.ru/</loc>');
      expect(xml).toContain('<loc>https://duochess.ru/leaderboard</loc>');
      expect(xml).toContain('<loc>https://duochess.ru/history</loc>');
      expect(xml).toContain('<loc>https://duochess.ru/login</loc>');

      // Check priorities
      expect(xml).toContain('<priority>1.0</priority>'); // Home
      expect(xml).toContain('<priority>0.8</priority>'); // Leaderboard
      expect(xml).toContain('<priority>0.7</priority>'); // History
      expect(xml).toContain('<priority>0.5</priority>'); // Login

      // Check changefreqs
      expect(xml).toContain('<changefreq>daily</changefreq>');
      expect(xml).toContain('<changefreq>hourly</changefreq>');
      expect(xml).toContain('<changefreq>monthly</changefreq>');

      const validation = validateSitemapXml(xml);
      expect(validation.valid).toBe(true);
      expect(validation.errors).toEqual([]);
    });

    it('dynamically pulls active players and formats profile URLs', async () => {
      const mockUsers = [
        {
          username: 'grandmaster_alisa',
          updatedAt: new Date('2026-09-14T10:00:00Z'),
          createdAt: new Date('2026-08-01T00:00:00Z'),
        },
        {
          username: 'player.with-dots',
          updatedAt: new Date('2026-09-12T15:30:00Z'),
          createdAt: new Date('2026-08-15T00:00:00Z'),
        },
      ];

      vi.spyOn(prisma.user, 'findMany').mockResolvedValue(mockUsers as any);
      vi.spyOn(prisma.game, 'findFirst').mockResolvedValue(null as any);
      vi.spyOn(prisma.ratingHistory, 'findFirst').mockResolvedValue(null as any);

      const xml = await generateSitemapXml({ baseUrl: 'https://duochess.ru' });

      expect(xml).toContain('<loc>https://duochess.ru/players/grandmaster_alisa</loc>');
      expect(xml).toContain('<lastmod>2026-09-14</lastmod>');
      expect(xml).toContain('<changefreq>weekly</changefreq>');
      expect(xml).toContain('<priority>0.6</priority>');

      expect(xml).toContain('<loc>https://duochess.ru/players/player.with-dots</loc>');
      expect(xml).toContain('<lastmod>2026-09-12</lastmod>');

      const validation = validateSitemapXml(xml);
      expect(validation.valid).toBe(true);
      expect(validation.errors).toEqual([]);
    });

    it('queries active players with isBot: false and checks participations/results', async () => {
      let capturedWhere: any = null;
      vi.spyOn(prisma.user, 'findMany').mockImplementation(((args: any) => {
        capturedWhere = args?.where;
        return Promise.resolve([]);
      }) as any);

      await generateSitemapXml({ activeOnly: true });

      expect(capturedWhere).toBeDefined();
      expect(capturedWhere.isBot).toBe(false);
      expect(capturedWhere.OR).toEqual(
        expect.arrayContaining([
          { participations: { some: {} } },
          { wins: { gt: 0 } },
          { losses: { gt: 0 } },
          { draws: { gt: 0 } },
        ]),
      );
    });
  });
  describe('generateRobotsTxt', () => {
    it('generates robots.txt with required Allow/Disallow, Host, and Sitemap directives', () => {
      const robots = generateRobotsTxt();

      expect(robots).toContain('User-agent: *');
      expect(robots).toContain('Allow: /');
      expect(robots).toContain('Disallow: /admin');
      expect(robots).toContain('Disallow: /lobby/*');
      expect(robots).toContain('Disallow: /api/');
      expect(robots).toContain('Host: duochess.ru');
      expect(robots).toContain('Sitemap: https://duochess.ru/sitemap.xml');
    });

    it('supports custom host and baseUrl', () => {
      const robots = generateRobotsTxt({ host: 'custom-chess.com', baseUrl: 'https://custom-chess.com' });

      expect(robots).toContain('Host: custom-chess.com');
      expect(robots).toContain('Sitemap: https://custom-chess.com/sitemap.xml');
    });
  });

  describe('validateSitemapXml (sitemaps.org standard)', () => {
    it('validates standard sitemap generated by generateSitemapXml', async () => {
      vi.spyOn(prisma.user, 'findMany').mockResolvedValue([
        { username: 'testuser', updatedAt: new Date(), createdAt: new Date() },
      ] as any);

      const xml = await generateSitemapXml();
      const res = validateSitemapXml(xml);

      expect(res.valid).toBe(true);
      expect(res.errors).toHaveLength(0);
    });

    it('detects missing or invalid XML declaration', () => {
      const badXml = '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://duochess.ru/</loc></url></urlset>';
      const res = validateSitemapXml(badXml);

      expect(res.valid).toBe(false);
      expect(res.errors.some((e) => e.includes('XML declaration'))).toBe(true);
    });

    it('detects invalid sitemap namespace', () => {
      const badXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.wrong.org/schemas/sitemap/0.9">
  <url><loc>https://duochess.ru/</loc></url>
</urlset>`;
      const res = validateSitemapXml(badXml);

      expect(res.valid).toBe(false);
      expect(res.errors.some((e) => e.includes('namespace'))).toBe(true);
    });

    it('detects missing <loc> inside <url>', () => {
      const badXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><priority>1.0</priority></url>
</urlset>`;
      const res = validateSitemapXml(badXml);

      expect(res.valid).toBe(false);
      expect(res.errors.some((e) => e.includes('Missing required <loc>'))).toBe(true);
    });

    it('detects invalid changefreq value', () => {
      const badXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://duochess.ru/</loc>
    <changefreq>sometimes</changefreq>
  </url>
</urlset>`;
      const res = validateSitemapXml(badXml);

      expect(res.valid).toBe(false);
      expect(res.errors.some((e) => e.includes('Invalid <changefreq>'))).toBe(true);
    });

    it('detects invalid priority out of 0.0 - 1.0 range', () => {
      const badXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://duochess.ru/</loc>
    <priority>1.5</priority>
  </url>
</urlset>`;
      const res = validateSitemapXml(badXml);

      expect(res.valid).toBe(false);
      expect(res.errors.some((e) => e.includes('Invalid <priority>'))).toBe(true);
    });

    it('detects out-of-order sequence (loc -> lastmod -> changefreq -> priority)', () => {
      const badXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://duochess.ru/</loc>
    <priority>1.0</priority>
    <changefreq>daily</changefreq>
  </url>
</urlset>`;
      const res = validateSitemapXml(badXml);

      expect(res.valid).toBe(false);
      expect(res.errors.some((e) => e.includes('out of sequence'))).toBe(true);
    });
  });

  describe('Caching behavior', () => {
    it('returns cached XML on subsequent calls within TTL', async () => {
      const spy = vi.spyOn(prisma.user, 'findMany').mockResolvedValue([]);
      vi.spyOn(prisma.game, 'findFirst').mockResolvedValue(null as any);
      vi.spyOn(prisma.ratingHistory, 'findFirst').mockResolvedValue(null as any);

      const xml1 = await getCachedSitemapXml();
      const xml2 = await getCachedSitemapXml();

      expect(xml1).toBe(xml2);
      expect(spy).toHaveBeenCalledTimes(1);

      // forceRefresh bypasses cache
      await getCachedSitemapXml({}, true);
      expect(spy).toHaveBeenCalledTimes(2);
    });
  });

  describe('Static file generation', () => {
    it('writes valid sitemap.xml and robots.txt to disk', async () => {
      const tmp = mkdtempSync(join(tmpdir(), 'seo-test-'));
      try {
        vi.spyOn(prisma.user, 'findMany').mockResolvedValue([]);
        vi.spyOn(prisma.game, 'findFirst').mockResolvedValue(null as any);
        vi.spyOn(prisma.ratingHistory, 'findFirst').mockResolvedValue(null as any);

        await generateStaticFiles(tmp);

        const sitemapPath = join(tmp, 'sitemap.xml');
        const robotsPath = join(tmp, 'robots.txt');

        expect(existsSync(sitemapPath)).toBe(true);
        expect(existsSync(robotsPath)).toBe(true);

        const sitemapContent = readFileSync(sitemapPath, 'utf-8');
        const robotsContent = readFileSync(robotsPath, 'utf-8');

        expect(validateSitemapXml(sitemapContent).valid).toBe(true);
        expect(robotsContent).toContain('Host: duochess.ru');
        expect(robotsContent).toContain('Sitemap: https://duochess.ru/sitemap.xml');
      } finally {
        rmSync(tmp, { recursive: true, force: true });
      }
    });
  });

  describe('Express seoRouter endpoints', () => {
    it('serves sitemap.xml with application/xml and robots.txt with text/plain', async () => {
      vi.spyOn(prisma.user, 'findMany').mockResolvedValue([]);
      vi.spyOn(prisma.game, 'findFirst').mockResolvedValue(null as any);
      vi.spyOn(prisma.ratingHistory, 'findFirst').mockResolvedValue(null as any);

      // Test sitemap.xml handler directly
      let sitemapHeaders: Record<string, string> = {};
      let sitemapBody = '';
      const sitemapRes: any = {
        setHeader: (k: string, v: string) => { sitemapHeaders[k] = v; },
        send: (b: string) => { sitemapBody = b; },
        status: () => sitemapRes,
      };
      const sitemapRoute = (seoRouter.stack.find((l) => l.route?.path?.includes('/sitemap.xml')) as any)?.route;
      expect(sitemapRoute).toBeDefined();
      await sitemapRoute.stack[0].handle({}, sitemapRes, () => {});

      expect(sitemapHeaders['Content-Type']).toContain('application/xml');
      expect(sitemapHeaders['Cache-Control']).toContain('public');
      expect(sitemapBody).toContain('<urlset');
      expect(validateSitemapXml(sitemapBody).valid).toBe(true);

      // Test robots.txt handler directly
      let robotsHeaders: Record<string, string> = {};
      let robotsBody = '';
      const robotsRes: any = {
        setHeader: (k: string, v: string) => { robotsHeaders[k] = v; },
        send: (b: string) => { robotsBody = b; },
        status: () => robotsRes,
      };
      const robotsRoute = (seoRouter.stack.find((l) => l.route?.path?.includes('/robots.txt')) as any)?.route;
      expect(robotsRoute).toBeDefined();
      robotsRoute.stack[0].handle({}, robotsRes, () => {});

      expect(robotsHeaders['Content-Type']).toContain('text/plain');
      expect(robotsBody).toContain('Host: duochess.ru');
      expect(robotsBody).toContain('Disallow: /lobby/*');
    });
  });

});
