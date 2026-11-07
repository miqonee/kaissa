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
      ["/login", "/history"].includes(route) ? "noindex, follow" : "index, follow",
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
for (const notFoundRoute of [
  "/not-a-real-page-for-seo-test",
  "/not-a-real-dir-for-seo-test/",
  "/assets/",
  "/pieces/",
  "/board/",
]) {
  const missing = await fetch(base + notFoundRoute, { redirect: "manual" });
  assert.equal(missing.status, 404, `${notFoundRoute} must return 404 directly without redirect`);
  assert.equal(missing.headers.get("x-robots-tag"), "noindex, follow", `${notFoundRoute} x-robots-tag`);
  await missing.arrayBuffer();
}
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
assert(xml.includes("/rules/multiplayer</loc>"));
const robots = await (await fetch(base + "/robots.txt")).text();
assert(robots.includes("Disallow: /api/"));
assert(robots.includes("Allow: /favicon.ico"));
assert(!robots.includes("Disallow: /lobby/"));
for (const [iconPath, mime] of [
  ["/favicon.ico", "image/"],
  ["/favicon.svg", "image/svg+xml"],
  ["/favicon-120x120.png", "image/png"],
  ["/og-image.png", "image/png"],
]) {
  const iconRes = await fetch(base + iconPath);
  assert.equal(iconRes.status, 200, iconPath);
  assert(iconRes.headers.get("content-type")?.includes(mime), `${iconPath} content-type`);
  await iconRes.arrayBuffer();
}
console.log(
  "OK: Nginx serves 16 localized public pages, correct canonical/robots headers, transient noindex routes, real 404 (including trailing slash and asset dirs), query-preserving redirect, sitemap, robots, favicons and OG image",
);
