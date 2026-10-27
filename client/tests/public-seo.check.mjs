import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
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
    const json = JSON.parse(
      html.match(
        /<script[^>]*type="application\/ld\+json">([\s\S]*?)<\/script>/,
      )[1],
    );
    assert.equal(json[0].url, url);
    assert.equal(json[0].inLanguage, locale);
  }
console.log(
  "OK: all public RU/EN HTML pages have matching metadata, canonical, alternates, structured data and content; login is noindex",
);
