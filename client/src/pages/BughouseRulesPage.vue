<script setup lang="ts">
import { computed } from 'vue';
import AppIcon from '../components/AppIcon.vue';
import ChessDiagram from '../components/ChessDiagram.vue';
import CtaBanner from '../components/CtaBanner.vue';
import { usePageSeo } from '../composables/useSeo';
import { useI18n } from '../stores/i18n';

const i18n = useI18n();

usePageSeo({ canonical: '/rules/bughouse' });
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
      <router-link to="/rules/duo">{{ i18n.locale === 'en' ? 'Rules' : 'Правила' }}</router-link>
      <span class="sep">/</span>
      <span class="current" aria-current="page">{{ i18n.t.footer.rulesBughouse }}</span>
    </nav>
    <!-- Шапка статьи -->
    <header class="article-hero">
      <div class="article-meta-row">
        <span class="badge felt">Bughouse Chess</span>
        <span class="badge brass">{{ i18n.locale === 'en' ? '2v2 on 2 Boards' : '2 на 2 на двух досках' }}</span>
        <span class="hint">{{ i18n.locale === 'en' ? 'Reading time: ~5 min' : 'Время чтения: ~6 минут' }}</span>
      </div>
      <h1 itemprop="headline">{{ i18n.locale === 'en' ? 'Bughouse Chess Rules Online: Drops, Tactics, and Strategy' : 'Правила шведских шахмат (Багхаус) онлайн: дропы, тактика, особенности' }}</h1>
      <p class="article-lead" itemprop="description">
        {{ i18n.locale === 'en'
          ? 'Bughouse chess is one of the most thrilling and fast-paced chess variants in the world. Two teams of two clash across two parallel boards, where every captured piece goes straight to your partner for lightning-fast drops!'
          : 'Шведские шахматы (или Багхаус / Bughouse) — один из самых динамичных и азартных вариантов шахматной игры в мире. Две команды по два человека сражаются на двух параллельных досках, а каждая срубленная фигура не выбывает из борьбы, а отправляется в резерв партнёра для молниеносных «дропов».' }}
      </p>
    </header>

    <div class="article-content">
      <!-- Английская версия статьи -->
      <template v-if="i18n.locale === 'en'">
        <section class="article-section">
          <h2>
            <AppIcon name="book-open" :size="20" />
            What is Bughouse Chess?
          </h2>
          <p>
            In classical chess, captured pieces are permanently eliminated. In <strong>Bughouse Chess</strong> (also known as Siamese chess), four players compete on two parallel boards. Teammates sit side-by-side playing opposite colors: Partner 1 plays White on Board A, and Partner 2 plays Black on Board B.
          </p>
          <p>
            When you capture an opponent's piece, it keeps its color and immediately enters your teammate's <strong>pocket (reserve)</strong>. On any of their turns, instead of moving a piece already on the board, your partner can <strong>drop</strong> a piece from their reserve onto any vacant square on their board!
          </p>

          <div class="callout-box felt">
            <h4>One Result for the Whole Team</h4>
            <p>
              Victory is shared: if a player achieves checkmate on either board, or if an opponent runs out of time on their clock, the entire match ends in victory for your team!
            </p>
          </div>
        </section>

        <section class="article-section">
          <h2>
            <AppIcon name="bolt" :size="20" />
            Core Rules of Bughouse
          </h2>

          <h3>1. Captured Pieces & Reserve Pocket</h3>
          <ul>
            <li>Every captured piece passes into your teammate's pocket in real time.</li>
            <li>Pockets can hold pawns, knights, bishops, rooks, and queens. Kings cannot be captured or passed.</li>
            <li>There is no limit to the number of pieces a player can hold in reserve.</li>
          </ul>

          <h3>2. Drop Mechanics</h3>
          <ul>
            <li><strong>Full Legal Turn:</strong> Dropping a piece counts as a full legal turn, after which the move passes to the opponent.</li>
            <li><strong>Any Vacant Square:</strong> You can drop pieces onto any unoccupied square.</li>
            <li><strong>Pawn Restrictions (1st & 8th ranks):</strong> Pawns may NEVER be dropped on the 1st or 8th rank. Drops are allowed strictly on ranks 2 through 7.</li>
            <li><strong>7th Rank Drop:</strong> A white pawn dropped on the 7th rank (or a black pawn on the 2nd) threatens promotion if its next move is legal.</li>
          </ul>

          <h3>3. Drop Check & Drop Mate</h3>
          <p>
            On Kaissa, standard international rules apply: <strong>checkmate by drop is completely legal</strong>. You can drop a knight, queen, or pawn directly in front of the enemy king to deliver check or inescapable checkmate.
          </p>

          <p>Kaissa counts pieces already in the pocket. A legal defensive drop prevents mate. With no legal moves, checkmate or stalemate immediately loses the whole match; there is no automatic wait for a future piece. Fairy-Stockfish bots can calculate pocket drops.</p>
          <h3>4. Pawn Demotion Rule</h3>
          <p>
            When a pawn advances to the 8th rank and promotes to queen, rook, knight, or bishop, it functions with full piece power. However, if that promoted piece is subsequently captured by the opponent, it enters the partner's pocket <strong>demoted back to an ordinary pawn</strong>. This prevents excessive queen inflation!
          </p>
        </section>

        <section class="article-section">
          <h2>
            <AppIcon name="eye" :size="20" />
            Tactical Diagrams & Drop Checkmates
          </h2>
          <p>
            King safety is paramount in Bughouse. A seemingly solid fortress can collapse in one move if your opponent drops a piece directly into your defense.
          </p>

          <div class="diagrams-grid">
            <ChessDiagram
              title="Smothered Mate by Knight Drop"
              badge="Drop Mate"
              badge-color="bad"
              fen="r1bq2rk/ppp3pp/8/8/2B5/8/PPPP1PPP/R1BQK2R w - - 0 1"
              interactive-fen="r1bq2rk/ppp2Npp/8/8/2B5/8/PPPP1PPP/R1BQK2R b - - 0 1"
              :pocket-white="[{ type: 'n', count: 1 }]"
              action-label="Drop ♘@f7#"
              reset-label="Reset Position"
              check-square="h8"
              :last-move="[null, 'f7']"
              caption="White takes a knight from the pocket and drops it on f7. Black's king on h8 is smothered by its own pieces. Bishop on c4 defends the knight, and knight checks cannot be blocked. Smothered mate by drop!"
            />

            <ChessDiagram
              title="Pawn Wedge Attack on Queen"
              badge="Pawn Drop"
              badge-color="felt"
              fen="r1b1k2r/ppp1qppp/2n5/8/4B3/8/PPP2PPP/R1BQK2R w KQkq - 0 1"
              interactive-fen="r1b1k2r/ppp1qppp/2nP4/8/4B3/8/PPP2PPP/R1BQK2R b KQkq - 0 1"
              :pocket-white="[{ type: 'p', count: 1 }]"
              action-label="Drop ♙@d6"
              reset-label="Reset Position"
              :last-move="[null, 'd6']"
              caption="White drops a pawn on d6 from reserve. The queen on e7 is attacked, piece coordination is broken, and c7 becomes a critical invasion target."
            />
          </div>
        </section>

        <section class="article-section">
          <h2>
            <AppIcon name="crown" :size="20" />
            Bughouse Strategy & Tactics
          </h2>
          <h3>Communication is Key</h3>
          <p>Successful partners communicate constantly: <em>«Need a knight for mate!»</em>, <em>«Do not trade queens!»</em>, <em>«Hold your move for 5 seconds!»</em>.</p>
          <h3>Stalling (Wait for Drop)</h3>
          <p>If your position is under pressure, you can stall your move while your partner captures the defensive piece you need. Watch your clock closely!</p>
          <h3>Piece Values in Bughouse</h3>
          <ul>
            <li><strong>Knight (N):</strong> The deadliests drop weapon. Can check without being blocked.</li>
            <li><strong>Pawn (P):</strong> Essential tactical wedge to open king files and block diagonals.</li>
            <li><strong>Queen (Q):</strong> Immense firepower, but giving up your queen can hand your opponents instant mate.</li>
          </ul>
        </section>

        <section class="article-section">
          <h2>
            <AppIcon name="message-square" :size="20" />
            Frequently Asked Questions (FAQ)
          </h2>
          <div class="faq-list">
            <details class="faq-item" name="bughouse-faq">
              <summary class="faq-question">
                <span>Is checkmate by dropping a piece legal?</span>
                <AppIcon name="chevron-down" :size="16" class="faq-icon" />
              </summary>
              <div class="faq-answer">
                <p>Yes! Checkmate by drop is completely legal in international Bughouse rules and on Kaissa.</p>
              </div>
            </details>
            <details class="faq-item" name="bughouse-faq">
              <summary class="faq-question">
                <span>How is Bughouse different from Crazyhouse?</span>
                <AppIcon name="chevron-down" :size="16" class="faq-icon" />
              </summary>
              <div class="faq-answer">
                <p>Crazyhouse is a 1v1 game on a single board where you keep pieces you capture. Bughouse is a 2v2 game across two boards where you pass pieces to your teammate.</p>
              </div>
            </details>
            <details class="faq-item" name="bughouse-faq">
              <summary class="faq-question">
                <span>What happens when a player flags on time?</span>
                <AppIcon name="chevron-down" :size="16" class="faq-icon" />
              </summary>
              <div class="faq-answer">
                <p>Running out of time on either board immediately loses the match for that team, regardless of position.</p>
              </div>
            </details>
          </div>
        </section>
      </template>

      <!-- Русская версия статьи -->
      <template v-else>
        <!-- Секция: Что такое Багхаус -->
        <section class="article-section">
          <h2>
            <AppIcon name="book-open" :size="20" />
            Что такое шведские шахматы (Багхаус)?
          </h2>
          <p>
            В классических шахматах взятая фигура покидает партию навсегда. В шведских шахматах (международное название —
            <strong>Bughouse Chess</strong>) игра ведётся вчетвером на двух смежных досках. Партнёры по команде сидят рядом
            и играют противоположными цветами: первый партнёр руководит белыми фигурами на Доске А, а второй — чёрными на Доске B.
          </p>
          <p>
            Когда вы сбиваете фигуру оппонента, она сохраняет свой цвет и сразу отправляется в
            <strong>«карман» (резерв)</strong> вашего напарника. Напарник в любой свой ход вместо движения фигурой по доске имеет право
            <strong>выставить (сделать дроп)</strong> полученную фигуру на любое свободное поле своей доски!
          </p>

          <div class="callout-box felt">
            <h4>Суть командного единства в Багхаусе</h4>
            <p>
              Победа достигается общими усилиями: если хотя бы на одной из двух досок поставлен мат или у соперника упал флаг (закончилось время),
              вся ваша команда празднует победу во всём матче!
            </p>
          </div>
        </section>

        <!-- Секция: Основные правила -->
        <section class="article-section">
          <h2>
            <AppIcon name="bolt" :size="20" />
            Основные правила онлайн-игры в шведки
          </h2>

          <h3>1. Передача сбитых фигур и карман (Резерв)</h3>
          <ul>
            <li>Любая взятая фигура передаётся напарнику в карман.</li>
            <li>В кармане могут накапливаться пешки, кони, слоны, ладьи и ферзи. Короли не передаются.</li>
            <li>Количество фигур в резерве не ограничено и отображается на панели игрока в реальном времени.</li>
          </ul>

          <h3>2. Механика дропов (Выставление фигур)</h3>
          <ul>
            <li><strong>Полноценный ход:</strong> Выставление фигуры из кармана на доску считается отдельным легальным ходом, после которого очередь переходит сопернику.</li>
            <li><strong>Свободное поле:</strong> Фигуру разрешено дропать на абсолютно любую незанятую клетку доски.</li>
            <li><strong>Ограничение для пешек (1-я и 8-я горизонтали):</strong> Пешку строго запрещено дропать на первую и восьмую горизонтали (1 и 8 ряды). Пешку можно выставлять только на ряды со 2-го по 7-й включительно.</li>
            <li><strong>Дроп на 7-ю горизонталь:</strong> Белая пешка на 7-й горизонтали (чёрная на 2-й) угрожает превращением следующим ходом, если поле впереди свободно и ход законен.</li>
          </ul>

          <h3>3. Шах и мат дропом (Drop Check & Drop Mate)</h3>
          <p>
            В онлайн-багхаусе на платформе «Каисса» действуют классические международные правила:
            <strong>мат дропом полностью разрешён</strong>. Вы можете выставить коня, ферзя или пешку из кармана прямо под нос вражескому королю
            с объявлением шаха или неотразимого мата.
          </p>

          <p>На Каиссе учитываются фигуры, уже находящиеся в кармане. Если закрыться дропом можно, мата нет. Если легальных ходов нет совсем, мат или пат сразу проигрывает весь матч; автоматического ожидания фигуры от напарника нет.</p>
          <h3>4. Правило превращения и «разжалования» пешек</h3>
          <p>
            Если пешка доходит до последней горизонтали и превращается в ферзя, ладью, коня или слона, на доске она действует с полной силой этой фигуры.
            Однако, если соперник срубит эту превращённую фигуру, в карман его напарника она попадёт
            <strong>как обычная пешка</strong> («разжалование»), а не как ферзь! Это исключает инфляцию старших фигур в игре.
          </p>
        </section>

        <!-- Секция: Интерактивные диаграммы позиций -->
        <section class="article-section">
          <h2>
            <AppIcon name="eye" :size="20" />
            Позиционные диаграммы и тактика дропов
          </h2>
          <p>
            В шведских шахматах позиционная оценка кардинально отличается от классических шахмат: решающее значение имеет
            безопасность короля и возможность нанести молниеносный тактический удар выставлением из кармана.
          </p>

          <div class="diagrams-grid">
            <!-- Диаграмма 1: Спёртый мат дропом -->
            <ChessDiagram
              title="Спёртый мат дропом конём"
              badge="Мат дропом"
              badge-color="bad"
              fen="r1bq2rk/ppp3pp/8/8/2B5/8/PPPP1PPP/R1BQK2R w - - 0 1"
              interactive-fen="r1bq2rk/ppp2Npp/8/8/2B5/8/PPPP1PPP/R1BQK2R b - - 0 1"
              :pocket-white="[{ type: 'n', count: 1 }]"
              action-label="Дропнуть ♘@f7#"
              reset-label="Вернуть позицию"
              check-square="h8"
              :last-move="[null, 'f7']"
              caption="Белые берут коня из кармана и выставляют его на поле f7. Чёрный король на h8 заблокирован собственной ладьёй g8 и пешками. Слон c4 прикрывает коня, а от шаха конём закрыться невозможно. Это спёртый мат дропом!"
            />

            <!-- Диаграмма 2: Пешечный дроп-клин -->
            <ChessDiagram
              title="Пешечный клин и атака ферзя"
              badge="Дроп пешки"
              badge-color="felt"
              fen="r1b1k2r/ppp1qppp/2n5/8/4B3/8/PPP2PPP/R1BQK2R w KQkq - 0 1"
              interactive-fen="r1b1k2r/ppp1qppp/2nP4/8/4B3/8/PPP2PPP/R1BQK2R b KQkq - 0 1"
              :pocket-white="[{ type: 'p', count: 1 }]"
              action-label="Дропнуть ♙@d6"
              reset-label="Вернуть позицию"
              :last-move="[null, 'd6']"
              caption="Белые выставляют пешку на d6 из резерва. Чёрный ферзь e7 атакован пешкой, связь фигур чёрных нарушена, а поле c7 становится следующей критической мишенью для вторжения."
            />
          </div>
        </section>

        <!-- Секция: Стратегия и победа -->
        <section class="article-section">
          <h2>
            <AppIcon name="crown" :size="20" />
            Стратегия и тактические приёмы в Багхаусе
          </h2>

          <h3>Коммуникация с напарником: «Голос решает всё»</h3>
          <p>
            В шведских шахматах нельзя молчать. Успешная пара непрерывно координирует ходы:
            <em>«Дай коня для мата!»</em>, <em>«Не руби ладью, меня разнесут на дропах!»</em>, <em>«Подержи ход 10 секунд!»</em>.
          </p>

          <h3>Тактическая задержка хода (Stall)</h3>
          <p>
            Если позиция на вашей доске острая, а любой ход ослабляет оборону, вы можете замереть и выждать
            (<em>Stall</em>), пока ваш напарник на соседней доске срубит нужную фигуру для парирования угрозы или создания решающей контратаки.
            Главное — внимательно следить за собственными часами, чтобы не уронить флаг.
          </p>

          <h3>Истинная ценность фигур в шведках</h3>
          <ul>
            <li><strong>Конь (N):</strong> Главное оружие нападения. Конь ставит шах дропом через любые пешечные заграждения, и от этого шаха невозможно перекрыться.</li>
            <li><strong>Пешка (P):</strong> Универсальный клин. Пешки дропаются для вскрытия линий короля, блокады диагоналей и создания связок.</li>
            <li><strong>Ферзь (Q):</strong> Невероятная разрушительная сила, но отдавать своего ферзя опасно: ферзь в кармане соперника часто приводит к немедленному мату вашему напарнику.</li>
          </ul>
        </section>

        <!-- Секция: FAQ -->
        <section class="article-section">
          <h2>
            <AppIcon name="message-square" :size="20" />
            Часто задаваемые вопросы (FAQ)
          </h2>

          <div class="faq-list">
            <details class="faq-item" name="bughouse-faq">
              <summary class="faq-question">
                <span>Законна ли победа матом прямо при выставлении фигуры (дропе)?</span>
                <AppIcon name="chevron-down" :size="16" class="faq-icon" />
              </summary>
              <div class="faq-answer">
                <p>
                  Да! В шведских шахматах онлайн на платформе Каисса и в официальных турнирах мат дропом абсолютно легален.
                  Если фигура из кармана ставит мат королю соперника, партия немедленно завершается победой вашей команды.
                </p>
              </div>
            </details>

            <details class="faq-item" name="bughouse-faq">
              <summary class="faq-question">
                <span>Чем шведские шахматы отличаются от Crazyhouse (Крейзихаус)?</span>
                <AppIcon name="chevron-down" :size="16" class="faq-icon" />
              </summary>
              <div class="faq-answer">
                <p>
                  Crazyhouse — это игра один на один на одной доске, где срубленные фигуры вы забираете себе в карман.
                  Bughouse (Шведские шахматы) — это командная игра 2 на 2 на двух досках, где вы передаёте фигуры своему партнёру.
                </p>
              </div>
            </details>

            <details class="faq-item" name="bughouse-faq">
              <summary class="faq-question">
                <span>Что происходит, если у игрока истекает время на часах?</span>
                <AppIcon name="chevron-down" :size="16" class="faq-icon" />
              </summary>
              <div class="faq-answer">
                <p>
                  Падение флажка хотя бы на одной доске означает немедленное поражение уронившей время команды во всей встрече,
                  даже если на соседней доске у их напарника был подавляющий материальный перевес.
                </p>
              </div>
            </details>

            <details class="faq-item" name="bughouse-faq">
              <summary class="faq-question">
                <span>Можно ли играть в шведские шахматы с ботами на платформе Каисса?</span>
                <AppIcon name="chevron-down" :size="16" class="faq-icon" />
              </summary>
              <div class="faq-answer">
                <p>
                  Да, платформа Каисса оснащена ботами Fairy-Stockfish WASM различного уровня силы, которые рассчитывают карманы и дропы.
                  Вы можете играть как в паре с ботом против людей, так и тренироваться с ИИ в любое удобное время.
                </p>
              </div>
            </details>
          </div>
        </section>
      </template>

      <!-- Интерактивный CTA-блок призыва к игре -->
      <CtaBanner
        :title="i18n.locale === 'en' ? 'Play Bughouse Chess Online Now!' : 'Сыграйте в шведские шахматы онлайн прямо сейчас!'"
        :subtitle="i18n.locale === 'en' ? 'Enter the lobby, create a Bughouse table or join an open game with friends and bots.' : 'Заходите в лобби, создавайте стол в режиме Bughouse или садитесь за открытый стол с напарником и ИИ-ботами.'"
        current-mode="bughouse"
      />

      <!-- Перелинковка на другие статьи и разделы -->
      <section class="related-section">
        <h3>{{ i18n.locale === 'en' ? 'Explore More' : 'Другие разделы' }}</h3>
        <div class="related-cards">
          <router-link to="/rules/duo" class="related-card">
            <span class="related-card-badge">{{ i18n.locale === 'en' ? '2v2 Mode' : 'Режим 2х2' }}</span>
            <h4>{{ i18n.t.footer.rulesDuo }}</h4>
            <p>{{ i18n.locale === 'en' ? 'Strict move rotation, team time control, and one-board tactics.' : 'Правила поочерёдных ходов в паре, командный тайм-контроль и особенности игры на одной доске.' }}</p>
            <span class="related-card-arrow">
              {{ i18n.locale === 'en' ? 'Read Rules' : 'Читать правила' }}
              <AppIcon name="arrow-right" :size="13" />
            </span>
          </router-link>

          <router-link to="/about" class="related-card">
            <span class="related-card-badge">{{ i18n.locale === 'en' ? 'About Platform' : 'О проекте' }}</span>
            <h4>{{ i18n.t.footer.about }}</h4>
            <p>{{ i18n.locale === 'en' ? 'Stockfish engine, bot levels, and team gameplay modes.' : 'Движок Stockfish, боты разной сложности и командные режимы.' }}</p>
            <span class="related-card-arrow">
              {{ i18n.locale === 'en' ? 'Learn more' : 'Подробнее' }}
              <AppIcon name="arrow-right" :size="13" />
            </span>
          </router-link>

          <router-link to="/leaderboard" class="related-card">
            <span class="related-card-badge">{{ i18n.locale === 'en' ? 'Elo Ratings' : 'Рейтинг' }}</span>
            <h4>{{ i18n.t.nav.leaderboard }}</h4>
            <p>{{ i18n.locale === 'en' ? 'Top players, win-rate metrics, and match count.' : 'Рейтинг игроков, статистика побед и сыгранных партий.' }}</p>
            <span class="related-card-arrow">
              {{ i18n.locale === 'en' ? 'View Leaderboard' : 'В рейтинг' }}
              <AppIcon name="arrow-right" :size="13" />
            </span>
          </router-link>
        </div>
      </section>

    </div>
  </article>
</template>
