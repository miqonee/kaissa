// ============================================================
// «Каисса» — общие типы фронтенда и бэкенда
// ============================================================

export type Team = 1 | 2;

export type GameMode = 'team' | 'bughouse';

// Контроль времени: без часов либо base+increment (минуты/секунды)
export interface TimeControl {
  kind: 'none' | 'clock';
  baseMin: number;   // базовое время в минутах
  incSec: number;    // инкремент в секундах
}

export type PieceType = 'p' | 'n' | 'b' | 'r' | 'q' | 'k';

/** Карманы в багхаусе: 0 — пусто, иначе число фигур, доступных к дропу */
export type Pocket = Record<PieceType, number>;

// ---------- REST-модели ----------

export interface PublicUser {
  id: number;
  username: string;
  rating: number;
  wins: number;
  losses: number;
  draws: number;
  createdAt: string;
  isAdmin: boolean;
  isBot?: boolean;
  botLevel?: number | null;
}

/** Строка списка пользователей в админке */
export interface AdminUserRow {
  id: number;
  username: string;
  rating: number;
  wins: number;
  losses: number;
  games: number;
  isAdmin: boolean;
  online: boolean;
  isBot?: boolean;
  botLevel?: number | null;
  createdAt: string;
}

export interface LobbyPlayer {
  userId: number;
  username: string;
  rating: number;
  ready: boolean;
  online: boolean;
  host: boolean;
  isBot?: boolean;
  botLevel?: number | null;
  teamChoice?: 1 | 2 | null;
}

export type TeamMode = 'auto' | 'random' | 'manual';

export interface LobbySummary {
  id: string;
  name: string;
  mode: GameMode;
  timeControl: TimeControl;
  players: LobbyPlayer[];
  code: string;
  started: boolean;
  isAuto?: boolean;
  teamMode?: TeamMode;
  autoCountdown?: number | null;
  pausedBy?: number[];
}

export type GameStatus = 'active' | 'finished' | 'abandoned';

export type GameResult = '1-0' | '0-1' | '1/2-1/2' | '*';

export type EndReason =
  | 'checkmate'      // мат
  | 'resign'          // сдача
  | 'timeout'         // флаг
  | 'stalemate'       // пат (только режим 'team', см. правила)
  | 'material'        // недостаток материала (только 'team')
  | 'repetition'      // троекратное повторение (только 'team')
  | 'fifty'           // правило 50 ходов (только 'team')
  | 'abandoned';      // сервер умер / все ушли

export interface GameParticipantInfo {
  userId: number;
  username: string;
  team: Team;
  color: 'w' | 'b';
  boardIndex: 0 | 1;       // 0 — единственная доска в 'team', 0/1 в багхаусе
  moveSlot: 0 | 1;         // порядок хода внутри команды (team-режим)
  ratingBefore: number;
  ratingAfter: number | null;
  isBot?: boolean;
  botLevel?: number | null;
}

export interface GameSummary {
  id: number;
  mode: GameMode;
  status: GameStatus;
  result: GameResult;
  reason: EndReason | null;
  timeControl: TimeControl;
  participants: GameParticipantInfo[];
  startedAt: string;
  endedAt: string | null;
}

export interface MoveRecord {
  boardIndex: 0 | 1;
  ply: number;
  userId: number;
  from: string;
  to: string;
  promotion?: PieceType;
  dropPiece?: PieceType;
  fenAfter: string;
  /** часы после хода: [белые, чёрные] в мс */
  clocksAfter: [number, number] | null;
}

// ---------- Лобби ----------

export const MAX_LOBBY_SLOTS = 4;

export interface CreateLobbyPayload {
  name: string;
  mode: GameMode;
  timeControl: TimeControl;
  private: boolean;
  teamMode?: TeamMode;
}

// ---------- WebSocket события ----------

// --- Клиент -> Сервер ---
export type ClientToServerEvents = {
  // Лобби
  'lobby:join': (code: string, cb: (res: Ack<{ lobby: LobbySummary } | null>) => void) => void;
  'lobby:leave': () => void;
  'lobby:ready': (ready: boolean) => void;
  'lobby:kick': (userId: number) => void;
  'lobby:chat': (text: string) => void;
  'lobby:summon': () => void;
  'lobby:start': (cb: (res: Ack<{ gameId: number } | null>) => void) => void;
  'lobby:rematch': (cb: (res: Ack<{ lobbyId: string } | null>) => void) => void;
  'lobby:set-team': (team: 1 | 2 | null) => void;
  'lobby:pause-toggle': () => void;
  'lobby:set-team-mode': (mode: TeamMode) => void;
  'lobby:set-time-control': (payload: TimeControl | { lobbyId: string; tc: TimeControl }) => void;
  'lobby:add-bot': (cb?: (res: Ack<null>) => void) => void;

  // Игра
  'game:move': (data: { gameId: number; boardIndex: 0 | 1; from: string; to: string; promotion?: PieceType; dropPiece?: PieceType }, cb: (res: Ack<null>) => void) => void;
  'game:resign': (gameId: number) => void;
  'game:chat': (gameId: number, text: string) => void;

  // Подписки
  'game:watch': (gameId: number) => void;
  'game:leave': (gameId: number) => void;
  'live:subscribe': () => void;
  'lobby-list:subscribe': () => void;
};

