# Billingbear Old Course

Source: the user-supplied `2024-Old-course-scorecard.pdf`. The New Course
scorecard supplied earlier contains the shared map of both courses.

The Old Course offers a front-nine round or an 18-hole round over the
same nine physical layouts. Holes 10–18 use their own printed yardages,
pars and stroke indexes, not duplicated first-nine data.

| Round | White yards | Yellow yards | Red yards | White/yellow par | Red men's par | Red women's par |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 9 holes | 2,858 | 2,706 | 2,417 | 34 | 33 | 35 |
| 18 holes | 5,850 | 5,523 | 5,085 | 69 | 67 | 71 |

Red-tee players choose the printed men's or women's par in their entry
form; the default is visibly selected as women's par. Each red-tee hole
also uses the separate red stroke index column. Hole headers show a range
when players' pars or indexes differ, with individual values by each player.

The handicap field always accepts an **18-hole handicap**. A nine-hole
round uses half that value, rounded to the nearest whole stroke (halves
round up); an 18-hole round uses the whole value. For nine-hole rounds,
allocation uses the relative ascending order
of the front-nine indexes, a method described in
[USGA Appendix E](https://www.usga.org/handicapping/roh/Content/rules/Appendix%20E%20Stroke%20Index%20Allocation.htm).
The original printed indexes remain visible. Handicap Index conversion
and rating-based handicap calculation are outside this feature.

Every saved round stores its course and length, so reloading restores the
same holes and scoring rules. Existing real New Course rounds without
these new fields continue as nine-hole New Course rounds.

Map views are crops of the original Clere Golf artwork. Holes 10–18 reuse
layouts 1–9, and the caption identifies the second circuit. The source plan
does not separately identify second-nine tee coordinates, so no new tee
positions are invented. Printed yardages are authoritative. Both map assets
are included in offline caching.
