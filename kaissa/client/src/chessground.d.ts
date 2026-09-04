// Типы chessground: пакет отдаёт .d.ts только через typesVersions,
// что не резолвится с moduleResolution: bundler. Объявляем минимальный API тут.

declare module 'chessground-types' {
  export type Role = 'king' | 'queen' | 'rook' | 'bishop' | 'knight' | 'pawn';
  export type Color = 'white' | 'black';
  export type Key = string;

  export interface Piece {
    role: Role;
    color: Color;
    promoted?: boolean;
  }

  export type Dests = Map<Key, Key[]>;

  export interface MovableOptions {
    free?: boolean;
    color?: Color | 'both';
    showDests?: boolean;
    dests?: Dests;
    events?: {
      after?: (orig: Key, dest: Key, meta?: unknown) => void;
      afterNewPiece?: (role: Role, key: Key, meta?: unknown) => void;
    };
  }

  export interface Config {
    fen?: string;
    orientation?: Color;
    turnColor?: Color;
    check?: boolean | Key;
    lastMove?: Key[];
    viewOnly?: boolean;
    coordinates?: boolean;
    autoCastle?: boolean;
    movable?: MovableOptions;
    premovable?: { enabled?: boolean; showDests?: boolean; events?: unknown };
    draggable?: { showGhost?: boolean; distance?: number; autoDistance?: boolean; centeredGhost?: boolean };
    selectable?: { enabled?: boolean };
    events?: {
      change?: () => void;
      select?: (key: Key | undefined) => void;
      move?: (orig: Key, dest: Key, captured?: Piece) => void;
      dropNewPiece?: (piece: Piece, key: Key) => void;
    };
    animation?: { enabled?: boolean; duration?: number };
    highlight?: { lastMove?: boolean; check?: boolean; dragOver?: boolean };
    drawable?: { enabled?: boolean; visible?: boolean; eraseOnClick?: boolean; shapes?: unknown[]; autoShapes?: unknown[]; brushes?: Record<string, unknown> };
    externalDests?: unknown;
  }

  export interface Api {
    set(config: Config): void;
    state: unknown;
    getFen(): string;
    toggleOrientation(): void;
    move(orig: Key, dest: Key): void;
    setPieces(pieces: Map<Key, Piece | undefined>): void;
    selectSquare(key: Key | null, force?: boolean): void;
    newPiece(piece: Piece, key: Key): void;
    playPremove(): boolean;
    cancelPremove(): void;
    playPredrop(validate: (drop: { role: Role; key: Key }) => boolean): boolean;
    cancelPredrop(): void;
    cancelMove(): void;
    stop(): void;
    explode(keys: Key[]): void;
    setShapes(shapes: { orig: Key; brush?: string }[]): void;
    setAutoShapes(shapes: unknown[]): void;
    getKeyAtDomPos(pos: [number, number]): Key | undefined;
    redrawAll(): void;
    dragNewPiece(piece: Piece, event: MouseEvent | TouchEvent, force?: boolean): void;
    destroy(): void;
  }
}

declare module '@lichess-org/chessground' {
  export function Chessground(element: HTMLElement, config?: import('chessground-types').Config): import('chessground-types').Api;
}
