// Viewports and tee/green positions traced from the supplied 2024 scorecard.
// Coordinates refer to the 1710 x 720 crop of its shared course-plan artwork.
// Highlighted routes identify holes; they are not surveyed or GPS coordinates.
export const holeMaps = [
  { viewBox: "180 410 340 135", tee: [230, 474], green: [450, 470], route: "M230 474 L450 470" },
  { viewBox: "475 325 250 245", tee: [525, 365], green: [638, 499], route: "M525 365 L638 499" },
  { viewBox: "715 350 365 235", tee: [765, 446], green: [1022, 455], route: "M765 446 L1022 455" },
  { viewBox: "955 225 435 270", tee: [1024, 348], green: [1314, 328], route: "M1024 348 L1314 328" },
  { viewBox: "1220 190 475 280", tee: [1287, 255], green: [1588, 402], route: "M1287 255 L1588 402" },
  { viewBox: "1120 375 440 180", tee: [1487, 456], green: [1191, 450], route: "M1487 456 L1191 450" },
  { viewBox: "595 485 465 155", tee: [997, 553], green: [668, 556], route: "M997 553 L668 556" },
  { viewBox: "160 475 530 140", tee: [626, 536], green: [230, 550], route: "M626 536 L230 550" },
  { viewBox: "45 65 215 300", tee: [120, 310], green: [106, 126], route: "M120 310 L106 126" },
] as const;

// Old Course layouts share the nine physical holes on both circuits. The plan
// does not identify a separate surveyed tee position for each second-nine row.
export const oldHoleMaps = [
  { viewBox: "240 420 870 200", tee: [284, 514], green: [1040, 477], route: "M284 514 L788 553 L1040 477" },
  { viewBox: "600 250 600 220", tee: [1140, 408], green: [671, 310], route: "M1140 408 L766 405 L671 310" },
  { viewBox: "650 160 900 245", tee: [696, 208], green: [1469, 335], route: "M696 208 L1469 335" },
  { viewBox: "1140 370 410 165", tee: [1484, 416], green: [1195, 462], route: "M1484 416 L1195 462" },
  { viewBox: "1100 470 760 320", tee: [1168, 525], green: [1783, 702], route: "M1168 525 L1570 564 L1783 702" },
  { viewBox: "1100 580 800 300", tee: [1830, 810], green: [1166, 627], route: "M1830 810 L1443 653 L1166 627" },
  { viewBox: "810 710 330 300", tee: [1087, 765], green: [865, 932], route: "M1087 765 L865 932" },
  { viewBox: "650 590 490 330", tee: [745, 836], green: [1078, 648], route: "M745 836 L897 749 L1078 648" },
  { viewBox: "320 510 820 240", tee: [1067, 564], green: [374, 649], route: "M1067 564 L738 675 L374 649" },
] as const;