// --- Сервер -> Клиент ---
export type ServerToClientEvents = {
  // Лобби
  'lobby:list:update': (lobbies: LobbySummary[]) => void;
  'lobby:state': (lobby: LobbySummary) => void;
  'lobby:chat': (msg: ChatMessage) => void;
  'lobby:summoned': (payload: { lobbyId: string; lobbyName: string }) => void;
  'lobby:started': (payload: { gameId: number }) => void;
  'lobby:closed': (reason: string) => void;
  'lobby:countdown': (payload: { lobbyId: string; seconds: number | null; paused: boolean; pausedCount: number; neededCount: number }) => void;

  // Игра
  'game:state': (state: GameState) => void;
  'game:move': (mv: { gameId: number; boardIndex: 0 | 1; ply: number; userId: number; from: string; to: string; promotion?: PieceType; dropPiece?: PieceType; clocksAfter: [number, number] | null }) => void;
  'game:clock': (payload: { gameId: number; clocks: [number, number][]; running: boolean }) => void;
  'game:end': (payload: { gameId: number; result: GameResult; reason: EndReason; participants: GameParticipantInfo[] }) => void;
  'game:chat': (msg: ChatMessage & { gameId: number }) => void;
  'game:players-left': (payload: { gameId: number; left: { userId: number; username: string; reconnected: boolean; leftCount: number }[] }) => void;
  'game:summoned': (payload: { gameId: number }) => void;
  'game:rematch': (payload: { gameId: number; lobbyId: string }) => void;
  'game:next': (payload: { nextGameId: number }) => void;

  // Live-трансляция на главной
  'live:new': (info: LiveGameInfo) => void;
  'live:update': (info: LiveGameInfo) => void;
  'live:end': (payload: { gameId: number; result: GameResult }) => void;
  'live:snapshot': (games: LiveGameInfo[]) => void;

  // Личные события
  'user:notif': (payload: { type: 'lobby_invite' | 're_match' | 'game_invite'; lobbyId: string; lobbyName?: string }) => void;
};

export interface Ack<T> {
  ok: boolean;
  error?: string;
  data?: T;
}

export interface ChatMessage {
  id: number;
  userId: number;
  username: string;
  text: string;
  at: number;
  system?: boolean;
}

// ---------- Игровое состояние (полная синхронизация) ----------

export interface GameState {
  gameId: number;
  mode: GameMode;
  status: GameStatus;
  result: GameResult;
  reason: EndReason | null;
  timeControl: TimeControl;
  participants: GameParticipantInfo[];
  /** текущие FEN по доскам (1 для team, 2 для bughouse) */
  fens: string[];
  /** карманы по игрокам в порядке participants (только bughouse) */
  pockets: Pocket[] | null;
  moveNumber: number;
  /** история ходов SAN (для team-режима) */
  moves?: string[];
  /** чей ход на каждой доске ('w'|'b') */
  turns: ('w' | 'b')[];
  /** кто должен ходить на каждой доске (userId; в team-режиме 1 элемент) */
  turnUserIds: number[];
  /** текущий слот хода для каждой стороны (только team-режим) */
  turnSlots?: Record<'w' | 'b', 0 | 1>;
  /** часы в мс по доскам: [board][colorIdx] colorIdx: 0=w, 1=b */
  clocks: [number, number][];
  /** какой цвет тикает на каждой доске (null — часы стоят) */
  clocksActive: ('w' | 'b' | null)[];
  startedAt: number;
  chat?: ChatMessage[];
}

// ---------- Live-трансляция (главная) ----------

export interface LiveGameInfo {
  gameId: number;
  mode: GameMode;
  players: { userId: number; username: string; rating: number; team: Team; isBot?: boolean }[];
  fens: string[];
  moveNumber: number;
  startedAt: number;
}

// ---------- Профиль / история ----------

export interface RatingPoint {
  at: string;
  rating: number;
}

