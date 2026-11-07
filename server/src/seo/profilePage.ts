import { readFile } from 'node:fs/promises';
import { Router, type Response } from 'express';
import { prisma } from '../prisma.js';
import { asyncRoute } from '../http/asyncRoute.js';

export const profilePages = Router();
const escapeHtml = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

const NOT_FOUND_HTML = `<!doctype html>
<html lang="ru">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="robots" content="noindex, follow" />
    <title>404 — Игрок не найден | Каисса</title>
    <link rel="shortcut icon" href="/favicon.ico" type="image/x-icon" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <link rel="icon" type="image/png" sizes="120x120" href="/favicon-120x120.png" />
    <link rel="icon" type="image/png" sizes="48x48" href="/favicon-48x48.png" />
  </head>
  <body>
    <main>
      <h1>404 — Игрок не найден</h1>
      <p>Запрашиваемый профиль не существует или был удалён.</p>
      <nav>
        <a href="/">На главную</a> · <a href="/leaderboard">Рейтинг игроков</a>
      </nav>
    </main>
  </body>
</html>`;

function sendProfileNotFound(res: Response): void {
  res
    .status(404)
    .setHeader('Cache-Control', 'no-cache, no-store, must-revalidate')
    .setHeader('X-Robots-Tag', 'noindex, follow')
    .type('html')
    .send(NOT_FOUND_HTML);
}

profilePages.get('/players/:username', asyncRoute(async (req, res) => {
  const user = await prisma.user.findUnique({ where: { username: String(req.params.username) } });
  res.setHeader('Cache-Control', 'no-cache');
  if (!user) {
    sendProfileNotFound(res);
    return;
  }
  const en = req.query.lang === 'en';
  const url = `https://duochess.ru/players/${encodeURIComponent(user.username)}`;
  if (req.path.endsWith('/')) return void res.redirect(301, url + (en ? '?lang=en' : ''));
  const canonical = url + (en ? '?lang=en' : '');
  const title = `${user.username} — ${en ? 'player profile | Kaissa' : 'профиль игрока | Каисса'}`;
  const archived = await prisma.gameParticipant.count({ where: { userId: user.id, game: { status: 'finished' } } });
  const total = Math.max(archived, user.wins + user.losses + user.draws);
  const description = en ? `${user.username}: ${total} completed games. Ratings and chess statistics on Kaissa.` : `${user.username}: завершённых партий — ${total}. Рейтинги и шахматная статистика в клубе Каисса.`;
  const robots = user.isGuest || user.isBot ? 'noindex, follow' : 'index, follow';
  let html: string;
  try {
    html = await readFile(new URL(`../../../client/dist/index${en ? '.en' : ''}.html`, import.meta.url), 'utf8');
  } catch {
    res.status(503).setHeader('Retry-After', '60');
    res.type('text').send('Profile page is temporarily unavailable');
    return;
  }
  html = html.replace(/<title>.*?<\/title>/s, `<title>${escapeHtml(title)}</title>`)
    .replace(/<meta name="description" content="[^"]*"\s*\/?>/, `<meta name="description" content="${escapeHtml(description)}">`)
    .replace(/<meta name="robots" content="[^"]*"\s*\/?>/, `<meta name="robots" content="${robots}">`)
    .replace(/<link rel="canonical" href="[^"]*"\s*\/?>/, `<link rel="canonical" href="${escapeHtml(canonical)}">`)
    .replace(/<link rel="alternate" hreflang="([^"]*)" href="[^"]*"\s*\/?>/g, (_tag, lang) => `<link rel="alternate" hreflang="${lang}" href="${escapeHtml(url + (lang === 'en' ? '?lang=en' : ''))}">`)
    .replace(/<meta (property|name)="(og|twitter):(title|description|url)" content="[^"]*"\s*\/?>/g, (_tag, attr, prefix, key) => `<meta ${attr}="${prefix}:${key}" content="${escapeHtml(key === 'title' ? title : key === 'description' ? description : canonical)}">`)
    .replace(/<script id="kaissa-schema" type="application\/ld\+json">.*?<\/script>/s, '')
    .replace(/<noscript>.*?<\/noscript>/s, `<noscript><main><h1>${escapeHtml(title)}</h1><p>${escapeHtml(description)}</p><a href="/leaderboard${en ? '?lang=en' : ''}">${en ? 'Player ratings' : 'Рейтинг игроков'}</a></main></noscript>`);
  res.setHeader('X-Robots-Tag', robots);
  res.type('html').send(html);
}));

profilePages.get(['/players', '/players/', '/players/*'], (_req, res) => {
  sendProfileNotFound(res);
});
