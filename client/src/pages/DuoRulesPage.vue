<script setup lang="ts">
import { computed } from 'vue';
import AppIcon from '../components/AppIcon.vue';
import CtaBanner from '../components/CtaBanner.vue';
import { usePageSeo } from '../composables/useSeo';
import { useI18n } from '../stores/i18n';

const i18n = useI18n();

usePageSeo({ canonical: '/rules/duo' });
</script>

<template>
  <article class="content-page" itemscope itemtype="https://schema.org/TechArticle">
    <!-- Хлебные крошки -->
    <nav class="breadcrumbs" aria-label="Хлебные крошки">
      <router-link to="/">
        <AppIcon name="chevron-left" :size="12" />
        {{ i18n.locale === 'en' ? 'Home' : 'Главная' }}
      </router-link>
      <span class="sep">/</span>
      <span class="current" aria-current="page">{{ i18n.t.footer.rulesDuo }}</span>
    </nav>

    <!-- Шапка статьи -->
    <header class="article-hero">
      <div class="article-meta-row">
        <span class="badge felt">{{ i18n.locale === 'en' ? '2 vs 2' : '2 на 2' }}</span>
        <span class="badge brass">{{ i18n.locale === 'en' ? '1 Board' : '1 доска' }}</span>
        <span class="hint">{{ i18n.locale === 'en' ? 'Reading time: ~3 min' : 'Время чтения: ~3 минуты' }}</span>
      </div>
      <h1 itemprop="headline">{{ i18n.locale === 'en' ? '2v2 Team Chess on a Single Board' : 'Командные шахматы 2 на 2 на одной доске' }}</h1>
      <p class="article-lead" itemprop="description">
        {{ i18n.locale === 'en'
          ? 'Simple and exciting format: four players on one board. Teammates control a single army of pieces, alternating moves strictly in rotation.'
          : 'Простой и увлекательный формат: четыре игрока за одной доской. Напарники управляют одной армией фигур, делая ходы строго по очереди.' }}
      </p>
    </header>

    <div class="article-content">
      <!-- Английская версия статьи -->
      <template v-if="i18n.locale === 'en'">
        <section class="article-section">
          <h2>
            <AppIcon name="book-open" :size="20" />
            How 2v2 Chess Works
          </h2>
          <p>
            This is classical chess on a standard 8×8 board, but played by two teams of two players:
          </p>
          <ul>
            <li><strong>White:</strong> Player 1 and Player 3</li>
            <li><strong>Black:</strong> Player 2 and Player 4</li>
          </ul>
          <p>
            The goal is standard — checkmate the enemy king. The real thrill is cooperating on the same board without whispering moves: you must deduce and support your partner's strategic plan directly from their moves!
          </p>
          <div class="callout-box felt">
            <h4>No Hints Allowed</h4>
            <p>
              Players do not whisper moves to each other — coordination happens entirely on the board through the logic of your moves.
            </p>
          </div>
        </section>

        <section class="article-section">
          <h2>
            <AppIcon name="bolt" :size="20" />
            Move Order & Regulations
          </h2>
          <h3>1. Strict Turn Rotation</h3>
          <p>Moves are executed in a continuous sequence:</p>
          <ol>
            <li>White 1</li>
            <li>Black 1</li>
            <li>White 2</li>
            <li>Black 2</li>
            <li>Repeat: White 1, Black 1, etc.</li>
          </ol>
          <p>You cannot play two consecutive moves for your side; the turn automatically passes to your teammate.</p>

          <h3>2. Shared Team Clock</h3>
          <p>
            Each team has a shared clock (e.g. 3+2 or 5+3). Time ticks whenever it is your team's turn. Time increment is added after each move. If team clock hits zero, it is a loss on time.
          </p>

          <h3>3. Standard Chess Rules</h3>
          <p>
            All classical chess rules apply: castling, en passant, pawn promotion. The match concludes by checkmate, resignation, timeout, or automatic draw (stalemate, 3-fold repetition, 50-move rule).
          </p>
        </section>

        <section class="article-section">
          <h2>
            <AppIcon name="eye" :size="20" />
            Tips for Pair Play
          </h2>
          <h3>Play Clearly for Your Teammate</h3>
          <p>Make logical, readable moves. Complex, quiet maneuvers might be misunderstood by your partner if they envision a different strategic setup.</p>
          <h3>Follow Your Partner's Plan</h3>
          <p>Observe which piece your teammate activated or which outpost they targeted, and reinforce that line of attack or defense.</p>
        </section>

        <section class="article-section">
          <h2>
            <AppIcon name="message-square" :size="20" />
            Frequently Asked Questions
          </h2>
          <div class="faq-list">
            <details class="faq-item" name="duo-faq">
              <summary class="faq-question">
                <span>Can I team up with an AI bot?</span>
                <AppIcon name="chevron-down" :size="16" class="faq-icon" />
              </summary>
              <div class="faq-answer">
                <p>Yes! In lobby settings or auto-match, vacant seats are filled by bots with unique grandmaster playstyles and adaptive Elo ratings.</p>
              </div>
            </details>
            <details class="faq-item" name="duo-faq">
              <summary class="faq-question">
                <span>What happens if my partner disconnects?</span>
                <AppIcon name="chevron-down" :size="16" class="faq-icon" />
              </summary>
              <div class="faq-answer">
                <p>The system allows a reconnection window. If they do not return before the team clock runs out, the team loses on time.</p>
              </div>
            </details>
            <details class="faq-item" name="duo-faq">
              <summary class="faq-question">
                <span>How is rating calculated?</span>
                <AppIcon name="chevron-down" :size="16" class="faq-icon" />
              </summary>
              <div class="faq-answer">
                <p>Rating is calculated via the standard Elo formula based on average team ratings prior to match start.</p>
              </div>
            </details>
          </div>
        </section>
      </template>

      <!-- Русская версия статьи -->
      <template v-else>
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
      </template>

      <!-- Интерактивный CTA-блок призыва к игре -->
      <CtaBanner
        :title="i18n.locale === 'en' ? 'Play 2v2 Match' : 'Сыграть партию 2 на 2'"
        :subtitle="i18n.locale === 'en' ? 'Create a table or join an open lobby.' : 'Создайте стол или присоединяйтесь к открытому лобби.'"
        current-mode="duo"
      />

      <!-- Перелинковка на другие разделы -->
      <section class="related-section">
        <h3>{{ i18n.locale === 'en' ? 'Explore More' : 'Другие разделы' }}</h3>
        <div class="related-cards">
          <router-link to="/rules/bughouse" class="related-card">
            <span class="related-card-badge">{{ i18n.locale === 'en' ? 'Bughouse Mode' : 'Режим Bughouse' }}</span>
            <h4>{{ i18n.t.footer.rulesBughouse }}</h4>
            <p>{{ i18n.locale === 'en' ? 'Two boards, passing captured pieces to your partner and dropping them.' : 'Две доски, передача срубленных фигур напарнику и выставление их на доску.' }}</p>
            <span class="related-card-arrow">
              {{ i18n.locale === 'en' ? 'Bughouse Rules' : 'Правила багхауса' }}
              <AppIcon name="arrow-right" :size="13" />
            </span>
          </router-link>

          <router-link to="/about" class="related-card">
            <span class="related-card-badge">{{ i18n.locale === 'en' ? 'About Platform' : 'О проекте' }}</span>
            <h4>{{ i18n.t.footer.about }}</h4>
            <p>{{ i18n.locale === 'en' ? 'Stockfish engine, bots with diverse styles, and realtime play.' : 'Движок Stockfish, боты разных стилей и игра в реальном времени.' }}</p>
            <span class="related-card-arrow">
              {{ i18n.locale === 'en' ? 'Learn more' : 'Подробнее' }}
              <AppIcon name="arrow-right" :size="13" />
            </span>
          </router-link>

          <router-link to="/leaderboard" class="related-card">
            <span class="related-card-badge">{{ i18n.locale === 'en' ? 'Elo Ratings' : 'Рейтинг Elo' }}</span>
            <h4>{{ i18n.t.nav.leaderboard }}</h4>
            <p>{{ i18n.locale === 'en' ? 'Top players, win-rate metrics, and match count.' : 'Таблица игроков, статистика побед и сыгранных партий.' }}</p>
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
