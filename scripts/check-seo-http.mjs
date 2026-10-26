import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const base = process.env.KAISSA_SEO_BASE_URL ?? "http://127.0.0.1:8417";
assert(
  /^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(base),
  "Only a local preview server is supported",
);
const pages = JSON.parse(
  readFileSync(
    new URL("../client/src/content/seo-pages.json", import.meta.url),
    "utf8",
  ),
);
const crazyhouse = JSON.parse(
  readFileSync(
    new URL("../client/src/content/crazyhouse.json", import.meta.url),
    "utf8",
  ),
);
const escape = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
for (const route of [...Object.keys(pages), "/rules/crazyhouse"])
  for (const locale of ["ru", "en"]) {
    const pathname = route + (locale === "en" ? "?lang=en" : "");
    const r = await fetch(base + pathname);
    const html = await r.text();
    assert.equal(r.status, 200, pathname);
    assert(r.headers.get("content-type")?.includes("text/html"));
    const content =
      route === "/rules/crazyhouse" ? crazyhouse[locale] : pages[route][locale];
    assert(
      html.includes(`<title>${escape(content.title)}</title>`),
      pathname + " title",
    );
    assert(html.includes(`<html lang="${locale}"`), pathname + " lang");
    assert(
      html.includes(`rel="canonical" href="https://duochess.ru${pathname}"`),
      pathname + " canonical",
    );
    assert.equal(
      r.headers.get("x-robots-tag"),
      route === "/login" ? "noindex, follow" : "index, follow",
      pathname + " robots",
    );
  }
for (const route of [
  "/login?claim=1",
  "/admin",
  "/lobby/QA1234",
  "/game/-1",
  "/replay/1",
]) {
  const r = await fetch(base + route);
  assert.equal(r.status, 200, route);
  assert.equal(r.headers.get("x-robots-tag"), "noindex, follow", route);
  await r.arrayBuffer();
}
const missing = await fetch(base + "/not-a-real-page-for-seo-test");
assert.equal(missing.status, 404);
assert.equal(missing.headers.get("x-robots-tag"), "noindex, follow");
await missing.arrayBuffer();
const redirect = await fetch(base + "/rules/duo/?lang=en", {
  redirect: "manual",
});
assert.equal(redirect.status, 301);
assert(redirect.headers.get("location")?.endsWith("/rules/duo?lang=en"));
await redirect.arrayBuffer();
const sitemap = await fetch(base + "/sitemap.xml");
assert.equal(sitemap.status, 200);
const xml = await sitemap.text();
assert(!xml.includes("/login</loc>"));
assert(!xml.includes("/players/Guest_"));
assert(xml.includes("/rules/crazyhouse</loc>"));
const robots = await (await fetch(base + "/robots.txt")).text();
assert(robots.includes("Disallow: /api/"));
assert(!robots.includes("Disallow: /lobby/"));
const og = await fetch(base + "/og-image.png");
assert.equal(og.status, 200);
assert(og.headers.get("content-type")?.includes("image/png"));
await og.arrayBuffer();
console.log(
  "OK: Nginx serves 16 localized public pages, correct canonical/robots headers, transient noindex routes, real 404, query-preserving redirect, sitemap, robots and OG image",
);
