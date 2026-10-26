<script setup lang="ts">
import { useRoute } from "vue-router";
import { useAuthStore } from "../stores/auth";
import { useI18n } from "../stores/i18n";
defineProps<{ compact?: boolean }>();
const auth = useAuthStore();
const route = useRoute();
const i18n = useI18n();
</script>
<template>
  <aside
    v-if="auth.user?.isGuest"
    class="guest-notice"
    :class="{ compact }"
    :aria-label="i18n.locale === 'en' ? 'Guest account' : 'Гостевой аккаунт'"
  >
    <div>
      <strong>{{
        i18n.locale === "en" ? "Keep your games" : "Сохраните свои партии"
      }}</strong>
      <p v-if="!compact">
        {{
          i18n.locale === "en"
            ? "You are a guest. Access is tied to this browser and may expire. Choose a name and password to return from any device. Your history stays with you."
            : "Вы играете как гость. Доступ связан с этим браузером и может истечь. Придумайте ник и пароль, чтобы возвращаться с любого устройства. История партий сохранится."
        }}
      </p>
    </div>
    <router-link
      class="button primary small"
      :to="{ name: 'login', query: { claim: '1', redirect: route.fullPath } }"
      >{{
        i18n.locale === "en" ? "Save account" : "Сохранить аккаунт"
      }}</router-link
    >
  </aside>
</template>
<style scoped>
.guest-notice.compact { margin:0 0 10px; padding:8px 12px; border-color:var(--line); }
.compact strong { font-size:13px; font-weight:500; color:var(--ink-2); }
.guest-notice {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
  padding: 14px 18px;
  border: 1px solid var(--accent);
  border-radius: 8px;
  margin: 12px 0;
  background: var(--bg);
}
p {
  margin: 4px 0 0;
  color: var(--ink-2);
  font-size: 13px;
  max-width: 650px;
}
</style>
