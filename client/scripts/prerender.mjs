import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distDir = path.resolve(__dirname, '../dist');
const indexHtmlPath = path.join(distDir, 'index.html');

if (!fs.existsSync(indexHtmlPath)) {
  console.error(`[prerender] Error: dist/index.html not found at ${indexHtmlPath}. Run vite build first.`);
  process.exit(1);
}

const baseHtml = fs.readFileSync(indexHtmlPath, 'utf8');

const pages = [
  {
    path: '/',
    title: 'Шахматы на двоих онлайн: играть 2 на 2 и в Багхаус | Каисса',
    description:
      'Играйте в шахматы на двоих онлайн бесплатно. Командные шахматы 2х2 на одной доске и шведские шахматы (багхаус) с фигурами из резерва. Игра с друзьями и ботами.',
    keywords:
      'шахматы на двоих, шахматы на двоих онлайн, играть в шахматы на двоих, шахматы 2 на 2, командные шахматы, шахматы 2х2, багхаус, шведские шахматы, шахматы вдвоем, каисса',
    canonical: 'https://duochess.ru/',
    schema: [
      {
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: 'Каисса',
        alternateName: ['Kaissa', 'DuoChess'],
        url: 'https://duochess.ru/',
        inLanguage: 'ru',
        description: 'Платформа для игры в шахматы на двоих онлайн: командные шахматы 2 на 2 на одной доске и шведские шахматы (багхаус).',
      },
      {
        '@context': 'https://schema.org',
        '@type': 'WebApplication',
        name: 'Каисса — шахматы на двоих онлайн',
        url: 'https://duochess.ru/',
        description:
          'Играйте в шахматы на двоих онлайн бесплатно. Командные шахматы 2х2 на одной доске и шведские шахматы (багхаус) с обменом фигурами и ИИ-ботами Stockfish WASM.',
        applicationCategory: 'GameApplication',
        genre: 'Chess',
        operatingSystem: 'All',
        browserRequirements: 'Requires JavaScript and a modern Web browser',
        offers: {
          '@type': 'Offer',
          price: '0',
          priceCurrency: 'RUB',
        },
        inLanguage: 'ru',
        image: 'https://duochess.ru/og-image.png',
        author: {
          '@type': 'Organization',
          name: 'Каисса',
          url: 'https://duochess.ru/',
        },
      },
    ],
    contentHtml: `
      <header>
        <h1>Шахматы на двоих онлайн: играть 2 на 2 и в Багхаус</h1>
        <p>Бесплатная браузерная платформа для совместной игры в шахматы на двоих: парные шахматы 2х2 на одной доске и шведские шахматы онлайн.</p>
        <nav aria-label="Карта сайта">
          <ul>
            <li><a href="/rules/duo">Командные шахматы 2 на 2 на одной доске: правила игры</a></li>
            <li><a href="/rules/bughouse">Правила шведских шахмат (Багхаус) онлайн: дропы и тактика</a></li>
            <li><a href="/about">О платформе Каисса</a></li>
            <li><a href="/leaderboard">Таблица лидеров и рейтинг игроков</a></li>
            <li><a href="/history">Архив сыгранных партий</a></li>
          </ul>
        </nav>
      </header>
      <main>
        <section>
          <h2>Шахматы на двоих на одной доске (2 на 2 / Duo Chess)</h2>
          <p>
            Играйте в шахматы на двоих в одной команде! Четыре игрока на стандартной доске 8х8: напарники по очереди управляют фигурами одного цвета.
            Полноценные правила классических шахмат: рокировка, взятие на проходе, превращение пешек. Требует сыгранности и понимания ходов напарника.
          </p>
          <p><a href="/rules/duo">Читать подробные правила командных шахмат 2х2</a></p>
        </section>
        <section>
          <h2>Шведские шахматы онлайн (Багхаус / Bughouse)</h2>
          <p>
            Динамичные парные шахматы на двух параллельных досках. Сбитые фигуры партнёра попадают в ваш карман резерва и выставляются на доску (дроп).
            Мат дропом, превращение и разжалование пешек, игра на победу всей команды.
          </p>
          <p><a href="/rules/bughouse">Читать подробные правила шведских шахмат и тактику дропов</a></p>
        </section>
        <section>
          <h2>О шахматной платформе Каисса</h2>
          <p>
            Шахматы на двоих с живыми соперниками или против 12 уровней сложности ИИ на движке Stockfish 18 (WASM), стилизованных под легендарных гроссмейстеров. Динамический рейтинг Elo, архив партий и игра в реальном времени.
          </p>
          <p><a href="/about">Подробнее о платформе Каисса</a></p>
        </section>
      </main>
      <footer>
        <p>© 2026 Каисса. Бесплатные шахматы на двоих онлайн 2х2 и Багхаус.</p>
      </footer>
    `,
  },
  {
    path: '/rules/duo',
    title: 'Командные шахматы 2 на 2 на одной доске: правила игры | Каисса',
    description:
      'Официальные правила командных шахмат 2 на 2 на одной доске. Поочерёдные ходы напарников, командные часы, тактика игры в паре на платформе Каисса.',
    keywords:
      'командные шахматы 2 на 2, шахматы 2х2 правила, шахматы на двоих на одной доске, duo chess, правила парных шахмат',
    canonical: 'https://duochess.ru/rules/duo',
    schema: [
      {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          {
            '@type': 'ListItem',
            position: 1,
            name: 'Главная',
            item: 'https://duochess.ru/',
          },
          {
            '@type': 'ListItem',
            position: 2,
            name: 'Командные шахматы 2 на 2',
            item: 'https://duochess.ru/rules/duo',
          },
        ],
      },
      {
        '@context': 'https://schema.org',
        '@type': 'TechArticle',
        headline: 'Командные шахматы 2 на 2 на одной доске: правила игры',
        description:
          'Официальные правила командных шахмат 2 на 2 на одной доске: очередность ходов, командные часы и основы игры в паре на платформе Каисса.',
        url: 'https://duochess.ru/rules/duo',
        inLanguage: 'ru',
        author: {
          '@type': 'Organization',
          name: 'Каисса',
          url: 'https://duochess.ru/',
        },
      },
    ],
    contentHtml: `
      <article itemscope itemtype="https://schema.org/TechArticle">
        <header>
          <nav aria-label="Хлебные крошки">
            <a href="/">Главная</a> / <span>Командные шахматы 2 на 2</span>
          </nav>
          <h1 itemprop="headline">Командные шахматы 2 на 2 на одной доске: правила игры</h1>
          <p itemprop="description">
            Простой и увлекательный формат: четыре игрока за одной доской.
            Напарники управляют одной армией фигур, делая ходы строго по очереди.
          </p>
        </header>
        <section>
          <h2>Как устроена игра 2 на 2</h2>
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
          <p>Во время партии игроки не подсказывают друг другу ходы — всё решается прямо на доске через последовательность действий.</p>
        </section>
        <section>
          <h2>Очерёдность ходов и регламент</h2>
          <h3>1. Строгая поочерёдность</h3>
          <p>Ходы делаются строго по циклу: Белый 1, Чёрный 1, Белый 2, Чёрный 2, затем снова Белый 1. Сделать два хода подряд за свою команду нельзя.</p>
          <h3>2. Командные часы</h3>
          <p>У каждой команды общий банк времени (например, 3+2 или 5+3). Время идёт, когда наступает ход любого из игроков команды. Падение флажка означает поражение.</p>
          <h3>3. Классические правила шахмат</h3>
          <p>Сохраняются все стандартные правила: рокировка, взятие на проходе, превращение пешек. Ничьи фиксируются по правилу 50 ходов, троекратного повторения позиции или пат.</p>
        </section>
        <section>
          <h2>Советы для игры в паре</h2>
          <p>Делайте логичные, понятные ходы. Поддерживайте атакующие идеи и защитные перегруппировки напарника.</p>
        </section>
        <section>
          <h2>Частые вопросы</h2>
          <dl>
            <dt>Можно ли играть вдвоём с ботом в одной команде?</dt>
            <dd>Да, свободные места за столом можно занять ботами разного уровня Stockfish WASM.</dd>
            <dt>Что будет при дисконнекте напарника?</dt>
            <dd>Система даёт время на переподключение. Если игрок не вернулся до истечения командного времени, засчитывается поражение по таймауту.</dd>
          </dl>
        </section>
        <footer>
          <p>Смотрите также: <a href="/rules/bughouse">Правила шведских шахмат (Багхаус)</a> | <a href="/about">О платформе</a> | <a href="/leaderboard">Рейтинг игроков</a></p>
        </footer>
      </article>
    `,
  },
  {
    path: '/rules/bughouse',
    title: 'Правила шведских шахмат (Багхаус) онлайн: тактика и дропы | Каисса',
    description:
      'Подробные правила шведских шахмат (багхаус) онлайн. Как передавать сбитые фигуры партнёру, правила дропа на доску, разжалование пешек и тактика победы в паре.',
    keywords:
      'правила шведских шахмат, шведские шахматы онлайн, багхаус правила, bughouse chess, дроп фигур, шведки шахматы',
    canonical: 'https://duochess.ru/rules/bughouse',
    schema: [
      {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          {
            '@type': 'ListItem',
            position: 1,
            name: 'Главная',
            item: 'https://duochess.ru/',
          },
          {
            '@type': 'ListItem',
            position: 2,
            name: 'Шведские шахматы (Багхаус)',
            item: 'https://duochess.ru/rules/bughouse',
          },
        ],
      },
      {
        '@context': 'https://schema.org',
        '@type': 'TechArticle',
        headline: 'Правила шведских шахмат (Багхаус) онлайн: тактика и дропы',
        description:
          'Подробные правила шведских шахмат (Bughouse Chess) онлайн: дропы фигур из резерва, передача сбитых фигур партнеру, разжалование пешек и командная игра на платформе Каисса.',
        url: 'https://duochess.ru/rules/bughouse',
        inLanguage: 'ru',
        author: {
          '@type': 'Organization',
          name: 'Каисса',
          url: 'https://duochess.ru/',
        },
      },
    ],
    contentHtml: `
      <article itemscope itemtype="https://schema.org/TechArticle">
        <header>
          <nav aria-label="Хлебные крошки">
            <a href="/">Главная</a> / <a href="/rules/duo">Правила</a> / <span>Шведские шахматы (Багхаус)</span>
          </nav>
          <h1 itemprop="headline">Правила шведских шахмат (Багхаус) онлайн: тактика и дропы</h1>
          <p itemprop="description">
            Шведские шахматы (Багхаус / Bughouse) — захватывающий командный вариант шахмат на двух смежных досках с передачей срубленных фигур напарнику для выставления (дропа).
          </p>
        </header>
        <section>
          <h2>Что такое шведские шахматы (Багхаус)?</h2>
          <p>
            Играют две команды по два человека на двух параллельных досках. Партнёры играют противоположными цветами (белыми на первой доске, чёрными на второй).
            Срубленная фигура соперника меняет цвет и переходит в резерв (карман) вашего партнёра.
          </p>
          <p>В любой свой ход вместо движения фигуры игрок имеет право выставить (дропнуть) фигуру из кармана на любое свободное поле!</p>
        </section>
        <section>
          <h2>Основные правила игры в багхаус</h2>
          <h3>1. Резерв (Карман фигур)</h3>
          <p>Все срубленные пешки, кони, слоны, ладьи и ферзи попадают в резерв партнёра. Короли не передаются.</p>
          <h3>2. Механика дропов (выставление на доску)</h3>
          <ul>
            <li>Выставление фигуры из резерва является полноценным ходом.</li>
            <li>Фигуру можно ставить на любое свободное поле.</li>
            <li><strong>Пешки запрещено дропать на 1-ю и 8-ю горизонтали</strong> (разрешено только со 2-й по 7-ю).</li>
          </ul>
          <h3>3. Мат дропом (Drop Mate)</h3>
          <p>В правилах платформы Каисса мат дропом разрешён: можно выставить фигуру из кармана с объявлением шаха или неотразимого мата.</p>
          <h3>4. Разжалование пешек</h3>
          <p>Если превращённая в ферзя пешка срублена соперником, в карман напарника она попадает как обычная пешка.</p>
        </section>
        <section>
          <h2>Тактика и позиционная игра</h2>
          <p>Главный фактор победы в багхаусе — безопасность короля и своевременный запрос нужной фигуры у напарника для нанесения решающего удара.</p>
        </section>
        <footer>
          <p>Смотрите также: <a href="/rules/duo">Командные шахматы 2 на 2</a> | <a href="/about">О платформе</a> | <a href="/leaderboard">Рейтинг игроков</a></p>
        </footer>
      </article>
    `,
  },
  {
    path: '/about',
    title: 'О платформе Каисса: командные шахматы 2 на 2 и Багхаус онлайн',
    description:
      'Платформа Каисса — современный шахматный клуб для командных шахмат 2х2 и багхауса в реальном времени. Рейтинг Elo, боты на базе Stockfish WASM, открытый код.',
    keywords:
      'о платформе каисса, шахматная платформа, командные шахматы онлайн, stockfish шахматы, шахматный клуб, шахматы 2 на 2',
    canonical: 'https://duochess.ru/about',
    schema: [
      {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          {
            '@type': 'ListItem',
            position: 1,
            name: 'Главная',
            item: 'https://duochess.ru/',
          },
          {
            '@type': 'ListItem',
            position: 2,
            name: 'О платформе',
            item: 'https://duochess.ru/about',
          },
        ],
      },
      {
        '@context': 'https://schema.org',
        '@type': 'AboutPage',
        name: 'О платформе Каисса: командные шахматы 2 на 2 и Багхаус онлайн',
        description:
          'Платформа Каисса: площадка для командных шахмат 2х2 на одной доске и шведских шахмат (Багхаус) онлайн. Боты разного уровня и игра в реальном времени.',
        url: 'https://duochess.ru/about',
        inLanguage: 'ru',
      },
    ],
    contentHtml: `
      <article itemscope itemtype="https://schema.org/AboutPage">
        <header>
          <nav aria-label="Хлебные крошки">
            <a href="/">Главная</a> / <span>О платформе</span>
          </nav>
          <h1>О шахматной платформе Каисса</h1>
          <p>Каисса — онлайн-платформа нового поколения, созданная для парных командных шахмат на двоих и шведских шахмат (багхаус).</p>
        </header>
        <section>
          <h2>Форматы игры</h2>
          <h3>1. 2 на 2 на одной доске (Duo Chess)</h3>
          <p>Игра вчетвером за одной доской с чередованием ходов напарников и общими часами.</p>
          <h3>2. Шведские шахматы (Багхаус / Bughouse)</h3>
          <p>Битва двух команд на параллельных досках с мгновенной передачей срубленных фигур в резерв партнёра.</p>
        </section>
        <section>
          <h2>Технологии и возможности</h2>
          <ul>
            <li><strong>Stockfish 18 WASM:</strong> 12 уровней сложности встроенного ИИ и стили исторических гроссмейстеров.</li>
            <li><strong>WebSocket в реальном времени:</strong> Мгновенный отклик, синхронизация часов и авто-реконнект.</li>
            <li><strong>Рейтинг Elo:</strong> Честный расчёт индивидуального рейтинга на основе силы соперников.</li>
            <li><strong>Архив партий:</strong> Интерактивный плеер для разбора сыгранных матчей.</li>
          </ul>
        </section>
        <section>
          <h2>Принципы Fair Play</h2>
          <p>Мы поддерживаем честную спортивную атмосферу без читов, движков и подсказок.</p>
        </section>
        <footer>
          <p><a href="/rules/duo">Правила 2х2</a> | <a href="/rules/bughouse">Правила Багхаус</a> | <a href="/leaderboard">Таблица лидеров</a></p>
        </footer>
      </article>
    `,
  },
  {
    path: '/leaderboard',
    title: 'Таблица лидеров: рейтинг игроков в шахматы 2 на 2 и Багхаус | Каисса',
    description:
      'Рейтинг игроков и таблица лидеров шахматной платформы Каисса. Рейтинг Elo, статистика побед и поражений в командных шахматах 2х2 и шведских шахматах.',
    keywords:
      'таблица лидеров, рейтинг игроков, топ шахматистов, elo рейтинг шахматы, сильнейшие игроки, каисса рейтинг, командные шахматы, шахматы на двоих',
    canonical: 'https://duochess.ru/leaderboard',
    schema: [
      {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          {
            '@type': 'ListItem',
            position: 1,
            name: 'Главная',
            item: 'https://duochess.ru/',
          },
          {
            '@type': 'ListItem',
            position: 2,
            name: 'Таблица лидеров',
            item: 'https://duochess.ru/leaderboard',
          },
        ],
      },
      {
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        name: 'Таблица лидеров: рейтинг игроков в шахматы 2 на 2 и Багхаус | Каисса',
        url: 'https://duochess.ru/leaderboard',
        inLanguage: 'ru',
      },
    ],
    contentHtml: `
      <section>
        <header>
          <nav aria-label="Хлебные крошки">
            <a href="/">Главная</a> / <span>Таблица лидеров</span>
          </nav>
          <h1>Таблица лидеров и рейтинг шахматистов</h1>
          <p>Актуальный рейтинг сильнейших игроков платформы Каисса в командных шахматах 2 на 2 и Багхаусе.</p>
        </header>
        <p>Рейтинг рассчитывается по формуле Elo с учётом среднего рейтинга обеих команд в партии. Побеждайте, чтобы подниматься в топе лидеров!</p>
        <p><a href="/">Начать играть</a> | <a href="/rules/duo">Правила игры</a> | <a href="/history">Архив партий</a></p>
      </section>
    `,
  },
  {
    path: '/history',
    title: 'Архив партий: реплеи командных шахмат 2 на 2 и Багхауса | Каисса',
    description:
      'Архив сыгранных матчей на платформе Каисса. Интерактивный просмотр реплеев игр 2х2 и шведских шахмат, история ходов и анализ партий.',
    keywords:
      'архив партий, база партий, история шахматных игр, реплеи шахмат, pgn шахматы, каисса архив, командные шахматы история',
    canonical: 'https://duochess.ru/history',
    schema: [
      {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          {
            '@type': 'ListItem',
            position: 1,
            name: 'Главная',
            item: 'https://duochess.ru/',
          },
          {
            '@type': 'ListItem',
            position: 2,
            name: 'Архив партий',
            item: 'https://duochess.ru/history',
          },
        ],
      },
      {
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        name: 'Архив партий: реплеи командных шахмат 2 на 2 и Багхауса | Каисса',
        url: 'https://duochess.ru/history',
        inLanguage: 'ru',
      },
    ],
    contentHtml: `
      <section>
        <header>
          <nav aria-label="Хлебные крошки">
            <a href="/">Главная</a> / <span>Архив партий</span>
          </nav>
          <h1>Архив партий и база сыгранных матчей</h1>
          <p>База завершённых матчей платформы Каисса: реплеи, анализ ходов и экспорт партий в PGN.</p>
        </header>
        <p>Смотрите разборы недавних командных игр 2х2 и партий в шведские шахматы.</p>
        <p><a href="/">Сыграть партию</a> | <a href="/leaderboard">Таблица лидеров</a></p>
      </section>
    `,
  },
  {
    path: '/login',
    title: 'Вход и регистрация в шахматном клубе | Каисса',
    description:
      'Войдите или зарегистрируйтесь в шахматном клубе Каисса, чтобы играть в шахматы на двоих 2х2 и Багхаус онлайн, повышать рейтинг Elo и сохранять партии.',
    keywords: 'вход каисса, регистрация шахматы онлайн, шахматный клуб личный кабинет',
    canonical: 'https://duochess.ru/login',
    schema: [
      {
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        name: 'Вход и регистрация в шахматном клубе | Каисса',
        url: 'https://duochess.ru/login',
        inLanguage: 'ru',
      },
    ],
    contentHtml: `
      <section>
        <header>
          <nav aria-label="Хлебные крошки">
            <a href="/">Главная</a> / <span>Вход и регистрация</span>
          </nav>
          <h1>Вход и регистрация на платформе Каисса</h1>
          <p>Авторизуйтесь, чтобы играть в командные шахматы 2х2 и Багхаус, отслеживать рейтинг Elo и общаться с игроками.</p>
        </header>
      </section>
    `,
  },
];

