import { normalizedResult, type GameSummary } from "shared";
export function matchOutcome(
  game: GameSummary,
  viewerId?: number,
  locale = "ru",
): string {
  const en = locale === "en";
  if (game.status === "active") return en ? "In progress" : "Идёт партия";
  if (game.status === "abandoned")
    return en
      ? "Abandoned · no rating change"
      : "Не завершена · без изменения рейтинга";
  const result = normalizedResult(game);
  if (result === "1/2-1/2") return en ? "Draw" : "Ничья";
  if (result === "*") return en ? "Result unavailable" : "Результат не указан";
  const winner = result === "1-0" ? 1 : 2;
  const me = game.participants.find((p) => p.userId === viewerId);
  return me
    ? me.team === winner
      ? en
        ? "Your team won"
        : "Ваша команда победила"
      : en
        ? "Your team lost"
        : "Ваша команда проиграла"
    : en
      ? `Team ${winner} won`
      : `Победила команда ${winner}`;
}
export function ratingLabel(
  game: Pick<GameSummary, "ratingKind">,
  locale = "ru",
): string {
  const en = locale === "en";
  return game.ratingKind === "rated"
    ? en
      ? "Rated"
      : "Рейтинговая"
    : game.ratingKind === "guest"
      ? en
        ? "Training · guest in match"
        : "Тренировочная · с гостем"
      : game.ratingKind === "bots"
        ? en
          ? "Training · against bots"
          : "Тренировочная · против ботов"
        : en
          ? "Archive · former common rating"
          : "Архив · прежний общий рейтинг";
}
export function endReason(game: GameSummary, locale = "ru"): string {
  const en = locale === "en";
  const reasons: Record<string, string> = en
    ? {
        checkmate: "Checkmate",
        resign: "Resignation",
        timeout: "Time ran out",
        stalemate:
          game.mode === "bughouse"
            ? "Stalemate — loss under Bughouse rules"
            : "Stalemate",
        material: "Insufficient material",
        repetition: "Threefold repetition",
        fifty: "50-move rule",
        abandoned: "Game interrupted",
      }
    : {
        checkmate: "Мат",
        resign: "Сдача",
        timeout: "Время истекло",
        stalemate:
          game.mode === "bughouse"
            ? "Пат — поражение по правилам багхауса"
            : "Пат",
        material: "Недостаточно материала",
        repetition: "Троекратное повторение",
        fifty: "Правило 50 ходов",
        abandoned: "Партия прервана",
      };
  const reason = reasons[game.reason ?? ""] ?? "";
  return (
    reason +
    (game.mode === "bughouse" && game.endBoardIndex != null
      ? en
        ? ` · board ${game.endBoardIndex + 1}`
        : ` · доска №${game.endBoardIndex + 1}`
      : "")
  );
}
