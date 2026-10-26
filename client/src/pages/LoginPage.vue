<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import { useI18n } from '../stores/i18n';
import { usePageSeo } from '../composables/useSeo';

const auth = useAuthStore();
const router = useRouter();
const route = useRoute();
const i18n = useI18n();

usePageSeo({ canonical: '/login' });

const mode = ref<'login' | 'register'>(route.query.claim === '1' ? 'register' : 'login');
const username = ref('');
const password = ref('');
const error = ref(route.query.guestError ? (i18n.locale === 'en' ? 'Could not start a guest session. Please try again.' : 'Не удалось открыть гостевую сессию. Попробуйте ещё раз.') : '');
const busy = ref(false);

async function submit() {
  error.value = '';
  busy.value = true;
  try {
    if (mode.value === 'login') {
      await auth.login(username.value.trim(), password.value);
    } else {
      await auth.register(username.value.trim(), password.value);
    }
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/';
    router.push(redirect.startsWith('/') && !redirect.startsWith('//') ? redirect : '/');
  } catch (e) {
    error.value = e instanceof Error ? e.message : (i18n.locale === 'en' ? 'Authentication error' : 'Ошибка');
  } finally {
    busy.value = false;
  }
}
async function playAsGuest() {
  busy.value = true; error.value = '';
  try {
    await auth.ensureGuest();
    const target = typeof route.query.redirect === 'string' ? route.query.redirect : '/?action=quick';
    router.push(target.startsWith('/') && !target.startsWith('//') ? target : '/');
  } catch (e) { error.value = e instanceof Error ? e.message : 'Ошибка'; }
  finally { busy.value = false; }
}
</script>

<template>
  <div class="login-wrap">
    <section class="login-panel panel" aria-labelledby="login-title">
      <div class="login-head">
        <h1 id="login-title">{{ auth.user?.isGuest && mode === 'register' ? (i18n.locale === 'en' ? 'Save your account' : 'Сохраните аккаунт') : i18n.t.nav.brand }}</h1>
        <p>{{ i18n.t.footer.brandDesc }}</p>
      </div>
      <p v-if="auth.user?.isGuest" class="dim">{{ i18n.locale === 'en' ? 'Choose a name and password to keep this guest’s games. Signing into another account does not merge histories.' : 'Ник и пароль сохранят партии этого гостя. Вход в другой аккаунт не объединяет истории.' }}</p>
      <form @submit.prevent="submit">
        <div class="form-row">
          <label class="field-label" for="username">{{ i18n.t.login.usernameLabel }}</label>
          <input id="username" v-model="username" autocomplete="username" :placeholder="i18n.locale === 'en' ? 'e.g. fischer' : 'например, kasparov'" required />
        </div>
        <div class="form-row">
          <label class="field-label" for="password">{{ i18n.t.login.passwordLabel }}</label>
          <input id="password" v-model="password" :minlength="mode === 'register' ? 8 : undefined" type="password" :autocomplete="mode === 'register' ? 'new-password' : 'current-password'" required />
        </div>
        <p v-if="error" class="error-text">{{ error }}</p>
        <button class="primary block" type="submit" :disabled="busy">
          {{ busy ? (i18n.locale === 'en' ? 'Please wait…' : 'Секунду…') : mode === 'login' ? i18n.t.login.loginSubmit : auth.user?.isGuest ? (i18n.locale === 'en' ? 'Save account' : 'Сохранить аккаунт') : i18n.t.login.registerSubmit }}
        </button>
      </form>
      <button v-if="!auth.user" class="block ghost" :disabled="busy" @click="playAsGuest">{{ i18n.locale === 'en' ? 'Play as guest' : 'Играть гостем без регистрации' }}</button>
      <p class="switch-mode">
        <template v-if="mode === 'login'">
          {{ i18n.locale === 'en' ? "Don't have an account?" : 'Нет аккаунта?' }}
          <a href="#" @click.prevent="mode = 'register'">{{ i18n.locale === 'en' ? 'Register now' : 'Зарегистрируйтесь' }}</a>
        </template>
        <template v-else>
          {{ i18n.locale === 'en' ? 'Already have an account?' : 'Уже есть аккаунт?' }}
          <a href="#" @click.prevent="mode = 'login'">{{ i18n.locale === 'en' ? 'Sign In' : 'Войти' }}</a>
        </template>
      </p>
    </section>
  </div>
</template>

<style scoped>
.login-wrap {
  display: flex;
  justify-content: center;
  padding-top: 8vh;
}

.login-panel {
  width: 380px;
  padding: 28px;
}

.login-head {
  text-align: center;
  margin-bottom: 22px;
}

.login-head p {
  color: var(--ink-3);
  margin: 6px 0 0;
  font-size: 14px;
}

.switch-mode {
  text-align: center;
  font-size: 13px;
  color: var(--ink-2);
  margin: 16px 0 0;
}

.block { width: 100%; }
</style>
