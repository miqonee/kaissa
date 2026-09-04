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
  createdAt: string;
}

export interface LobbyPlayer {
  userId: number;
  username: string;
  rating: number;
  ready: boolean;
  online: boolean;
  host: boolean;
}

export interface LobbySummary {
  id: string;
  name: string;
  mode: GameMode;
  timeControl: TimeControl;
  players: LobbyPlayer[];
  code: string;
  started: boolean;
}

export type GameStatus = 'active' | 'finished' | 'abandoned';

export type GameResult = '1-0' | '0-1' | '*' ;

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

  // Игра
  'game:move': (data: { gameId: number; boardIndex: 0 | 1; from: string; to: string; promotion?: PieceType; dropPiece?: PieceType }, cb: (res: Ack<null>) => void) => void;
  'game:resign': (gameId: number) => void;
  'game:chat': (gameId: number, text: string) => void;

  // Подписки
  'game:watch': (gameId: number) => void;
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

  // Игра
  'game:state': (state: GameState) => void;
  'game:move': (mv: { gameId: number; boardIndex: 0 | 1; ply: number; userId: number; from: string; to: string; promotion?: PieceType; dropPiece?: PieceType; clocksAfter: [number, number] | null }) => void;
  'game:clock': (payload: { gameId: number; clocks: [number, number][]; running: boolean }) => void;
  'game:end': (payload: { gameId: number; result: GameResult; reason: EndReason; participants: GameParticipantInfo[] }) => void;
  'game:chat': (msg: ChatMessage & { gameId: number }) => void;
  'game:players-left': (payload: { gameId: number; left: { userId: number; username: string; reconnected: boolean; leftCount: number }[] }) => void;
  'game:summoned': (payload: { gameId: number }) => void;

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
  /** чей ход на каждой доске ('w'|'b') */
  turns: ('w' | 'b')[];
  /** кто должен ходить на каждой доске (userId; в team-режиме 1 элемент) */
  turnUserIds: number[];
  /** часы в мс по доскам: [board][colorIdx] colorIdx: 0=w, 1=b */
  clocks: [number, number][];
  /** какой цвет тикает на каждой доске (null — часы стоят) */
  clocksActive: ('w' | 'b' | null)[];
  startedAt: number;
}

// ---------- Live-трансляция (главная) ----------

export interface LiveGameInfo {
  gameId: number;
  mode: GameMode;
  players: { userId: number; username: string; rating: number; team: Team }[];
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