function generateHtmlForPage(page) {
  let html = baseHtml;

  // 1. Title
  html = html.replace(/<title>.*?<\/title>/s, `<title>${page.title}</title>`);

  // 2. Meta description
  html = html.replace(
    /<meta\s+name="description"\s+content=".*?"\s*\/?>/i,
    `<meta name="description" content="${page.description}" />`,
  );

  // 3. Meta keywords
  html = html.replace(
    /<meta\s+name="keywords"\s+content=".*?"\s*\/?>/i,
    `<meta name="keywords" content="${page.keywords}" />`,
  );

  // 4. Canonical link
  html = html.replace(
    /<link\s+rel="canonical"\s+href=".*?"\s*\/?>/i,
    `<link rel="canonical" href="${page.canonical}" />`,
  );

  // 5. OpenGraph
  html = html.replace(
    /<meta\s+property="og:title"\s+content=".*?"\s*\/?>/i,
    `<meta property="og:title" content="${page.title}" />`,
  );
  html = html.replace(
    /<meta\s+property="og:description"\s+content=".*?"\s*\/?>/i,
    `<meta property="og:description" content="${page.description}" />`,
  );
  html = html.replace(
    /<meta\s+property="og:url"\s+content=".*?"\s*\/?>/i,
    `<meta property="og:url" content="${page.canonical}" />`,
  );

  // 6. Twitter
  html = html.replace(
    /<meta\s+name="twitter:title"\s+content=".*?"\s*\/?>/i,
    `<meta name="twitter:title" content="${page.title}" />`,
  );
  html = html.replace(
    /<meta\s+name="twitter:description"\s+content=".*?"\s*\/?>/i,
    `<meta name="twitter:description" content="${page.description}" />`,
  );

  // 7. Schema.org JSON-LD
  const schemaJson = JSON.stringify(page.schema, null, 2);
  html = html.replace(
    /<script\s+type="application\/ld\+json">.*?<\/script>/s,
    `<script type="application/ld+json">\n${schemaJson}\n    </script>`,
  );

  // 8. Noscript content
  html = html.replace(
    /<!-- Семантический контент для поисковых ботов и пользователей без JS -->\s*<noscript>.*?<\/noscript>/s,
    `<!-- Семантический контент для поисковых ботов и пользователей без JS -->\n    <noscript>\n${page.contentHtml.trim()}\n    </noscript>`,
  );

  return html;
}

console.log('[prerender] Generating static HTML pages for SEO...');

for (const page of pages) {
  const rendered = generateHtmlForPage(page);
  let targetPath;

  if (page.path === '/') {
    targetPath = indexHtmlPath;
  } else {
    const pageSubDir = path.join(distDir, page.path.replace(/^\/+/, ''));
    if (!fs.existsSync(pageSubDir)) {
      fs.mkdirSync(pageSubDir, { recursive: true });
    }
    targetPath = path.join(pageSubDir, 'index.html');
  }

  fs.writeFileSync(targetPath, rendered, 'utf8');
  console.log(`[prerender] Rendered: ${page.path} -> ${path.relative(distDir, targetPath)}`);
}

console.log('[prerender] Successfully prerendered all 7 public pages!');
