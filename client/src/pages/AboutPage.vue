<script setup lang="ts">
import { computed } from 'vue';
import AppIcon from '../components/AppIcon.vue';
import CtaBanner from '../components/CtaBanner.vue';
import { usePageSeo } from '../composables/useSeo';
import { useI18n } from '../stores/i18n';

const i18n = useI18n();

usePageSeo({
  title: computed(() => (i18n.locale === 'en' ? `About Kaissa: 2v2 and Bughouse Chess Platform` : 'О платформе Каисса: командные шахматы 2 на 2 и Багхаус онлайн')),
  description: computed(() => (i18n.locale === 'en' ? 'Kaissa is a collaborative team chess platform for 2v2 on one board and Bughouse with Stockfish WASM bots.' : 'Платформа Каисса — современный шахматный клуб для командных шахмат 2х2 и багхауса в реальном времени. Рейтинг Elo, боты на базе Stockfish WASM, открытый код.')),
  canonical: '/about',
  keywords: ['о платформе каисса', 'шахматная платформа', 'командные шахматы онлайн', 'stockfish шахматы', 'kaissa chess'],
});
</script>

<template>
  <article class="content-page" itemscope itemtype="https://schema.org/AboutPage">
    <!-- Хлебные крошки -->
    <nav class="breadcrumbs" aria-label="Хлебные крошки">
      <router-link to="/">
        <AppIcon name="chevron-left" :size="12" />
        {{ i18n.locale === 'en' ? 'Home' : 'Главная' }}
      </router-link>
      <span class="sep">/</span>
      <span class="current" aria-current="page">{{ i18n.t.footer.about }}</span>
    </nav>

    <!-- Шапка страницы -->
    <header class="article-hero">
      <div class="article-meta-row">
        <span class="badge felt">{{ i18n.locale === 'en' ? 'Team Chess' : 'Командные шахматы' }}</span>
        <span class="badge brass">{{ i18n.locale === 'en' ? '2v2 & Bughouse' : '2×2 и Багхаус' }}</span>
      </div>
      <h1 itemprop="headline">{{ i18n.locale === 'en' ? 'About Kaissa Platform' : 'О платформе Каисса' }}</h1>
      <p class="article-lead" itemprop="description">
        {{ i18n.locale === 'en'
          ? 'Kaissa is a modern collaborative platform for 4-player team chess. Play in pairs on a single board (2v2) or Bughouse with live piece drops.'
          : 'Каисса — площадка для игры в шахматы вчетвером. Здесь можно играть парами 2 на 2 на одной доске или в шведские шахматы (багхаус) с обменом сбитыми фигурами.' }}
      </p>
    </header>

    <div class="article-content">
      <!-- Английская версия статьи -->
      <template v-if="i18n.locale === 'en'">
        <section class="article-section">
          <h2>
            <AppIcon name="bolt" :size="20" />
            Game Formats
          </h2>

          <h3>1. 2v2 Single Board (Duo)</h3>
          <p>
            Four players divide into two teams of two, playing on a single standard chessboard.
            Moves rotate cyclically: White 1, Black 1, White 2, Black 2.
            No verbal hints allowed — cooperation is built purely by reading the board and understanding your teammate's strategy.
          </p>
          <p>
            <router-link to="/rules/duo" class="button ghost small">
              {{ i18n.t.footer.rulesDuo }}
              <AppIcon name="arrow-right" :size="12" />
            </router-link>
          </p>

          <h3>2. Bughouse Chess</h3>
          <p>
            Two boards played simultaneously in pairs. When you capture an opponent's piece, it is immediately transferred into your teammate's pocket (reserve), and they can drop it onto any open square on their board!
          </p>
          <p>
            <router-link to="/rules/bughouse" class="button ghost small">
              {{ i18n.t.footer.rulesBughouse }}
              <AppIcon name="arrow-right" :size="12" />
            </router-link>
          </p>
        </section>

        <section class="article-section">
          <h2>
            <AppIcon name="crown" :size="20" />
            Platform Capabilities
          </h2>

          <h3>Realtime Multiplayer</h3>
          <p>
            Ultra-fast WebSocket synchronization, precise clocks, auto-reconnect on brief disconnections, and move-by-move match replays.
          </p>

          <h3>Stockfish AI Bots</h3>
          <p>
            When waiting for players in 2v2, empty seats can be filled by 12 distinct AI bot personalities inspired by legendary chess champions, from tactical romantic Mikhail Tal to endgame master Magnus Carlsen.
          </p>

          <h3>Elo Rating & Match History</h3>
          <p>
            Ratings are updated using the standard Elo formula balancing team strength. Every completed game is saved to the club archive with PGN download and one-click Lichess Stockfish analysis.
          </p>
        </section>

        <section class="article-section">
          <h2>
            <AppIcon name="book-open" :size="20" />
            Fair Play
          </h2>
          <p>We believe in respectful and sportsmanlike conduct:</p>
          <ul>
            <li><strong>No Engines:</strong> External assistance or cheating programs are strictly prohibited.</li>
            <li><strong>Team Spirit:</strong> Support your teammates — you share the outcome together.</li>
            <li><strong>Play to the Finish:</strong> Please do not abandon matches early to maintain high quality games.</li>
          </ul>
        </section>
      </template>

      <!-- Русская версия статьи -->
      <template v-else>
        <!-- Секция: Основные форматы -->
        <section class="article-section">
          <h2>
            <AppIcon name="bolt" :size="20" />
            Форматы игры
          </h2>

          <h3>1. 2 на 2 на одной доске (Duo)</h3>
          <p>
            Четыре игрока делятся на две команды по два человека и играют на одной обычной шахматной доске.
            Ходы делаются поочерёдно: Белый 1, Чёрный 1, Белый 2, Чёрный 2.
            Подсказывать нельзя — нужно понимать позицию и идеи напарника прямо по ходу партии.
          </p>
          <p>
            <router-link to="/rules/duo" class="button ghost small">
              Правила 2 на 2
              <AppIcon name="arrow-right" :size="12" />
            </router-link>
          </p>

          <h3>2. Шведские шахматы (Багхаус)</h3>
          <p>
            Игра на двух досках пара на пару. Фигура, срубленная вами, переходит в резерв (карман) напарника,
            и он может выставить её на свою доску вместо хода.
          </p>
          <p>
            <router-link to="/rules/bughouse" class="button ghost small">
              Правила багхауса
              <AppIcon name="arrow-right" :size="12" />
            </router-link>
          </p>
        </section>

        <!-- Секция: Возможности -->
        <section class="article-section">
          <h2>
            <AppIcon name="crown" :size="20" />
            Возможности платформы
          </h2>

          <h3>Игра в реальном времени</h3>
          <p>
            Быстрый отклик по WebSocket, синхронизация часов, авто-реконнект при кратковременном обрыве связи и реплеи всех сыгранных партий.
          </p>

          <h3>ИИ-боты разного уровня</h3>
          <p>
            Если не хватает игроков для полной партии 2х2, свободные места можно занять ботами разного уровня мастерства и стилей игры.
          </p>

          <h3>Рейтинг Elo и статистика</h3>
          <p>
            Рейтинг рассчитывается по системе Elo на основе баланса команд. Можно отслеживать историю своих игр и личную статистику.
          </p>
        </section>

        <!-- Секция: Честная игра -->
        <section class="article-section">
          <h2>
            <AppIcon name="book-open" :size="20" />
            Честная игра (Fair Play)
          </h2>
          <p>
            Мы ценим уважительное отношение между игроками:
          </p>
          <ul>
            <li><strong>Без движков:</strong> Использование сторонних программ для подсказок строго запрещено.</li>
            <li><strong>Командный настрой:</strong> Поддерживайте напарников — вы играете за один результат.</li>
            <li><strong>Игра до конца:</strong> Не выходите из партии намеренно, чтобы не подводить товарища по команде.</li>
          </ul>
        </section>
      </template>

      <!-- Интерактивный CTA-блок -->
      <CtaBanner
        :title="i18n.locale === 'en' ? 'Ready to Play?' : 'Сыграть партию'"
        :subtitle="i18n.locale === 'en' ? 'Join a lobby or create your own table to play with friends or AI bots.' : 'Заходите в лобби или создайте свой стол для игры с друзьями или ботами.'"
        current-mode="about"
      />

      <!-- Перелинковка на правила и разделы -->
      <section class="related-section">
        <h3>{{ i18n.locale === 'en' ? 'Explore Site' : 'Разделы сайта' }}</h3>
        <div class="related-cards">
          <router-link to="/rules/duo" class="related-card">
            <span class="related-card-badge">{{ i18n.locale === 'en' ? 'Rules' : 'Правила' }}</span>
            <h4>{{ i18n.t.footer.rulesDuo }}</h4>
            <p>{{ i18n.locale === 'en' ? 'Move rotation, team clocks, and pair tactics.' : 'Чередование ходов, командные часы и правила игры в паре.' }}</p>
            <span class="related-card-arrow">
              {{ i18n.locale === 'en' ? 'Read Rules' : 'Читать правила' }}
              <AppIcon name="arrow-right" :size="13" />
            </span>
          </router-link>

          <router-link to="/rules/bughouse" class="related-card">
            <span class="related-card-badge">{{ i18n.locale === 'en' ? 'Rules' : 'Правила' }}</span>
            <h4>{{ i18n.t.footer.rulesBughouse }}</h4>
            <p>{{ i18n.locale === 'en' ? 'Two boards, pocket reserves, drops, and team tactics.' : 'Две доски, карман фигур, дропы и тактика взаимодействия.' }}</p>
            <span class="related-card-arrow">
              {{ i18n.locale === 'en' ? 'Read Rules' : 'Читать правила' }}
              <AppIcon name="arrow-right" :size="13" />
            </span>
          </router-link>

          <router-link to="/leaderboard" class="related-card">
            <span class="related-card-badge">{{ i18n.locale === 'en' ? 'Leaderboard' : 'Рейтинг' }}</span>
            <h4>{{ i18n.t.nav.leaderboard }}</h4>
            <p>{{ i18n.locale === 'en' ? 'Player rankings, win rates, and statistics.' : 'Таблица лидеров и статистика побед.' }}</p>
            <span class="related-card-arrow">
              {{ i18n.locale === 'en' ? 'View Leaderboard' : 'Смотреть' }}
              <AppIcon name="arrow-right" :size="13" />
            </span>
          </router-link>
        </div>
      </section>
    </div>
  </article>
</template>
