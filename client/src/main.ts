import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import { router } from './router';

// Базовая раскладка доски + фигуры cburnett из пакета chessground.
// Порядок важен: наши переопределения темы идут после.
import '@lichess-org/chessground/assets/chessground.base.css';
import '@lichess-org/chessground/assets/chessground.cburnett.css';
import './styles/main.css';

const app = createApp(App);

app.use(createPinia()).use(router).mount('#app');

