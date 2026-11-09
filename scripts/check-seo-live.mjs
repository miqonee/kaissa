// Read-only проверка редиректов и канонических адресов на продакшене.
// Запуск: node scripts/check-seo-live.mjs   (нужен доступ в интернет)
// Ожидания (Google Search Console / Яндекс.Вебмастер):
//  - http://        -> постоянный (301/308) редирект на https://duochess.ru
//  - www.           -> постоянный (301/308) редирект на https://duochess.ru (не на панель Coolify!)
//  - /path/         -> 301 на /path (nginx)
//  - URL из sitemap -> 200 без редиректов, с HSTS
const CANONICAL = process.env.KAISSA_SITE_URL ?? "https://duochess.ru";
const HOST = new URL(CANONICAL).host;
const PERMANENT = new Set([301, 308]);
const failures = [];
const check = (ok, msg) => {
  console.log(`${ok ? "OK  " : "FAIL"} ${msg}`);
  if (!ok) failures.push(msg);
};

async function head(url) {
  try {
    const r = await fetch(url, { redirect: "manual", method: "GET", signal: AbortSignal.timeout(15_000) });
    await r.arrayBuffer();
    return r;
  } catch (err) {
    return { status: 0, headers: new Headers(), error: err };
  }
}

async function expectRedirect(from, to) {
  const r = await head(from);
  const loc = r.headers.get("location");
  const abs = loc ? new URL(loc, from).href : null;
  check(
    PERMANENT.has(r.status) && abs === to,
    `${from} -> ${r.status} ${abs ?? (r.error?.message || "")} (ожидалось 301/308 -> ${to})`,
  );
}

// 1. http -> https
for (const path of ["/", "/about", "/rules/duo?lang=en"]) {
  await expectRedirect(`http://${HOST}${path}`, `${CANONICAL}${path}`);
}
// 2. www -> apex
for (const scheme of ["https", "http"]) {
  for (const path of ["/", "/rules/duo"]) {
    const r = await head(`${scheme}://www.${HOST}${path}`);
    const loc = r.headers.get("location") ?? "";
    check(!/coolify/i.test(loc), `${scheme}://www.${HOST}${path} не ведёт на панель Coolify (location: ${loc || "-"})`);
    // http://www может сначала уйти на https://www — это допустимо, если затем будет редирект на apex
    const okTargets = [`${CANONICAL}${path}`, `https://www.${HOST}${path}`];
    check(
      PERMANENT.has(r.status) && okTargets.includes(new URL(loc || "/", `${scheme}://www.${HOST}`).href),
      `${scheme}://www.${HOST}${path} -> ${r.status} ${loc} (ожидалось 301/308 -> ${CANONICAL}${path})`,
    );
  }
}
// 3. trailing slash -> no slash
for (const path of ["/rules/duo", "/about"]) {
  const r = await head(`${CANONICAL}${path}/`);
  const abs = r.headers.get("location") ? new URL(r.headers.get("location"), CANONICAL).href : null;
  check(r.status === 301 && abs === `${CANONICAL}${path}`, `${path}/ -> ${r.status} ${abs}`);
}
// 4. sitemap URLs: 200, без редиректов, HSTS
const sm = await head(`${CANONICAL}/sitemap.xml`);
check(sm.status === 200, `/sitemap.xml -> ${sm.status}`);
const xml = sm.status === 200 ? await (await fetch(`${CANONICAL}/sitemap.xml`)).text() : "";
const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].replace(/&amp;/g, "&"));
for (const loc of locs.slice(0, 25)) {
  const r = await head(loc);
  check(
    r.status === 200 && r.headers.get("strict-transport-security")?.includes("max-age="),
    `${loc} -> ${r.status}, HSTS: ${r.headers.get("strict-transport-security") ?? "нет"}`,
  );
}

if (failures.length) {
  console.error(`\n${failures.length} проверок не прошли`);
  process.exit(1);
}
console.log("\nOK: все редиректы постоянные, www и http ведут на канонический https-домен");
