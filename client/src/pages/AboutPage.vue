<script setup lang="ts">
import AppIcon from '../components/AppIcon.vue';
import CtaBanner from '../components/CtaBanner.vue';
import { usePageSeo } from '../composables/useSeo';

usePageSeo({
  title: 'О платформе Каисса — командные шахматы онлайн',
  description:
    'Каисса — онлайн-площадка для командных шахмат. Играйте 2х2 на одной доске или в шведские шахматы (багхаус) с друзьями и ботами.',
  canonical: '/about',
  keywords: ['каисса', 'командные шахматы', '2х2 шахматы', 'багхаус онлайн'],
});
</script>

<template>
  <article class="content-page" itemscope itemtype="https://schema.org/AboutPage">
    <!-- Хлебные крошки -->
    <nav class="breadcrumbs" aria-label="Хлебные крошки">
      <router-link to="/">
        <AppIcon name="chevron-left" :size="12" />
        Главная
      </router-link>
      <span class="sep">/</span>
      <span class="current" aria-current="page">О платформе</span>
    </nav>

    <!-- Шапка страницы -->
    <header class="article-hero">
      <div class="article-meta-row">
        <span class="badge felt">Командные шахматы</span>
        <span class="badge brass">2×2 и Багхаус</span>
      </div>
      <h1 itemprop="headline">О платформе Каисса</h1>
      <p class="article-lead" itemprop="description">
        Каисса — площадка для игры в шахматы вчетвером.
        Здесь можно играть парами 2 на 2 на одной доске или в шведские шахматы (багхаус) с обменом сбитыми фигурами.
      </p>
    </header>

    <div class="article-content">
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

      <!-- Интерактивный CTA-блок -->
      <CtaBanner
        title="Сыграть партию"
        subtitle="Заходите в лобби или создайте свой стол для игры с друзьями или ботами."
        current-mode="about"
      />

      <!-- Перелинковка на правила и разделы -->
      <section class="related-section">
        <h3>Разделы сайта</h3>
        <div class="related-cards">
          <router-link to="/rules/duo" class="related-card">
            <span class="related-card-badge">Правила</span>
            <h4>Командные шахматы 2х2</h4>
            <p>Чередование ходов, командные часы и правила игры в паре.</p>
            <span class="related-card-arrow">
              Читать правила
              <AppIcon name="arrow-right" :size="13" />
            </span>
          </router-link>

          <router-link to="/rules/bughouse" class="related-card">
            <span class="related-card-badge">Правила</span>
            <h4>Шведские шахматы</h4>
            <p>Две доски, карман фигур, дропы и тактика взаимодействия.</p>
            <span class="related-card-arrow">
              Читать правила
              <AppIcon name="arrow-right" :size="13" />
            </span>
          </router-link>

          <router-link to="/leaderboard" class="related-card">
            <span class="related-card-badge">Рейтинг</span>
            <h4>Рейтинг игроков</h4>
            <p>Таблица лидеров и статистика побед.</p>
            <span class="related-card-arrow">
              Смотреть
              <AppIcon name="arrow-right" :size="13" />
            </span>
          </router-link>
        </div>
      </section>
    </div>
  </article>
</template>
