import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
const content = JSON.parse(
  readFileSync(
    new URL("../src/content/seo-pages.json", import.meta.url),
    "utf8",
  ),
);
const escape = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
for (const [route, variants] of Object.entries(content))
  for (const locale of ["ru", "en"]) {
    const file =
      route === "/"
        ? `index${locale === "en" ? ".en" : ""}.html`
        : `${route.slice(1)}${locale === "en" ? ".en" : ""}.html`;
    const html = readFileSync(
      new URL("../dist/" + file, import.meta.url),
      "utf8",
    );
    const url =
      "https://duochess.ru" + route + (locale === "en" ? "?lang=en" : "");
    assert(html.includes(`<html lang="${locale}"`), `${file}: lang`);
    assert.equal((html.match(/<title>/g) ?? []).length, 1);
    assert(
      html.includes(`<title>${escape(variants[locale].title)}</title>`),
      `${file}: title`,
    );
    assert(
      html.includes(
        `name="description" content="${escape(variants[locale].description)}"`,
      ),
      `${file}: description`,
    );
    assert(
      html.includes(`rel="canonical" href="${url}"`),
      `${file}: canonical`,
    );
    assert(
      html.includes(`property="og:url" content="${escape(url)}"`),
      `${file}: OG URL`,
    );
    assert(
      html.includes(`hreflang="en" href="https://duochess.ru${route}?lang=en"`),
      `${file}: alternate`,
    );
    assert(
      html.includes(
        `name="robots" content="${["/login", "/history"].includes(route) ? "noindex, follow" : "index, follow"}"`,
      ),
      `${file}: robots`,
    );
    assert(
      html.includes(`<h1>${escape(variants[locale].heading)}</h1>`),
      `${file}: readable HTML`,
    );
    // Favicons must be present and located before any <script> in <head>
    const faviconIcoIdx = html.indexOf('href="/favicon.ico"');
    const faviconSvgIdx = html.indexOf('href="/favicon.svg"');
    const favicon120Idx = html.indexOf('href="/favicon-120x120.png"');
    const firstScriptIdx = html.indexOf("<script");
    assert(faviconIcoIdx > 0 && faviconIcoIdx < firstScriptIdx, `${file}: favicon.ico before scripts`);
    assert(faviconSvgIdx > 0 && faviconSvgIdx < firstScriptIdx, `${file}: favicon.svg before scripts`);
    assert(favicon120Idx > 0 && favicon120Idx < firstScriptIdx, `${file}: favicon-120x120.png before scripts`);

    const json = JSON.parse(
      html.match(
        /<script[^>]*type="application\/ld\+json">([\s\S]*?)<\/script>/,
      )[1],
    );
    assert.equal(json[0].url, url);
    assert.equal(json[0].inLanguage, locale);
    assert.equal(json[0].image, "https://duochess.ru/favicon-512x512.png");
  }

for (const asset of [
  "favicon.ico",
  "favicon.svg",
  "favicon-16x16.png",
  "favicon-32x32.png",
  "favicon-48x48.png",
  "favicon-96x96.png",
  "favicon-120x120.png",
  "favicon-192x192.png",
  "favicon-512x512.png",
  "apple-touch-icon.png",
  "404.html",
]) {
  assert(
    existsSync(new URL("../dist/" + asset, import.meta.url)),
    `dist/${asset} exists`,
  );
}
const html404 = readFileSync(new URL("../dist/404.html", import.meta.url), "utf8");
assert(html404.includes('name="robots" content="noindex, follow"'), "404.html robots meta");
assert(html404.includes('href="/favicon-120x120.png"'), "404.html favicon 120x120");
assert(html404.includes('href="/rules/multiplayer"'), "404.html multiplayer link");

console.log(
  "OK: all public RU/EN HTML pages have matching metadata, favicons before scripts, canonical, alternates, structured data and content; 404.html and favicon assets verified",
);
