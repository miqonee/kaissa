import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const clientDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const distDir = path.join(clientDir, "dist");
const baseHtml = fs.readFileSync(path.join(distDir, "index.html"), "utf8");
const pages = JSON.parse(
  fs.readFileSync(path.join(clientDir, "src/content/seo-pages.json"), "utf8"),
);
const crazyhouse = JSON.parse(
  fs.readFileSync(path.join(clientDir, "src/content/crazyhouse.json"), "utf8"),
);
const domain = "https://duochess.ru";
const escape = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const canonical = (route, locale) =>
  domain + route + (locale === "en" ? "?lang=en" : "");
const links = (locale) => {
  const en = locale === "en";
  return `<nav aria-label="${en ? "Explore Kaissa" : "Разделы Каиссы"}"><a href="/${en ? "?lang=en" : ""}">${en ? "Play" : "Играть"}</a> · ${[
    ["/rules/duo", "2×2"],
    ["/rules/bughouse", en ? "Bughouse" : "Багхаус"],
    ["/rules/crazyhouse", "Crazyhouse"],
    ["/leaderboard", en ? "Ratings" : "Рейтинг"],
    ["/history", en ? "Game archive" : "Архив"],
    ["/about", en ? "About" : "О клубе"],
  ]
    .map(
      ([route, title]) =>
        `<a href="${route}${en ? "?lang=en" : ""}">${title}</a>`,
    )
    .join(" · ")}</nav>`;
};
function content(page, route, locale) {
  if (route === "/rules/crazyhouse") {
    const c = crazyhouse[locale];
    return `<main><h1>${escape(c.heading)}</h1><p>${escape(c.intro)}</p><h2>${escape(c.formatsTitle)}</h2><p>${escape(c.solo)}</p><p>${escape(c.team)}</p><p>${escape(c.difference)}</p><h2>${escape(c.rulesTitle)}</h2><ul>${c.rules.map((rule) => `<li>${escape(rule)}</li>`).join("")}</ul><h2>${escape(c.examplesTitle)}</h2>${c.examples.map((e) => `<section><h3>${escape(e.title)}</h3><p>${escape(e.caption)}</p></section>`).join("")}<h2>${escape(c.endTitle)}</h2><p>${escape(c.end)}</p><h2>${escape(c.startTitle)}</h2><p>${escape(c.start)}</p><a href="/?action=quick&amp;mode=crazyhouse${locale === "en" ? "&amp;lang=en" : ""}">${escape(c.playSolo)}</a> · <a href="/?action=quick&amp;mode=crazyhouse-team${locale === "en" ? "&amp;lang=en" : ""}">${escape(c.playTeam)}</a>${links(locale)}</main>`;
  }
  return `<main><h1>${escape(page.heading)}</h1><p>${escape(page.intro)}</p>${page.sections.map((s) => `<section><h2>${escape(s.heading)}</h2>${s.paragraphs.map((p) => `<p>${escape(p)}</p>`).join("")}</section>`).join("")}${links(locale)}</main>`;
}
function schemaFor(page, route, locale) {
  const url = canonical(route, locale);
  const result = [
    {
      "@context": "https://schema.org",
      "@type": route === "/" ? "WebSite" : "WebPage",
      name: page.title,
      description: page.description,
      url,
      inLanguage: locale,
    },
  ];
  if (route === "/")
    result.push({
      "@context": "https://schema.org",
      "@type": "WebApplication",
      name: locale === "en" ? "Kaissa" : "Каисса",
      url,
      description: page.description,
      applicationCategory: "GameApplication",
      operatingSystem: "Any",
      browserRequirements: "Requires JavaScript",
      offers: { "@type": "Offer", price: "0", priceCurrency: "RUB" },
      inLanguage: locale,
      image: `${domain}/og-image.png`,
    });
  else
    result.push({
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        {
          "@type": "ListItem",
          position: 1,
          name: locale === "en" ? "Home" : "Главная",
          item: canonical("/", locale),
        },
        {
          "@type": "ListItem",
          position: 2,
          name: page.heading ?? page.title,
          item: url,
        },
      ],
    });
  return result;
}
function render(page, route, locale) {
  const url = canonical(route, locale);
  let html = baseHtml
    .replace(/<html lang="[^"]*"/, `<html lang="${locale}"`)
    .replace(/<title>.*?<\/title>/s, `<title>${escape(page.title)}</title>`);
  const setMeta = (attr, name, value) => {
    const regex = new RegExp(
      `<meta\\s+${attr}="${name}"\\s+content="[^"]*"\\s*/?>`,
      "i",
    );
    const tag = `<meta ${attr}="${name}" content="${escape(value)}" />`;
    html = regex.test(html)
      ? html.replace(regex, tag)
      : html.replace("</head>", `    ${tag}\n  </head>`);
  };
  setMeta("name", "description", page.description);
  setMeta(
    "name",
    "robots",
    ["/login", "/history"].includes(route) ? "noindex, follow" : "index, follow",
  );
  setMeta(
    "name",
    "keywords",
    locale === "en"
      ? "team chess, bughouse, crazyhouse, 2v2 chess, Kaissa"
      : "командные шахматы, багхаус, crazyhouse, шахматы 2 на 2, Каисса",
  );
  for (const prefix of ["og", "twitter"]) {
    const attr = prefix === "og" ? "property" : "name";
    setMeta(attr, `${prefix}:title`, page.title);
    setMeta(attr, `${prefix}:description`, page.description);
  }
  setMeta("property", "og:url", url);
  setMeta("property", "og:locale", locale === "en" ? "en_US" : "ru_RU");
  setMeta(
    "property",
    "og:locale:alternate",
    locale === "en" ? "ru_RU" : "en_US",
  );
  setMeta("property", "og:site_name", locale === "en" ? "Kaissa" : "Каисса");
  html = html.replace(
    /<link\s+rel="canonical"\s+href="[^"]*"\s*\/?>/i,
    `<link rel="canonical" href="${url}" />`,
  );
  for (const lang of ["ru", "en", "x-default"])
    html = html.replace(
      new RegExp(
        `<link\\s+rel="alternate"\\s+hreflang="${lang}"\\s+href="[^"]*"\\s*/?>`,
        "i",
      ),
      `<link rel="alternate" hreflang="${lang}" href="${canonical(route, lang === "en" ? "en" : "ru")}" />`,
    );
  html = html.replace(
    /<script\s+(?:id="kaissa-schema"\s+)?type="application\/ld\+json">.*?<\/script>/s,
    `<script id="kaissa-schema" type="application/ld+json">${JSON.stringify(schemaFor(page, route, locale)).replace(/</g, "\\u003c")}</script>`,
  );
  html = html.replace(
    /<!-- Семантический контент для поисковых ботов и пользователей без JS -->\s*<noscript>.*?<\/noscript>/s,
    `<!-- Семантический контент для поисковых ботов и пользователей без JS -->\n<noscript>${content(page, route, locale)}</noscript>`,
  );
  return html;
}
const routes = [...Object.keys(pages), "/rules/crazyhouse"];
for (const route of routes)
  for (const locale of ["ru", "en"]) {
    const page =
      route === "/rules/crazyhouse" ? crazyhouse[locale] : pages[route][locale];
    const file =
      route === "/"
        ? `index${locale === "en" ? ".en" : ""}.html`
        : `${route.slice(1)}${locale === "en" ? ".en" : ""}.html`;
    const target = path.join(distDir, file);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, render(page, route, locale));
  }
console.log(
  `[prerender] Rendered ${routes.length} routes in RU and EN (${routes.length * 2} HTML pages).`,
);
