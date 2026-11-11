export type CourseId = "new" | "old";

export type TeeId = "red" | "yellow" | "white";

export type CourseHole = {
  number: number;
  par: number;
  strokeIndex: number;
  tees: Record<TeeId, number>;
  redPar?: { men: number; women: number };
  redStrokeIndex?: number;
};

export const teeOptions: { id: TeeId; label: string; color: string }[] = [
  { id: "red", label: "Red", color: "#bd5145" },
  { id: "yellow", label: "Yellow", color: "#d2a72c" },
  { id: "white", label: "White", color: "#ffffff" },
];

export const sampleCourse = {
  id: "new" as CourseId,
  name: "New Course",
  club: "Billingbear Golf Course",
  location: "Billingbear Park",
  // Source: supplied 2024-New-course-scorecard.pdf (nine-hole New Course).
  holes: [
    { number: 1, par: 3, strokeIndex: 7, tees: { red: 113, yellow: 113, white: 113 } },
    { number: 2, par: 3, strokeIndex: 9, tees: { red: 102, yellow: 102, white: 102 } },
    { number: 3, par: 3, strokeIndex: 3, tees: { red: 74, yellow: 96, white: 148 } },
    { number: 4, par: 3, strokeIndex: 1, tees: { red: 114, yellow: 131, white: 131 } },
    { number: 5, par: 3, strokeIndex: 5, tees: { red: 132, yellow: 132, white: 168 } },
    { number: 6, par: 3, strokeIndex: 4, tees: { red: 140, yellow: 140, white: 198 } },
    { number: 7, par: 3, strokeIndex: 6, tees: { red: 145, yellow: 145, white: 145 } },
    { number: 8, par: 3, strokeIndex: 2, tees: { red: 175, yellow: 175, white: 175 } },
    { number: 9, par: 3, strokeIndex: 8, tees: { red: 70, yellow: 89, white: 89 } },
  ] satisfies CourseHole[],
};
// Source: supplied 2024-Old-course-scorecard.pdf. Second-nine entries are distinct.
export const oldCourseHoles: CourseHole[] = [
  { number: 1, par: 4, strokeIndex: 5, tees: { red: 263, yellow: 385, white: 395 }, redPar: { men: 4, women: 4 }, redStrokeIndex: 5 },
  { number: 2, par: 4, strokeIndex: 17, tees: { red: 284, yellow: 298, white: 305 }, redPar: { men: 4, women: 4 }, redStrokeIndex: 16 },
  { number: 3, par: 5, strokeIndex: 13, tees: { red: 403, yellow: 454, white: 467 }, redPar: { men: 4, women: 5 }, redStrokeIndex: 11 },
  { number: 4, par: 3, strokeIndex: 11, tees: { red: 141, yellow: 153, white: 159 }, redPar: { men: 3, women: 3 }, redStrokeIndex: 9 },
  { number: 5, par: 4, strokeIndex: 2, tees: { red: 337, yellow: 354, white: 383 }, redPar: { men: 4, women: 4 }, redStrokeIndex: 2 },
  { number: 6, par: 4, strokeIndex: 7, tees: { red: 302, yellow: 350, white: 390 }, redPar: { men: 4, women: 4 }, redStrokeIndex: 7 },
  { number: 7, par: 3, strokeIndex: 15, tees: { red: 141, yellow: 150, white: 179 }, redPar: { men: 3, women: 3 }, redStrokeIndex: 13 },
  { number: 8, par: 3, strokeIndex: 9, tees: { red: 196, yellow: 204, white: 210 }, redPar: { men: 3, women: 4 }, redStrokeIndex: 18 },
  { number: 9, par: 4, strokeIndex: 6, tees: { red: 350, yellow: 358, white: 370 }, redPar: { men: 4, women: 4 }, redStrokeIndex: 3 },
  { number: 10, par: 4, strokeIndex: 3, tees: { red: 375, yellow: 385, white: 427 }, redPar: { men: 4, women: 5 }, redStrokeIndex: 6 },
  { number: 11, par: 4, strokeIndex: 16, tees: { red: 325, yellow: 329, white: 331 }, redPar: { men: 4, women: 4 }, redStrokeIndex: 15 },
  { number: 12, par: 5, strokeIndex: 12, tees: { red: 403, yellow: 454, white: 487 }, redPar: { men: 4, women: 5 }, redStrokeIndex: 12 },
  { number: 13, par: 3, strokeIndex: 10, tees: { red: 141, yellow: 153, white: 159 }, redPar: { men: 3, women: 3 }, redStrokeIndex: 10 },
  { number: 14, par: 4, strokeIndex: 1, tees: { red: 354, yellow: 383, white: 406 }, redPar: { men: 4, women: 4 }, redStrokeIndex: 1 },
  { number: 15, par: 4, strokeIndex: 8, tees: { red: 316, yellow: 350, white: 352 }, redPar: { men: 4, women: 4 }, redStrokeIndex: 8 },
  { number: 16, par: 3, strokeIndex: 14, tees: { red: 160, yellow: 161, white: 184 }, redPar: { men: 3, women: 3 }, redStrokeIndex: 14 },
  { number: 17, par: 4, strokeIndex: 18, tees: { red: 244, yellow: 244, white: 245 }, redPar: { men: 4, women: 4 }, redStrokeIndex: 17 },
  { number: 18, par: 4, strokeIndex: 4, tees: { red: 350, yellow: 358, white: 401 }, redPar: { men: 4, women: 4 }, redStrokeIndex: 4 },
];

export type Course = { id: CourseId; name: string; club: string; location: string; holes: CourseHole[] };

export function getCourse(id: CourseId = "new", holeCount: 9 | 18 = 9): Course {
  if (id === "new") return sampleCourse;
  return { id: "old", name: "Old Course", club: sampleCourse.club, location: sampleCourse.location,
    holes: oldCourseHoles.slice(0, holeCount) };
}

export function courseParLabel(course: Course) {
  const totals = [course.holes.reduce((sum, hole) => sum + hole.par, 0)];
  if (course.id === "old") {
    for (const category of ["men", "women"] as const) totals.push(course.holes.reduce((sum, hole) => sum + (hole.redPar?.[category] ?? hole.par), 0));
  }
  const low = Math.min(...totals), high = Math.max(...totals);
  return low === high ? String(low) : `${low}-${high}`;
}
