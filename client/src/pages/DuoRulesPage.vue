<script setup lang="ts">
import AppIcon from '../components/AppIcon.vue';
import CtaBanner from '../components/CtaBanner.vue';
import { usePageSeo } from '../composables/useSeo';

usePageSeo({
  title: 'Командные шахматы 2 на 2 на одной доске: правила игры',
  description:
    'Правила игры в командные шахматы 2 на 2 на одной доске: очередность ходов, командные часы и основы игры в паре на платформе Каисса.',
  canonical: '/rules/duo',
  keywords: ['командные шахматы 2х2', 'правила 2 на 2', 'duo chess', 'чередование ходов'],
});
</script>

<template>
  <article class="content-page" itemscope itemtype="https://schema.org/TechArticle">
    <!-- Хлебные крошки -->
    <nav class="breadcrumbs" aria-label="Хлебные крошки">
      <router-link to="/">
        <AppIcon name="chevron-left" :size="12" />
        Главная
      </router-link>
      <span class="sep">/</span>
      <span class="current" aria-current="page">Командные шахматы 2 на 2</span>
    </nav>

    <!-- Шапка статьи -->
    <header class="article-hero">
      <div class="article-meta-row">
        <span class="badge felt">2 на 2</span>
        <span class="badge brass">1 доска</span>
        <span class="hint">Время чтения: ~3 минуты</span>
      </div>
      <h1 itemprop="headline">Командные шахматы 2 на 2 на одной доске</h1>
      <p class="article-lead" itemprop="description">
        Простой и увлекательный формат: четыре игрока за одной доской.
        Напарники управляют одной армией фигур, делая ходы строго по очереди.
      </p>
    </header>

    <div class="article-content">
      <!-- Секция: Как это устроено -->
      <section class="article-section">
        <h2>
          <AppIcon name="book-open" :size="20" />
          Как устроена игра 2 на 2
        </h2>
        <p>
          Это классические шахматы на стандартной доске 8×8, но играют две команды по два человека:
        </p>
        <ul>
          <li><strong>Белые:</strong> Игрок 1 и Игрок 3</li>
          <li><strong>Чёрные:</strong> Игрок 2 и Игрок 4</li>
        </ul>
        <p>
          Цель стандартная — поставить мат королю соперника.
          Главный интерес в том, что вы играете одной позицией вдвоём и должны понимать замысел напарника по его ходам на доске.
        </p>

        <div class="callout-box felt">
          <h4>Без подсказок</h4>
          <p>
            Во время партии игроки не подсказывают друг другу ходы — всё решается прямо на доске через последовательность ваших действий.
          </p>
        </div>
      </section>

      <!-- Секция: Очередность ходов -->
      <section class="article-section">
        <h2>
          <AppIcon name="bolt" :size="20" />
          Очерёдность ходов и регламент
        </h2>

        <h3>1. Строгая поочерёдность</h3>
        <p>Ходы делаются строго по циклу:</p>
        <ol>
          <li>Белый 1</li>
          <li>Чёрный 1</li>
          <li>Белый 2</li>
          <li>Чёрный 2</li>
          <li>Снова Белый 1, Чёрный 1 и так далее.</li>
        </ol>
        <p>
          Сделать два хода подряд за свою команду нельзя: ход передаётся напарнику автоматически.
        </p>

        <h3>2. Командные часы</h3>
        <p>
          У каждой команды общее время на партию (например, 3+2 или 5+3). Время идёт, когда наступает ход любого из игроков команды.
          Добавление времени начисляется за каждый сделанный ход. Если время команды истекло — засчитывается поражение.
        </p>

        <h3>3. Правила шахмат</h3>
        <p>
          Все правила классических шахмат сохраняются: взятие на проходе, рокировка, превращение пешек.
          Партия завершается матом, сдачей, падением флажка или ничьей (пат, троекратное повторение позиции, правило 50 ходов).
        </p>
      </section>

      <!-- Секция: Советы по игре -->
      <section class="article-section">
        <h2>
          <AppIcon name="eye" :size="20" />
          Советы для игры в паре
        </h2>

        <h3>Играйте понятно для напарника</h3>
        <p>
          Старайтесь делать логичные, наглядные ходы. Слишком сложные многоходовки с «тихими» паузами напарник может не заметить, если он видит позицию иначе.
        </p>

        <h3>Следите за планом партнёра</h3>
        <p>
          Перед своим ходом посмотрите, какую фигуру развил или куда перевёл напарник, и поддержите эту линию атаки или защиты.
        </p>
      </section>

      <!-- Секция: FAQ -->
      <section class="article-section">
        <h2>
          <AppIcon name="message-square" :size="20" />
          Частые вопросы
        </h2>

        <div class="faq-list">
          <details class="faq-item" name="duo-faq">
            <summary class="faq-question">
              <span>Можно ли играть вдвоём с ботом в одной команде?</span>
              <AppIcon name="chevron-down" :size="16" class="faq-icon" />
            </summary>
            <div class="faq-answer">
              <p>
                Да, при создании или настройке стола можно добавить бота на свободное место, и он будет играть в паре с вами по очереди.
              </p>
            </div>
          </details>

          <details class="faq-item" name="duo-faq">
            <summary class="faq-question">
              <span>Что будет, если напарник отключился?</span>
              <AppIcon name="chevron-down" :size="16" class="faq-icon" />
            </summary>
            <div class="faq-answer">
              <p>
                Система даёт время на переподключение. Если игрок не вернулся до истечения времени на часах команды, засчитывается поражение по времени.
              </p>
            </div>
          </details>

          <details class="faq-item" name="duo-faq">
            <summary class="faq-question">
              <span>Как считается рейтинг?</span>
              <AppIcon name="chevron-down" :size="16" class="faq-icon" />
            </summary>
            <div class="faq-answer">
              <p>
                Рейтинг рассчитывается по стандартной формуле Elo на основе среднего рейтинга команд перед началом игры.
              </p>
            </div>
          </details>
        </div>
      </section>

      <!-- Интерактивный CTA-блок призыва к игре -->
      <CtaBanner
        title="Сыграть партию 2 на 2"
        subtitle="Создайте стол или присоединяйтесь к открытому лобби."
        current-mode="duo"
      />

      <!-- Перелинковка на другие разделы -->
      <section class="related-section">
        <h3>Другие разделы</h3>
        <div class="related-cards">
          <router-link to="/rules/bughouse" class="related-card">
            <span class="related-card-badge">Режим Bughouse</span>
            <h4>Шведские шахматы (Багхаус)</h4>
            <p>Две доски, передача срубленных фигур напарнику и выставление их на доску.</p>
            <span class="related-card-arrow">
              Правила багхауса
              <AppIcon name="arrow-right" :size="13" />
            </span>
          </router-link>

          <router-link to="/about" class="related-card">
            <span class="related-card-badge">О проекте</span>
            <h4>О платформе Каисса</h4>
            <p>Движок Stockfish, боты разных стилей и игра в реальном времени.</p>
            <span class="related-card-arrow">
              Подробнее
              <AppIcon name="arrow-right" :size="13" />
            </span>
          </router-link>

          <router-link to="/leaderboard" class="related-card">
            <span class="related-card-badge">Рейтинг Elo</span>
            <h4>Рейтинг игроков</h4>
            <p>Таблица игроков, статистика побед и сыгранных партий.</p>
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
