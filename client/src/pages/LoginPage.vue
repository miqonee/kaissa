<script setup lang="ts">
import { ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import { resetSocket } from '../api/socket';

const auth = useAuthStore();
const router = useRouter();
const route = useRoute();

const mode = ref<'login' | 'register'>('login');
const username = ref('');
const password = ref('');
const error = ref('');
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
    // сокет мог существовать до логина — пересоздать с новой cookie-сессией
    resetSocket();
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/';
    router.push(redirect);
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Ошибка';
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <div class="login-wrap">
    <div class="login-panel panel">
      <div class="login-head">
        <h1>Каисса</h1>
        <p>Командные шахматы 2×2 и багхаус</p>
      </div>
      <form @submit.prevent="submit">
        <div class="form-row">
          <label class="field-label" for="username">Имя игрока</label>
          <input id="username" v-model="username" autocomplete="username" placeholder="например, kasparov" required />
        </div>
        <div class="form-row">
          <label class="field-label" for="password">Пароль</label>
          <input id="password" v-model="password" type="password" autocomplete="current-password" required />
        </div>
        <p v-if="error" class="error-text">{{ error }}</p>
        <button class="primary block" type="submit" :disabled="busy">
          {{ busy ? 'Секунду…' : mode === 'login' ? 'Войти' : 'Зарегистрироваться' }}
        </button>
      </form>
      <p class="switch-mode">
        <template v-if="mode === 'login'">
          Нет аккаунта?
          <a href="#" @click.prevent="mode = 'register'">Зарегистрируйтесь</a>
        </template>
        <template v-else>
          Уже есть аккаунт?
          <a href="#" @click.prevent="mode = 'login'">Войти</a>
        </template>
      </p>
    </div>
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
