export type TeeId = "red" | "yellow" | "white";

export type CourseHole = {
  number: number;
  par: number;
  strokeIndex: number;
  tees: Record<TeeId, number>;
};

export const teeOptions: { id: TeeId; label: string; color: string }[] = [
  { id: "red", label: "Red", color: "#bd5145" },
  { id: "yellow", label: "Yellow", color: "#d2a72c" },
  { id: "white", label: "White", color: "#ffffff" },
];

export const sampleCourse = {
  id: "north-course",
  name: "North Course",
  club: "Sample Golf Club",
  location: "Course preview",
  holes: [
    { number: 1, par: 4, strokeIndex: 7, tees: { red: 318, yellow: 347, white: 371 } },
    { number: 2, par: 3, strokeIndex: 15, tees: { red: 121, yellow: 143, white: 158 } },
    { number: 3, par: 5, strokeIndex: 3, tees: { red: 421, yellow: 468, white: 493 } },
    { number: 4, par: 4, strokeIndex: 11, tees: { red: 286, yellow: 326, white: 351 } },
    { number: 5, par: 4, strokeIndex: 1, tees: { red: 344, yellow: 382, white: 407 } },
    { number: 6, par: 3, strokeIndex: 17, tees: { red: 106, yellow: 129, white: 147 } },
    { number: 7, par: 5, strokeIndex: 5, tees: { red: 438, yellow: 482, white: 516 } },
    { number: 8, par: 4, strokeIndex: 9, tees: { red: 301, yellow: 338, white: 363 } },
    { number: 9, par: 4, strokeIndex: 13, tees: { red: 292, yellow: 329, white: 354 } },
    { number: 10, par: 4, strokeIndex: 8, tees: { red: 327, yellow: 361, white: 386 } },
    { number: 11, par: 5, strokeIndex: 4, tees: { red: 451, yellow: 496, white: 528 } },
    { number: 12, par: 3, strokeIndex: 18, tees: { red: 112, yellow: 137, white: 154 } },
    { number: 13, par: 4, strokeIndex: 2, tees: { red: 351, yellow: 389, white: 416 } },
    { number: 14, par: 4, strokeIndex: 12, tees: { red: 278, yellow: 317, white: 342 } },
    { number: 15, par: 5, strokeIndex: 6, tees: { red: 432, yellow: 477, white: 509 } },
    { number: 16, par: 3, strokeIndex: 16, tees: { red: 118, yellow: 141, white: 160 } },
    { number: 17, par: 4, strokeIndex: 10, tees: { red: 309, yellow: 346, white: 372 } },
    { number: 18, par: 4, strokeIndex: 14, tees: { red: 336, yellow: 374, white: 399 } },
  ] satisfies CourseHole[],
};