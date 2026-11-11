import type { CourseHole, TeeId } from "./course";

export type Player = { id: string; name: string; tee?: TeeId; handicap?: number };
export type Round = {
  players: Player[];
  tee: TeeId;
  scores: Record<number, (number | null)[]>;
  currentHole: number;
};

export function validHandicap(value: string) {
  if (value.trim() === "") return true;
  const handicap = Number(value);
  return Number.isInteger(handicap) && handicap >= 0 && handicap <= 54;
}

export function netScore(gross: number, handicap: number, strokeIndex: number) {
  const strokes = Math.floor(handicap / 18) + (strokeIndex <= handicap % 18 ? 1 : 0);
  return gross - strokes;
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
      netScore(scores[a]!, round.players[a].handicap ?? 0, hole.strokeIndex) -
      netScore(scores[b]!, round.players[b].handicap ?? 0, hole.strokeIndex),
    );
  }
  return order;
}
