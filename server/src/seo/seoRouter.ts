import { Router } from 'express';
import { getCachedSitemapXml, generateRobotsTxt } from './sitemap.js';

export const seoRouter = Router();

/**
 * Эндпоинт sitemap.xml для поисковых ботов (Яндекс, Google, Bing).
 * Поддерживает обращение как к корню (/sitemap.xml), так и через API-префикс (/api/sitemap.xml).
 */
seoRouter.get(['/sitemap.xml', '/api/sitemap.xml'], async (_req, res) => {
  try {
    const xml = await getCachedSitemapXml();
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send(xml);
  } catch (err) {
    console.error('[seo] Error generating sitemap.xml:', err);
    res.status(500).setHeader('Content-Type', 'text/plain; charset=utf-8').send('Internal Server Error');
  }
});

/**
 * Эндпоинт robots.txt
 * Содержит правила индексации, запрет служебных URL и директивы Host, Sitemap.
 */
seoRouter.get(['/robots.txt', '/api/robots.txt'], (_req, res) => {
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.send(generateRobotsTxt());
});
