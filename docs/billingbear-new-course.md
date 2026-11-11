# Billingbear New Course

Source: the user-supplied `2024-New-course-scorecard.pdf`.

This is a nine-hole, par-27 course. Tee totals are white 1,269 yards,
yellow 1,123 yards and red 1,065 yards. Every hole's par, stroke index
and three yardages are transcribed into `src/lib/course.ts` and checked
against the printed table in `tests/course.test.cjs`.

The map asset is a high-resolution crop of the scorecard's shared course
plan, credited to Clere Golf (printed reference 14912). Each hole view
uses a separate viewport and a highlighted tee-to-green line traced from
the New Course portion of that plan. Neighbouring holes may be visible.
These are schematic plan views, not GPS maps or surveyed layouts; the
printed yardages, rather than image distances, are authoritative.

The handicap field takes an **18-hole handicap**. For this nine-hole round,
that value is halved and rounded to the nearest whole stroke (halves round
up), then allocated over the nine stroke indexes. Handicap 18 gives one
stroke per hole; handicap 9 gives five strokes across the hardest holes. No Handicap Index
conversion is performed because course and slope ratings are not in the
supplied document. Results and navigation cover one nine-hole circuit.

Saved rounds use a new course-specific storage key so scores from the
previous 18-hole placeholder layout are not applied to different holes.
The previous storage entry is left untouched.

The source-plan image is cached by the service worker for offline play.