export interface ProfilePayload {
  user: PublicUser;
  ratingHistory: RatingPoint[];
  recentGames: GameSummary[];
}

export interface LeaderboardRow {
  userId: number;
  username: string;
  rating: number;
  wins: number;
  losses: number;
  draws: number;
}

// ---------- HTTP-ответы ----------

export type AuthResponse = { user: PublicUser } | { error: string };

// ---------- Утилиты ----------

export const START_RATING = 1200;
export const ELO_K = 32;

export function expectedScoreElo(a: number, b: number): number {
  return 1 / (1 + Math.pow(10, (b - a) / 400));
}

export function eloDelta(rating: number, opponentRating: number, score: 0 | 0.5 | 1): number {
  const exp = expectedScoreElo(rating, opponentRating);
  return Math.round(ELO_K * (score - exp));
}

export const DEFAULT_POCKET = (): Pocket => ({ p: 0, n: 0, b: 0, r: 0, q: 0, k: 0 });

/** Пресеты контроля времени для UI */
export const TIME_PRESETS: { label: string; tc: TimeControl }[] = [
  { label: 'Без часов', tc: { kind: 'none', baseMin: 0, incSec: 0 } },
  { label: '3+2', tc: { kind: 'clock', baseMin: 3, incSec: 2 } },
  { label: '5+0', tc: { kind: 'clock', baseMin: 5, incSec: 0 } },
  { label: '5+3', tc: { kind: 'clock', baseMin: 5, incSec: 3 } },
  { label: '10+5', tc: { kind: 'clock', baseMin: 10, incSec: 5 } },
] as { label: string; tc: TimeControl }[];

export function timeControlLabel(tc: TimeControl): string {
  return tc.kind === 'none' ? '∞' : `${tc.baseMin}+${tc.incSec}`;
}


// ---------- Описание режимов (для UI создания лобби) ----------

export interface ModeInfo {
  mode: GameMode;
  title: string;
  short: string;
  rules: string[];
}

export const MODE_INFO: ModeInfo[] = [
  {
    mode: 'bughouse',
    title: 'Багхаус',
    short: 'Две доски. Сбитые фигуры переходят партнёру и ставятся на его доску.',
    rules: [
      'Играют две доски одновременно: партнёры по команде всегда разного цвета.',
      'Сбитая фигура меняет цвет и попадает в «карман» партнёра.',
      'Вместо обычного хода можно поставить фигуру из кармана на любое пустое поле.',
      'Пешку нельзя ставить на первую и восьмую горизонтали.',
      'Мат, сдача или флаг на любой из досок завершают весь матч.',
      'Ничьих нет: партия всегда заканчивается результатом.',
    ],
  },
  {
    mode: 'team',
    title: 'Одна доска 2×2',
    short: 'Одна доска. Команда играет одним цветом, партнёры ходят через одного.',
    rules: [
      'Одна доска: команда 1 — белые, команда 2 — чёрные.',
      'Внутри команды ходы чередуются: первый игрок, затем партнёр, затем снова первый.',
      'Совещаться можно, но ход делает только тот, чья очередь.',
      'Правила классические: рокировка, взятие на проходе, превращение пешки.',
      'Пат считается поражением зажатой стороны — ничьих в клубе нет.',
      'Партия завершается матом, патом, сдачей или флагом.',
    ],
  },
];

// ---------- Боты и ИИ ----------

export interface BotPersonality {
  id: string;
  username: string;
  name: string;
  title: string;
  badge: string;
  description: string;
  defaultElo: number;
  openingsPreference: string[];
}

