import type { CourseHole, CourseId, TeeId } from "./course";

export type Player = { id: string; name: string; tee?: TeeId; handicap?: number; redPar?: "men" | "women" };
export type Round = {
  players: Player[];
  tee: TeeId;
  scores: Record<number, (number | null)[]>;
  currentHole: number;
  courseId?: CourseId;
  holeCount?: 9 | 18;
};

export function validHandicap(value: string) {
  if (value.trim() === "") return true;
  const handicap = Number(value);
  return Number.isInteger(handicap) && handicap >= 0 && handicap <= 54;
}

export function netScore(gross: number, handicap: number, strokeIndex: number, holeCount = 18) {
  // Entry always uses an 18-hole handicap, even when only nine holes are played.
  const roundHandicap = holeCount === 9 ? Math.round(handicap / 2) : handicap;
  const strokes = Math.floor(roundHandicap / holeCount) + (strokeIndex <= roundHandicap % holeCount ? 1 : 0);
  return gross - strokes;
}

export function holePar(hole: CourseHole, player: Player) {
  return player.tee === "red" && hole.redPar ? hole.redPar[player.redPar ?? "women"] : hole.par;
}

export function holeStrokeIndex(hole: CourseHole, player: Player) {
  return player.tee === "red" ? hole.redStrokeIndex ?? hole.strokeIndex : hole.strokeIndex;
}

export function netScoreForHole(gross: number, player: Player, hole: CourseHole, holes: CourseHole[]) {
  const printedIndex = holeStrokeIndex(hole, player);
  // A nine-hole round uses the relative difficulty of just those nine indexes.
  const allocationIndex = holes.length === 9
    ? holes.filter((candidate) => holeStrokeIndex(candidate, player) < printedIndex).length + 1
    : printedIndex;
  return netScore(gross, player.handicap ?? 0, allocationIndex, holes.length);
}

// Keep score arrays in their original player order; only reorder their display.
export function playingOrder(round: Round, holeNumber: number, holes: CourseHole[]) {
  const order = round.players.map((_, index) => index);
  for (const hole of holes) {
    if (hole.number >= holeNumber) break;
    const scores = round.scores[hole.number];
    if (!scores || order.some((index) => scores[index] == null)) continue;
    // Stable sorting preserves the previous tee order when net scores are tied.
    order.sort((a, b) =>
      netScoreForHole(scores[a]!, round.players[a], hole, holes) -
      netScoreForHole(scores[b]!, round.players[b], hole, holes),
    );
  }
  return order;
}
