import type { GameState, ServerToClientEvents } from 'shared';
export type MoveUpdate = Parameters<ServerToClientEvents['game:move']>[0];
export type EndUpdate = Parameters<ServerToClientEvents['game:end']>[0];
export function applyMoveUpdate(state: GameState, move: MoveUpdate): void {
  if (move.gameId !== state.gameId || !move.fenAfter) return;
  state.fens[move.boardIndex] = move.fenAfter;
  const color = move.fenAfter.split(' ')[1] as 'w' | 'b';
  state.turns[move.boardIndex] = color;
  // Slots and reserves must be updated before the next mover is derived.
  if (move.turnSlots) state.turnSlots = move.turnSlots;
  if (move.pockets !== undefined) state.pockets = move.pockets;
  if (move.legalDrops !== undefined) state.legalDrops = move.legalDrops;
  if (move.turnUserIds) state.turnUserIds = move.turnUserIds;
  else {
    const next = state.participants.find(p => state.mode === 'bughouse'
      ? p.boardIndex === move.boardIndex && p.color === color
      : p.color === color && p.moveSlot === (state.turnSlots?.[color] ?? 0));
    state.turnUserIds[move.boardIndex] = next?.userId ?? 0;
  }
}
export function applyEndUpdate(state: GameState, event: EndUpdate): void {
  if (event.gameId !== state.gameId) return;
  state.status = event.status ?? (event.reason === 'abandoned' ? 'abandoned' : 'finished');
  state.result = event.result;
  state.reason = event.reason;
  state.participants = event.participants;
  state.ratingKind = event.ratingKind ?? state.ratingKind;
  state.endBoardIndex = event.endBoardIndex;
  state.savingResult = false;
  state.clocksActive = state.clocksActive.map(() => null);
  state.turnUserIds = state.turnUserIds.map(() => 0);
}