export const BOT_PERSONALITIES: Record<string, BotPersonality> = {
  bot_tal: {
    id: 'tal',
    username: 'bot_tal',
    name: 'Михаил Таль',
    title: 'Атакующий романтик',
    badge: 'Романтик',
    description: 'жертвы за инициативу, шахи, вскрытие короля',
    defaultElo: 1550,
    openingsPreference: ['e4', 'c5', 'f4', 'd4'],
  },
  bot_karpov: {
    id: 'karpov',
    username: 'bot_karpov',
    name: 'Анатолий Карпов',
    title: 'Позиционный стратег',
    badge: 'Стратег',
    description: 'позиционное удушение, профилактика, захват линий',
    defaultElo: 1450,
    openingsPreference: ['d4', 'c6', 'e6', 'c4'],
  },
  bot_kasparov: {
    id: 'kasparov',
    username: 'bot_kasparov',
    name: 'Гарри Каспаров',
    title: 'Динамический напор',
    badge: 'Динамика',
    description: 'темповая игра, захват центра, агрессивное давление',
    defaultElo: 1600,
    openingsPreference: ['e4', 'd4', 'c5', 'Nf6'],
  },
  bot_petrosian: {
    id: 'petrosian',
    username: 'bot_petrosian',
    name: 'Тигран Петросян',
    title: 'Железная крепость',
    badge: 'Крепость',
    description: 'глубокая профилактика, плотная защита, выжидание ошибки',
    defaultElo: 1300,
    openingsPreference: ['d4', 'c6', 'e6', 'Nf3'],
  },
  bot_capablanca: {
    id: 'capablanca',
    username: 'bot_capablanca',
    name: 'Хосе Капабланка',
    title: 'Чистый классик',
    badge: 'Классик',
    description: 'кристально чистые размены, образцовый переход в эндшпиль',
    defaultElo: 1200,
    openingsPreference: ['d4', 'e4', 'e5', 'd5'],
  },
  bot_morphy: {
    id: 'morphy',
    username: 'bot_morphy',
    name: 'Пол Морфи',
    title: 'Гамбитный гений',
    badge: 'Гамбит',
    description: 'быстрейшее развитие фигур, жертвы пешек, открытые диагонали',
    defaultElo: 750,
    openingsPreference: ['e4', 'e5', 'Bc4', 'f4'],
  },
  bot_fischer: {
    id: 'fischer',
    username: 'bot_fischer',
    name: 'Бобби Фишер',
    title: 'Бескомпромиссная точность',
    badge: 'Точность',
    description: 'классические ветки, острейшая тактика и безупречная техника',
    defaultElo: 1650,
    openingsPreference: ['e4', 'c5', 'Nf6', 'e5'],
  },
  bot_spassky: {
    id: 'spassky',
    username: 'bot_spassky',
    name: 'Борис Спасский',
    title: 'Универсал',
    badge: 'Универсал',
    description: 'гибкий баланс атаки и позиционной игры',
    defaultElo: 1000,
    openingsPreference: ['e4', 'd4', 'c5', 'e5'],
  },
  bot_aljechin: {
    id: 'aljechin',
    username: 'bot_aljechin',
    name: 'Александр Алехин',
    title: 'Комбинационный вихрь',
    badge: 'Вихрь',
    description: 'глубокие многоходовые комбинации, атака на двух флангах',
    defaultElo: 1500,
    openingsPreference: ['d4', 'e4', 'Nf6', 'c4'],
  },
  bot_carlsen: {
    id: 'carlsen',
    username: 'bot_carlsen',
    name: 'Магнус Карлсен',
    title: 'Эндшпильный эвапоратор',
    badge: 'Эндшпиль',
    description: 'игра на микро-плюсы, позиционное выжимание в равных позициях',
    defaultElo: 1750,
    openingsPreference: ['d4', 'Nf3', 'c5', 'e4'],
  },
  bot_botvinnik: {
    id: 'botvinnik',
    username: 'bot_botvinnik',
    name: 'Михаил Ботвинник',
    title: 'Железная логика',
    badge: 'Логика',
    description: 'фундаментальный пешечный центр, методичный расчёт',
    defaultElo: 1400,
    openingsPreference: ['d4', 'c4', 'd5', 'e6'],
  },
  bot_nakamura: {
    id: 'nakamura',
    username: 'bot_nakamura',
    name: 'Хикару Накамура',
    title: 'Блиц-провокатор',
    badge: 'Провокатор',
    description: 'острые провокационные выпады, нестандартные ловушки',
    defaultElo: 1580,
    openingsPreference: ['e4', 'c5', 'b3', 'Nf3'],
  },
};

export interface BotLevelConfig {
  level: number;
  name: string;
  minElo: number;
  maxElo: number;
  nominalElo: number;
  skillLevel: number; // Stockfish Skill Level 0..20
  depth: number;
}

