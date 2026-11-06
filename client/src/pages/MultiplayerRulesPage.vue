<script setup lang="ts">
import AppIcon from '../components/AppIcon.vue';
import CtaBanner from '../components/CtaBanner.vue';
import { usePageSeo } from '../composables/useSeo';
import { useI18n } from '../stores/i18n';

const i18n = useI18n();

usePageSeo({ canonical: '/rules/multiplayer' });
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
      <span class="current" aria-current="page">{{ i18n.t.footer.rulesMultiplayer }}</span>
    </nav>

    <!-- Шапка статьи -->
    <header class="article-hero">
      <div class="article-meta-row">
        <span class="badge felt">{{ i18n.locale === 'en' ? '3 & 4 Players' : '3 и 4 игрока' }}</span>
        <span class="badge brass">{{ i18n.locale === 'en' ? 'Free-For-All (FFA)' : 'Каждый за себя' }}</span>
        <span class="hint">{{ i18n.locale === 'en' ? 'Reading time: ~4 min' : 'Время чтения: ~4 минуты' }}</span>
      </div>
      <h1 itemprop="headline">
        {{
          i18n.locale === 'en'
            ? '3-Player & 4-Player Chess Rules Online (Free-For-All)'
            : 'Правила шахмат на троих и четверых онлайн (каждый за себя)'
        }}
      </h1>
      <p class="article-lead" itemprop="description">
        {{
          i18n.locale === 'en'
            ? 'Free-For-All chess where every player commands their own army and color. Compete on a 14×14 cross board for 4 players or a 96-cell hexagonal board for 3 players, earn points for captures and checkmates, and claim first place!'
            : 'Свободный режим Free-For-All, где у каждого игрока своя армия и свой цвет фигур. Сражайтесь на крестообразной доске 14×14 на четверых или шестиугольной доске из 96 полей на троих, набирайте очки за взятия и маты и занимайте первое место!'
        }}
      </p>
      <div class="hero-cta-links">
        <router-link class="button primary" to="/?action=quick&mode=four-player">
          <AppIcon name="play" :size="14" />
          {{ i18n.locale === 'en' ? 'Play 4-Player Chess' : 'Играть на 4 игроков' }}
        </router-link>
        <router-link class="button brass" to="/?action=quick&mode=three-player">
          <AppIcon name="play" :size="14" />
          {{ i18n.locale === 'en' ? 'Play 3-Player Hex Chess' : 'Играть на 3 игроков' }}
        </router-link>
      </div>
    </header>

    <div class="article-content">
      <!-- Английская версия статьи -->
      <template v-if="i18n.locale === 'en'">
        <section class="article-section">
          <h2>
            <AppIcon name="book-open" :size="20" />
            Two Board Topologies: 4-Player Cross & 3-Player Hexagon
          </h2>
          <h3>1. 4-Player Chess (14×14 Cross Board, 160 Squares)</h3>
          <p>
            Four players sit around a 14×14 cross-shaped board with the 3×3 corners removed (160 playable squares). Each player controls a full 16-piece army of their own color and moves clockwise:
          </p>
          <ul>
            <li><strong>Red (South):</strong> Moves first, pawns advance North.</li>
            <li><strong>Blue (West):</strong> Moves second, pawns advance East.</li>
            <li><strong>Yellow (North):</strong> Moves third, pawns advance South.</li>
            <li><strong>Green (East):</strong> Moves fourth, pawns advance West.</li>
          </ul>
          <p>
            The board automatically rotates on your screen so your own army is always at the bottom facing forward. Pawns promote to a Queen on the 8th rank of their advance direction.
          </p>

          <h3>2. 3-Player Hexagonal Chess (96 Cells)</h3>
          <p>
            Three players battle on a symmetric three-wing hexagonal board consisting of 96 quadrilateral cells (three 4×8 sectors meeting along three central seam lines):
          </p>
          <ul>
            <li><strong>Red, Blue, and Yellow</strong> armies start on their respective 8-file home wings.</li>
            <li><strong>Orthogonal moves (Rooks):</strong> Cross cell edges into the 4 edge-adjacent neighbors; crossing a central seam continues into the opposite wing.</li>
            <li><strong>Diagonal moves (Bishops):</strong> Pass through cell vertices; through the central point of the board, a diagonal branches into two legal rays.</li>
            <li><strong>Knights:</strong> Jump one step orthogonally followed by one step diagonally outward.</li>
          </ul>
        </section>

        <section class="article-section">
          <h2>
            <AppIcon name="crown" :size="20" />
            Scoring System & Piece Elimination
          </h2>
          <p>
            In Free-For-All (FFA) chess, victory is determined by <strong>total points</strong> scored by the end of the match (or being the last survivor with the highest score):
          </p>
          <ul>
            <li><strong>Capturing a live piece:</strong> Pawn = <strong>+1</strong>, Knight = <strong>+3</strong>, Bishop = <strong>+5</strong>, Rook = <strong>+5</strong>, Queen = <strong>+9</strong>.</li>
            <li><strong>Delivering Checkmate:</strong> <strong>+20 points</strong> to the player whose move checkmates an opponent.</li>
            <li><strong>Stalemate:</strong> <strong>+20 points</strong> for self-stalemate (or +10 split among remaining active players).</li>
            <li><strong>Double / Simultaneous Check:</strong> Delivering check to two enemy kings in one move awards a <strong>+5 bonus</strong> (three kings — <strong>+15</strong>).</li>
          </ul>

          <div class="callout-box felt">
            <h4>Dead (Grey) Pieces</h4>
            <p>
              When a player is checkmated, resigns, or times out, their remaining pieces turn <strong>neutral grey</strong>. Grey pieces do not move, do not give check, and award <strong>0 points</strong> when captured, but they still block squares until captured.
            </p>
          </div>
        </section>

        <section class="article-section">
          <h2>
            <AppIcon name="bolt" :size="20" />
            Time Control & Turn Regulations
          </h2>
          <ul>
            <li><strong>30 Seconds for the First Move:</strong> At the start of a match, the first move must be made within 30 seconds, otherwise the match is cancelled without rating changes.</li>
            <li><strong>Default No-Clock Mode with 5-Minute Turn Limit:</strong> By default, 3-player and 4-player tables run without a total game clock so AI bots cannot gain an unfair time advantage, while each individual move is limited to a maximum of <strong>5 minutes</strong>. If a player leaves or does not move for 5 minutes, they are automatically eliminated on timeout.</li>
            <li><strong>Optional Blitz & Rapid Clocks:</strong> In the lobby, the host can also choose standard clocks (3+2, 5+3, 10+5) if desired.</li>
          </ul>
        </section>

        <section class="article-section">
          <h2>
            <AppIcon name="message-square" :size="20" />
            Frequently Asked Questions
          </h2>
          <div class="faq-list">
            <details class="faq-item" name="multi-faq">
              <summary class="faq-question">
                <span>How does Elo rating work in 3-player and 4-player chess?</span>
                <AppIcon name="chevron-down" :size="16" class="faq-icon" />
              </summary>
              <div class="faq-answer">
                <p>Both 3-player and 4-player modes have their own independent Elo leaderboards. Pairwise Elo adjustments are calculated across all participants based on final standings (1st through 4th place).</p>
              </div>
            </details>
            <details class="faq-item" name="multi-faq">
              <summary class="faq-question">
                <span>Can I play 3-player or 4-player chess with bots?</span>
                <AppIcon name="chevron-down" :size="16" class="faq-icon" />
              </summary>
              <div class="faq-answer">
                <p>Yes! Empty seats are automatically filled by tactical FFA bots that evaluate material, king safety, and checkmate bonuses. Human players can replace bots in open lobbies before the game starts.</p>
              </div>
            </details>
          </div>
        </section>
      </template>

      <!-- Русская версия статьи -->
      <template v-else>
        <section class="article-section">
          <h2>
            <AppIcon name="book-open" :size="20" />
            Две геометрии доски: крест 14×14 и гексагон на троих
          </h2>
          <h3>1. Шахматы на четверых (крестообразная доска 14×14, 160 клеток)</h3>
          <p>
            Четыре игрока располагаются по сторонам крестообразной доски 14×14 с вырезанными углами 3×3 (160 игровых полей). Каждый управляет собственной армией из 16 фигур своего цвета и ходит по часовой стрелке:
          </p>
          <ul>
            <li><strong>Красные (Юг):</strong> ходят первыми, пешки идут на север.</li>
            <li><strong>Синие (Запад):</strong> ходят вторыми, пешки идут на восток.</li>
            <li><strong>Жёлтые (Север):</strong> ходят третьими, пешки идут на юг.</li>
            <li><strong>Зелёные (Восток):</strong> ходят четвёртыми, пешки идут на запад.</li>
          </ul>
          <p>
            Доска автоматически поворачивается для каждого участника так, чтобы ваши фигуры всегда находились снизу. Пешки превращаются в ферзя на 8-й горизонтали своего движения вперёд.
          </p>

          <h3>2. Шахматы на троих (шестиугольная доска из 96 полей)</h3>
          <p>
            Три игрока сражаются на симметричной шестиугольной доске из 96 четырёхугольных клеток (три сектора 4×8, сходящихся по трём центральным швам):
          </p>
          <ul>
            <li><strong>Красные, Синие и Жёлтые</strong> начинают на своих домашних крыльях шириной 8 вертикалей.</li>
            <li><strong>Ортогональные ходы (ладья):</strong> переходят через общие рёбра клетки в 4 соседних поля; пересекая центральный шов, ладья продолжает ход в крыло соперника.</li>
            <li><strong>Диагональные ходы (слон):</strong> проходят через вершины клеток; при проходе через центральную точку доски диагональ разветвляется на два легальных луча.</li>
            <li><strong>Ход коня:</strong> один шаг ортогонально и один шаг по диагонали наружу.</li>
          </ul>
        </section>

        <section class="article-section">
          <h2>
            <AppIcon name="crown" :size="20" />
            Система очков и выбывание игроков
          </h2>
          <p>
            В режиме «каждый за себя» (Free-For-All) места распределяются по <strong>сумме набранных очков</strong> к концу партии:
          </p>
          <ul>
            <li><strong>Взятие живой фигуры соперника:</strong> пешка = <strong>+1</strong>, конь = <strong>+3</strong>, слон = <strong>+5</strong>, ладья = <strong>+5</strong>, ферзь = <strong>+9</strong>.</li>
            <li><strong>Постановка мата:</strong> <strong>+20 очков</strong> игроку, чей ход поставил мат королю соперника.</li>
            <li><strong>Пат:</strong> <strong>+20 очков</strong> при пате самому себе (или по +10 активным соперникам).</li>
            <li><strong>Двойной / одновременный шах:</strong> шах двум вражеским королям одним ходом приносит бонус <strong>+5 очков</strong> (трём королям — <strong>+15 очков</strong>).</li>
          </ul>

          <div class="callout-box felt">
            <h4>Мёртвые (серые) фигуры выбывших</h4>
            <p>
              Когда игрок получает мат, сдаётся или проигрывает по времени, все его оставшиеся фигуры становятся <strong>нейтральными серыми</strong>. Серые фигуры не ходят, не ставят шах и дают <strong>0 очков</strong> при взятии, но продолжают занимать клетки, пока их не срубят.
            </p>
          </div>
        </section>

        <section class="article-section">
          <h2>
            <AppIcon name="bolt" :size="20" />
            Контроль времени и регламент ходов
          </h2>
          <ul>
            <li><strong>30 секунд на первый ход:</strong> в начале каждой партии первый ход должен быть сделан за 30 секунд, иначе игра автоматически отменяется без изменения рейтинга.</li>
            <li><strong>Режим без часов по умолчанию и лимит 5 минут на ход:</strong> по умолчанию столы на 3 и 4 игроков запускаются без общего таймера на всю партию (чтобы боты не получали преимущество за счёт мгновенных ходов), но на каждый отдельный ход даётся не более <strong>5 минут</strong>. Если игрок покинул партию и не ходит 5 минут, ему засчитывается выбывание по времени.</li>
            <li><strong>Часы по желанию:</strong> в настройках стола хост также может включить классический контроль времени (3+2, 5+3, 10+5).</li>
          </ul>
        </section>

        <section class="article-section">
          <h2>
            <AppIcon name="message-square" :size="20" />
            Частые вопросы
          </h2>
          <div class="faq-list">
            <details class="faq-item" name="multi-faq">
              <summary class="faq-question">
                <span>Как считается рейтинг Elo в шахматах на 3 и 4 игроков?</span>
                <AppIcon name="chevron-down" :size="16" class="faq-icon" />
              </summary>
              <div class="faq-answer">
                <p>У режимов «3 игрока» и «4 игрока» отдельные таблицы лидеров Elo. Изменение рейтинга рассчитывается попарно между всеми участниками в зависимости от занятого места (с 1-го по 4-е).</p>
              </div>
            </details>
            <details class="faq-item" name="multi-faq">
              <summary class="faq-question">
                <span>Можно ли играть на троих или четверых с ботами?</span>
                <AppIcon name="chevron-down" :size="16" class="faq-icon" />
              </summary>
              <div class="faq-answer">
                <p>Да! Свободные места за столом автоматически занимают ИИ-боты, умеющие оценивать стоимость фигур, безопасность короля и бонусы за мат на нестандартных досках.</p>
              </div>
            </details>
          </div>
        </section>
      </template>

      <CtaBanner
        :title="i18n.locale === 'en' ? 'Ready for a Free-For-All Battle?' : 'Готовы сразиться в шахматы на 3 и 4 игроков?'"
        :subtitle="i18n.locale === 'en' ? 'Start a quick match on the 4-player cross board or 3-player hexagonal board right now.' : 'Начните быструю партию на крестообразной доске для 4 игроков или гексагональной доске для 3 игроков.'"
        current-mode="four-player"
      />

      <!-- Перелинковка на другие разделы -->
      <section class="related-section">
        <h3>{{ i18n.locale === 'en' ? 'Explore More Modes' : 'Другие режимы и разделы' }}</h3>
        <div class="related-cards">
          <router-link to="/rules/duo" class="related-card">
            <span class="related-card-badge">{{ i18n.locale === 'en' ? '2v2 Mode' : 'Режим 2×2' }}</span>
            <h4>{{ i18n.t.footer.rulesDuo }}</h4>
            <p>{{ i18n.locale === 'en' ? 'Four players in two teams on a standard 8×8 board.' : 'Четыре игрока в двух командах за одной стандартной доской 8×8.' }}</p>
            <span class="related-card-arrow">
              {{ i18n.locale === 'en' ? '2v2 Rules' : 'Правила 2×2' }}
              <AppIcon name="arrow-right" :size="13" />
            </span>
          </router-link>

          <router-link to="/rules/bughouse" class="related-card">
            <span class="related-card-badge">{{ i18n.locale === 'en' ? 'Bughouse Mode' : 'Режим Bughouse' }}</span>
            <h4>{{ i18n.t.footer.rulesBughouse }}</h4>
            <p>{{ i18n.locale === 'en' ? 'Two parallel boards and passing captured pieces to your teammate.' : 'Две параллельные доски и передача срубленных фигур напарнику.' }}</p>
            <span class="related-card-arrow">
              {{ i18n.locale === 'en' ? 'Bughouse Rules' : 'Правила багхауса' }}
              <AppIcon name="arrow-right" :size="13" />
            </span>
          </router-link>

          <router-link to="/leaderboard" class="related-card">
            <span class="related-card-badge">{{ i18n.locale === 'en' ? 'Elo Ratings' : 'Рейтинг Elo' }}</span>
            <h4>{{ i18n.t.nav.leaderboard }}</h4>
            <p>{{ i18n.locale === 'en' ? 'Separate leaderboards for 2v2, Bughouse, Crazyhouse, 3-Player and 4-Player modes.' : 'Отдельный рейтинг игроков для 2×2, Багхауса, Crazyhouse, 3 и 4 игроков.' }}</p>
            <span class="related-card-arrow">
              {{ i18n.locale === 'en' ? 'View Leaderboard' : 'Смотреть рейтинг' }}
              <AppIcon name="arrow-right" :size="13" />
            </span>
          </router-link>
        </div>
      </section>
    </div>
  </article>
</template>

<style scoped>
.hero-cta-links {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 18px;
}
.hero-cta-links a {
  text-decoration: none;
}
</style>
