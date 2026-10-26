import { beforeEach, describe, expect, it } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { createApp } from "vue";
import { usePageSeo } from "../src/composables/useSeo";
beforeEach(() => {
  setActivePinia(createPinia());
});
describe("SEO locale consistency", () => {
  it("changes canonical and fallback descriptions when the active language changes", () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    pinia.state.value.i18n = { locale: "ru" };
    const app = createApp({});
    app.use(pinia);
    const seo = app.runWithContext(() => usePageSeo({ canonical: "/history" }));
    expect(seo.canonical.value).toBe("https://duochess.ru/history");
    expect(seo.description.value).toContain("Архив");
    pinia.state.value.i18n.locale = "en";
    expect(seo.canonical.value).toBe("https://duochess.ru/history?lang=en");
    expect(seo.description.value).toContain("Explore");
  });
});