export const BOT_LEVELS: BotLevelConfig[] = [
  { level: 1, name: 'Начинающий', minElo: 0, maxElo: 699, nominalElo: 600, skillLevel: 2, depth: 4 },
  { level: 2, name: 'Младший любитель', minElo: 700, maxElo: 899, nominalElo: 800, skillLevel: 4, depth: 5 },
  { level: 3, name: 'Любитель', minElo: 900, maxElo: 1074, nominalElo: 1000, skillLevel: 6, depth: 6 },
  { level: 4, name: 'Клубный любитель', minElo: 1075, maxElo: 1249, nominalElo: 1150, skillLevel: 8, depth: 7 },
  { level: 5, name: '3-й разряд', minElo: 1250, maxElo: 1424, nominalElo: 1350, skillLevel: 10, depth: 8 },
  { level: 6, name: '2-й разряд', minElo: 1425, maxElo: 1574, nominalElo: 1500, skillLevel: 12, depth: 9 },
  { level: 7, name: '1-й разряд', minElo: 1575, maxElo: 1724, nominalElo: 1650, skillLevel: 14, depth: 10 },
  { level: 8, name: 'Сильный 1-й разряд', minElo: 1725, maxElo: 1874, nominalElo: 1800, skillLevel: 16, depth: 11 },
  { level: 9, name: 'Кандидат в мастера', minElo: 1875, maxElo: 2024, nominalElo: 1950, skillLevel: 18, depth: 12 },
  { level: 10, name: 'Мастер FIDE', minElo: 2025, maxElo: 2199, nominalElo: 2100, skillLevel: 19, depth: 13 },
  { level: 11, name: 'Международный мастер', minElo: 2200, maxElo: 2399, nominalElo: 2300, skillLevel: 20, depth: 14 },
  { level: 12, name: 'Гроссмейстер', minElo: 2400, maxElo: 9999, nominalElo: 2500, skillLevel: 20, depth: 15 },
];

export function eloToLevel(elo: number): number {
  const found = BOT_LEVELS.find((l) => elo >= l.minElo && elo <= l.maxElo);
  return found ? found.level : (elo < 700 ? 1 : 12);
}

export function levelToElo(level: number): number {
  const found = BOT_LEVELS.find((l) => l.level === level);
  return found ? found.nominalElo : 1150;
}

export function getBotPersonality(usernameOrId?: string | null): BotPersonality | undefined {
  if (!usernameOrId) return undefined;
  const key = usernameOrId.trim().toLowerCase();
  return BOT_PERSONALITIES[key] || Object.values(BOT_PERSONALITIES).find((p) => p.id === key || p.username.toLowerCase() === key);
}

export function getBotTooltip(usernameOrId?: string | null, elo?: number | null): string {
  const p = getBotPersonality(usernameOrId);
  const currentElo = elo ?? (p ? p.defaultElo : 1150);
  const level = eloToLevel(currentElo);
  if (!p) return `Шахматный бот (Ур.${level} · ${currentElo} Elo)`;
  return `${p.username}: ${p.name} · ${p.title} — ${p.description} (Ур.${level} · ${currentElo} Elo)`;
}

export interface BotConfig {
  level: number; // 1 to 12
  name: string;
  username: string;
  elo: number;
  depth: number;
  errorRate: number; // базовая вероятность ошибки
  errorJitter: number; // разброс ошибки (+- на партию)
}

export const BOT_PRESETS: BotConfig[] = Object.values(BOT_PERSONALITIES).map((p) => ({
  level: eloToLevel(p.defaultElo),
  name: p.name,
  username: p.username,
  elo: p.defaultElo,
  depth: BOT_LEVELS[eloToLevel(p.defaultElo) - 1]?.depth || 6,
  errorRate: 0.05,
  errorJitter: 0.02,
}));

// ---------- Метрики платформы и ботов (Админка) ----------

export interface BotLevelMetric {
  level: number;
  name: string;
  elo: number;
  totalGames: number;
  wins: number;
  losses: number;
  draws: number;
  winRate: number;
  checkmateCount: number;
  timeoutCount: number;
  stalemateCount: number;
  avgMoves: number;
}

export interface BotPersonalityMetric {
  username: string;
  name: string;
  title: string;
  badge: string;
  description: string;
  defaultElo: number;
  bestEloText: string;
  totalGames: number;
  wins: number;
  losses: number;
  draws: number;
  winRate: number;
  checkmateCount: number;
  timeoutCount: number;
  stalemateCount: number;
  avgMoves: number;
}

export interface BotPairMetric {
  pairKey: string;
  bot1Name: string;
  bot1Badge: string;
  bot2Name: string;
  bot2Badge: string;
  totalGames: number;
  wins: number;
  losses: number;
  draws: number;
  winRate: number;
}

export interface PlatformMetrics {
  onlineUsers: number;
  totalUsers: number;
  totalGames: number;
  totalMoves: number;
  avgGameDurationSec: number;
  botMetrics: BotLevelMetric[];
  botMetricsVsHuman: BotLevelMetric[];
  botMetricsVsBot: BotLevelMetric[];
  personalityMetricsVsHuman: BotPersonalityMetric[];
  personalityMetricsVsBot: BotPersonalityMetric[];
  bestPair?: BotPairMetric | null;
  worstPair?: BotPairMetric | null;
  topLevel?: { level: number; name: string; elo: number; winRate: number; totalGames: number } | null;
  topPersonality?: { username: string; name: string; badge: string; winRate: number; totalGames: number } | null;
}

export * from './openings.js';


