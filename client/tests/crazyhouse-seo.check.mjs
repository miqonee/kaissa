import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const content = JSON.parse(readFileSync(new URL('../src/content/crazyhouse.json', import.meta.url), 'utf8'));
for (const locale of ['ru', 'en']) {
  const html = readFileSync(new URL(`../dist/rules/crazyhouse${locale === 'en' ? '.en' : ''}.html`, import.meta.url), 'utf8');
  assert(html.includes(`<html lang="${locale}"`));
  assert(html.includes(`<title>${content[locale].title}</title>`));
  assert(html.includes(`<link rel="canonical" href="https://duochess.ru/rules/crazyhouse${locale === 'en' ? '?lang=en' : ''}"`));
  assert(html.includes('hreflang="ru" href="https://duochess.ru/rules/crazyhouse"'));
  assert(html.includes('hreflang="en" href="https://duochess.ru/rules/crazyhouse?lang=en"'));
  const noscript = [...html.matchAll(/<noscript>([\s\S]*?)<\/noscript>/g)].map(m => m[1]).find(text => text.includes('<h1>')); assert(noscript);
  assert.equal((noscript.match(/<h1>/g) ?? []).length, 1);
  for (const field of ['heading', 'intro', 'team', 'end', 'start']) assert(noscript.includes(content[locale][field]), field);
  for (const example of content[locale].examples) assert(noscript.includes(example.caption));
  const schema = JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
  assert.equal(schema[0].inLanguage, locale);
}
console.log('OK: Crazyhouse prerender includes complete RU/EN rules, examples, canonical and hreflang');
