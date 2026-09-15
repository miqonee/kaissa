import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { prisma } from '../prisma.js';
import { generateSitemapXml, generateRobotsTxt, validateSitemapXml } from './sitemap.js';

export async function generateStaticFiles(outDir: string): Promise<void> {
  mkdirSync(outDir, { recursive: true });

  const xml = await generateSitemapXml();
  const validation = validateSitemapXml(xml);
  if (!validation.valid) {
    throw new Error(`Generated sitemap.xml is invalid:\n${validation.errors.join('\n')}`);
  }

  const sitemapPath = resolve(outDir, 'sitemap.xml');
  writeFileSync(sitemapPath, xml, 'utf-8');
  console.log(`[seo] sitemap.xml generated successfully: ${sitemapPath}`);

  const robots = generateRobotsTxt();
  const robotsPath = resolve(outDir, 'robots.txt');
  writeFileSync(robotsPath, robots, 'utf-8');
  console.log(`[seo] robots.txt generated successfully: ${robotsPath}`);
}

// Запуск напрямую из CLI: tsx src/seo/generateStatic.ts [outDir]
const isMain = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (isMain) {
  const targetDir = process.argv[2] || resolve(process.cwd(), '../client/public');
  generateStaticFiles(targetDir)
    .then(() => {
      console.log('[seo] Static SEO assets created.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('[seo] Failed to generate static SEO files:', err);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
