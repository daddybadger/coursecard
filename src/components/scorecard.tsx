"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import type { ReactNode } from "react";
import { HolePager } from "@/components/hole-pager";
import { holeMaps, oldHoleMaps } from "@/lib/hole-maps";
import Link from "next/link";
import {
  ArrowRight,
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Flag,
  Menu,
  Home,
  Minus,
  Plus,
  Pencil,
  RotateCcw,
  Trash2,
  Trophy,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { getCourse, courseParLabel, teeOptions, type TeeId, type Course, type CourseId } from "@/lib/course";

import { holePar, holeStrokeIndex, netScoreForHole, playingOrder, validHandicap, type Round } from "@/lib/scoring";

// Retain the real-course storage key; round records include course and length.
const storageKey = "golf-scorecard-billingbear-new-2024-v1";

function subscribeToRound(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener("golf-scorecard-round-change", callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener("golf-scorecard-round-change", callback);
  };
}

function getStoredRound() {
  return localStorage.getItem(storageKey);
}

function parseRound(value: string | null): Round | null {
  if (!value) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    return isRound(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function saveRound(round: Round | null) {
  if (round) localStorage.setItem(storageKey, JSON.stringify(round));
  else localStorage.removeItem(storageKey);
  window.dispatchEvent(new Event("golf-scorecard-round-change"));
}

function updateRound(updater: (round: Round | null) => Round | null) {
  saveRound(updater(parseRound(getStoredRound())));
}

function isRound(value: unknown): value is Round {
  if (!value || typeof value !== "object") return false;
  const round = value as Partial<Round>;
  return (
    Array.isArray(round.players) &&
    round.players.length > 0 &&
    (round.tee === "red" || round.tee === "yellow" || round.tee === "white") &&
    typeof round.currentHole === "number" &&
    (round.courseId === undefined || round.courseId === "new" || round.courseId === "old") &&
    (round.holeCount === undefined || round.holeCount === 9 || round.holeCount === 18) &&
    !!round.scores
  );
}

export function Scorecard() {
  const storedRound = useSyncExternalStore(
    subscribeToRound,
    getStoredRound,
    () => null,
  );
  const round = parseRound(storedRound);
  const [playerNames, setPlayerNames] = useState([""]);
  const [playerTees, setPlayerTees] = useState<TeeId[]>(["white"]);
  const [playerHandicaps, setPlayerHandicaps] = useState<string[]>([""]);
  const [editingPlayer, setEditingPlayer] = useState<number | null>(0);
  const [selectedCourse, setSelectedCourse] = useState<CourseId>("new");
  const [holeCount, setHoleCount] = useState<9 | 18>(9);
  const [redPars, setRedPars] = useState<("men" | "women")[]>(["women"]);
  const course = getCourse(round?.courseId ?? selectedCourse, round?.holeCount ?? holeCount);

  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;

    void navigator.serviceWorker
      .register("/sw.js")
      .then(() => navigator.serviceWorker.ready)
      .then((registration) => {
        const worker = registration.active;
        if (!worker) return;

        const assets = performance
          .getEntriesByType("resource")
          .map((entry) => new URL(entry.name, location.href))
          .filter((url) => url.origin === location.origin && url.pathname.startsWith("/_next/static/"))
          .map((url) => `${url.pathname}${url.search}`);
        worker.postMessage({ type: "CACHE_ASSETS", urls: [...new Set(assets)] });
      })
      .catch(() => undefined);

  }, []);

  const isComplete = !!round && round.currentHole > course.holes.length;

  function startRound() {
    if (playerNames.some((name, index) => name.trim() && !validHandicap(playerHandicaps[index] ?? ""))) return;
    const players = playerNames
      .map((name, index) => ({ id: `${Date.now()}-${index}`, name: name.trim(), tee: playerTees[index] ?? "white",
        redPar: redPars[index] ?? "women",
        handicap: (playerHandicaps[index] ?? "").trim() === "" ? undefined : Number(playerHandicaps[index]),
      }))
      .filter((player) => player.name);
    if (players.length === 0) return;

    const scores = Object.fromEntries(
      course.holes.map((hole) => [hole.number, players.map(() => null)]),
    );
    saveRound({ players, tee: "white", scores, currentHole: 1, courseId: selectedCourse, holeCount: course.holes.length as 9 | 18 });
  }

  function changeHole(direction: -1 | 1) {
    updateRound((previous) => {
      if (!previous) return previous;
      return {
        ...previous,
        currentHole: Math.max(
          1,
          Math.min(course.holes.length + 1, previous.currentHole + direction),
        ),
      };
    });
  }

  function changeScore(playerIndex: number, amount: -1 | 0 | 1) {
    updateRound((previous) => {
      if (!previous || previous.currentHole > course.holes.length) return previous;
      const scores = [...previous.scores[previous.currentHole]];
      const score = scores[playerIndex];
      scores[playerIndex] = score == null
        ? holePar(course.holes[previous.currentHole - 1], previous.players[playerIndex])
        : Math.max(1, Math.min(20, score + amount));
      return {
        ...previous,
        scores: { ...previous.scores, [previous.currentHole]: scores },
      };
    });
  }

  function updatePlayerName(index: number, name: string) {
    setPlayerNames((previous) => previous.map((player, i) => (i === index ? name : player)));
  }

  function clearRound() {
    saveRound(null);
    setPlayerNames([""]);
    setPlayerTees(["white"]);
    setPlayerHandicaps([""]);
    setEditingPlayer(0);
    setSelectedCourse("new");
    setHoleCount(9);
    setRedPars(["women"]);
  }

  function goHome() {
    if (round && !isComplete && !window.confirm("Cancel this round and return to the homepage? Your scores for this round will be deleted.")) return false;
    if (round) clearRound();
    return true;
  }

  function renderHole(holeNumber: number, navigate: (direction: -1 | 1) => void): ReactNode {
    if (!round) return null;
    const currentHole = course.holes[holeNumber - 1];
    if (!currentHole) return <ResultsScreen round={round} onNewRound={clearRound} />;
    const mixedFacts = round.players.some((player) => holePar(currentHole, player) !== holePar(currentHole, round.players[0]) || holeStrokeIndex(currentHole, player) !== holeStrokeIndex(currentHole, round.players[0]));
    return (
      <section
        aria-label={`Hole ${currentHole.number} score entry`}
        className="hole-screen"
      >
        <div className="hole-heading">
          <div>
            <p className="eyebrow">{course.name}</p>
            <h1>Hole <span>{currentHole.number}</span></h1>
          </div>
          <div className={mixedFacts ? "hole-facts has-mixed-facts" : "hole-facts"}>
            <div><span>Par</span><strong>{Array.from(new Set(round.players.map((player) => holePar(currentHole, player)))).sort().join("/")}</strong></div>
            <div><span>Stroke index</span><strong>{Array.from(new Set(round.players.map((player) => holeStrokeIndex(currentHole, player)))).sort((a, b) => a - b).join("/")}</strong></div>
          </div>
        </div>

        <div className="hole-progress" role="progressbar" aria-label="Round progress" aria-valuemin={0} aria-valuemax={course.holes.length} aria-valuenow={currentHole.number}>
          <div className="progress-track">
            <span style={{ width: `${(currentHole.number / course.holes.length) * 100}%` }} />
          </div>
        </div>

        <div className="hole-layout">
          <section className="map-panel" aria-label="Hole map and tee distance">
            <div className="map-panel-head">
              {teeOptions.filter((option) => round.players.some((player) => (player.tee ?? round.tee) === option.id)).map((option) => (
                <span className="map-distance" key={option.id}>
                  <span className={`tee-dot tee-${option.id}`} aria-hidden="true" />
                  <span>{option.label} <strong>{currentHole.tees[option.id]} <small>yd</small></strong></span>
                </span>
              ))}
            </div>
            <HoleMap holeNumber={currentHole.number} courseId={course.id} />
          </section>

          <section className="players-panel" aria-label="Player scores">
            <div className="player-score-list">
              {playingOrder(round, currentHole.number, course.holes).map((index) => {
                const player = round.players[index];
                const score = round.scores[currentHole.number][index];
                const playerTee = player.tee ?? round.tee;
                return (
                  <div className="player-score-row" key={player.id}>
                    <div className="player-identity">
                      <div><strong>{player.name}</strong><span className="player-tee"><span className={`tee-dot tee-${playerTee}`} aria-hidden="true" />{teeOptions.find((option) => option.id === playerTee)?.label} tees{player.handicap != null && <span className="player-handicap"> / HCP {player.handicap}</span>}</span>{mixedFacts && <span className="player-hole-facts">Par {holePar(currentHole, player)} / SI {holeStrokeIndex(currentHole, player)}</span>}</div>
                    </div>
                    <div className="score-stepper" aria-label={`${player.name} score`}>
                      <Button
                        aria-label={`Lower ${player.name}'s score`}
                        className="score-step-button"
                        disabled={score !== null && score <= 1}
                        onClick={() => changeScore(index, -1)}
                        size="icon-lg"
                        variant="outline"
                      ><Minus /></Button>
                      <div className="score-display" aria-live="polite">
                        {score == null ? (
                          <button type="button" className="score-placeholder-button"
                            aria-label={`Enter par ${holePar(currentHole, player)} for ${player.name}`}
                            onClick={() => changeScore(index, 0)}>{"\u2014"}</button>
                        ) : (
                          <output aria-label={`${player.name}: gross ${score} strokes`} className="score-value">{score}</output>
                        )}
                        {score != null && player.handicap != null && (
                          <span className="net-score">Net {netScoreForHole(score, player, currentHole, course.holes)}</span>
                        )}
                      </div>
                      <Button
                        aria-label={`Raise ${player.name}'s score`}
                        className="score-step-button"
                        disabled={score !== null && score >= 20}
                        onClick={() => changeScore(index, 1)}
                        size="icon-lg"
                        variant="outline"
                      ><Plus /></Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>

        <div className="round-navigation">
          <Button
            className="nav-button nav-previous"
            disabled={currentHole.number === 1}
            onClick={() => navigate(-1)}
            variant="outline"
          ><ChevronLeft /><span>Previous</span></Button>
          <Button className="nav-button nav-next" onClick={() => navigate(1)}>
            <span>{currentHole.number === course.holes.length ? "Results" : "Next hole"}</span>
            {currentHole.number === course.holes.length ? <Trophy /> : <ChevronRight />}
          </Button>
        </div>
      </section>
    );
  }

  return (
    <div className="app-backdrop">
      <header className="site-header">
        <div className="topbar">
        <Link aria-label="Course Card home" className="wordmark" href="/" onClick={(event) => {
          event.preventDefault();
          goHome();
        }}>
          <span className="wordmark-icon"><Flag size={17} strokeWidth={2.2} /></span>
          <span>Course Card</span>
        </Link>
        <div className="course-context">
          <span className="context-club">{course.club}</span>
          <span className="context-course">{course.name}</span>
        </div>
        <details className="header-menu" onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.currentTarget.removeAttribute("open");
            event.currentTarget.querySelector("summary")?.focus();
          }
        }}>
          <summary aria-label="Main menu"><Menu aria-hidden="true" size={28} /></summary>
          <nav aria-label="Main navigation">
            <button type="button" onClick={(event) => {
              if (!goHome()) return;
              event.currentTarget.closest("details")?.removeAttribute("open");
            }}><Home aria-hidden="true" size={22} /> Homepage</button>
          </nav>
        </details>
        </div>
      </header>

      <main className="main-content">
        {!round ? (
          <SetupScreen
            names={playerNames}
            course={course}
            onCourseChange={(id) => { setSelectedCourse(id); setHoleCount(9); }}
            onHoleCountChange={setHoleCount}
            redPars={redPars}
            onRedParChange={(index, value) => setRedPars((previous) => previous.map((item, i) => i === index ? value : item))}
            editingPlayer={editingPlayer}
            onEditPlayer={setEditingPlayer}
            onSavePlayer={(index) => {
              if (!playerNames[index].trim() || !validHandicap(playerHandicaps[index] ?? "")) return;
              const pending = playerNames.findIndex((name, i) => i !== index && !name.trim());
              setEditingPlayer(pending === -1 ? null : pending);
            }}
            playerTees={playerTees}
            handicaps={playerHandicaps}
            onHandicapChange={(index, value) => setPlayerHandicaps((previous) => previous.map((item, i) => i === index ? value : item))}
            onPlayerTeeChange={(index, value) => setPlayerTees((previous) => previous.map((item, i) => i === index ? value : item))}
            onNameChange={updatePlayerName}
            onAddPlayer={() => {
              if (playerNames.length >= 4 || playerNames.some((name, index) => !name.trim() || !validHandicap(playerHandicaps[index] ?? ""))) return;
              setEditingPlayer(playerNames.length);
              setPlayerNames((previous) => [...previous, ""]);
              setPlayerTees((previous) => [...previous, "white"]);
              setPlayerHandicaps((previous) => [...previous, ""]);
              setRedPars((previous) => [...previous, "women"]);
            }}
            onRemovePlayer={(index) => {
              const pending = playerNames.filter((_, i) => i !== index).findIndex((name) => !name.trim());
              setEditingPlayer((previous) => previous === index ? (pending === -1 ? null : pending) : previous !== null && previous > index ? previous - 1 : previous);
              setPlayerNames((previous) => previous.filter((_, i) => i !== index));
              setPlayerTees((previous) => previous.filter((_, i) => i !== index));
              setPlayerHandicaps((previous) => previous.filter((_, i) => i !== index));
              setRedPars((previous) => previous.filter((_, i) => i !== index));
            }}
            onStart={startRound}
          />
        ) : isComplete ? (
          <ResultsScreen round={round} onNewRound={clearRound} />
        ) : (
          <HolePager
            key={round.currentHole}
            hole={round.currentHole}
            lastHole={course.holes.length}
            onNavigate={changeHole}
            renderHole={renderHole}
          />
        )}
      </main>


    </div>
  );
}

function SetupScreen({
  names,
  course,
  onCourseChange,
  onHoleCountChange,
  redPars,
  onRedParChange,
  editingPlayer,
  onEditPlayer,
  onSavePlayer,
  playerTees,
  handicaps,
  onHandicapChange,
  onPlayerTeeChange,
  onNameChange,
  onAddPlayer,
  onRemovePlayer,
  onStart,
}: {
  names: string[];
  course: Course;
  onCourseChange: (id: CourseId) => void;
  onHoleCountChange: (count: 9 | 18) => void;
  redPars: ("men" | "women")[];
  onRedParChange: (index: number, value: "men" | "women") => void;
  editingPlayer: number | null;
  onEditPlayer: (index: number) => void;
  onSavePlayer: (index: number) => void;
  playerTees: TeeId[];
  handicaps: string[];
  onHandicapChange: (index: number, handicap: string) => void;
  onPlayerTeeChange: (index: number, tee: TeeId) => void;
  onNameChange: (index: number, name: string) => void;
  onAddPlayer: () => void;
  onRemovePlayer: (index: number) => void;
  onStart: () => void;
}) {
  const canStart = names.some((name) => name.trim().length > 0) &&
    names.every((name, index) => !name.trim() || validHandicap(handicaps[index] ?? ""));

  const canAdd = names.length < 4 && names.every((name, index) => name.trim() && validHandicap(handicaps[index] ?? ""));
  const canSwitch = editingPlayer === null || !names[editingPlayer]?.trim() || validHandicap(handicaps[editingPlayer] ?? "");

  return (
    <section className="setup-screen">
      <div className="setup-intro">
        <h1>{course.club}</h1>
      </div>

      <div className="setup-grid">
        <section className="setup-panel course-panel">
          <div className="course-card-heading">
            <h2>{course.name}</h2>
            <button type="button" className="course-switch-link" onClick={() => onCourseChange(course.id === "new" ? "old" : "new")}>
              {course.id === "old" ? "New Course" : "Old Course"}<ChevronRight size={18} aria-hidden="true" />
            </button>
          </div>
          {course.id === "old" && (
            <div className="round-length-options" role="group" aria-label="Round length">
              {([9, 18] as const).map((count) => <button key={count} type="button" aria-pressed={course.holes.length === count} onClick={() => onHoleCountChange(count)}>{count} holes</button>)}
            </div>
          )}
              <p className="course-overline">{course.holes.length} holes <i /> Par {courseParLabel(course)}</p>
              <dl className="course-distances" aria-label="Course distance by tee">
                {teeOptions.map((option) => {
                  const total = course.holes.reduce((sum, hole) => sum + hole.tees[option.id], 0);
                  return (
                    <div className="course-distance" key={option.id}>
                      <dt><span className={`tee-dot tee-${option.id}`} aria-hidden="true" />{option.label}</dt>
                      <dd>{total.toLocaleString()} <span>yd</span></dd>
                    </div>
                  );
                })}
              </dl>
        </section>

        <section className="setup-panel players-setup-panel">
          <div className="panel-heading">
            <h2>Players</h2>
            <span className="player-count">{names.filter((name) => name.trim()).length} / 4</span>
          </div>
          <div className="player-input-list">
            {names.map((name, index) => index !== editingPlayer ? (
              name.trim() && <div className="player-summary" key={index}>
                <div className="player-summary-info">
                  <strong>{name.trim()}</strong>
                  <span><span className={`tee-dot tee-${playerTees[index] ?? "white"}`} aria-hidden="true" />
                    {teeOptions.find((option) => option.id === (playerTees[index] ?? "white"))?.label} tees
                    {(handicaps[index] ?? "").trim() !== "" && <> / HCP {Number(handicaps[index])}</>}
                    {course.id === "old" && playerTees[index] === "red" && <span> / {redPars[index] === "men" ? "Men" : "Women"}</span>}
                  </span>
                </div>
                <Button aria-label={`Edit ${name.trim()}`} className="edit-player-button" size="icon-lg" variant="outline"
                  disabled={!canSwitch} onClick={() => onEditPlayer(index)}><Pencil aria-hidden="true" /></Button>
              </div>
            ) : (
              <fieldset className="player-setup-entry" key={index}>
                <legend>Player {index + 1}</legend>
                <div className="player-input-row">
                  <span className="player-input-number">{index + 1}</span>
                  <label className="sr-only" htmlFor={`player-${index}`}>Player {index + 1} name</label>
                  <input
                    autoComplete="off"
                    id={`player-${index}`}
                    maxLength={24}
                    onChange={(event) => onNameChange(index, event.target.value)}
                    placeholder={`Player ${index + 1} name`}
                    value={name}
                  />
                  {names.length > 1 && (
                    <Button
                      aria-label={`Remove player ${index + 1}`}
                      className="remove-player-button"
                      onClick={() => onRemovePlayer(index)}
                      size="icon-sm"
                      variant="ghost"
                    ><Trash2 /></Button>
                  )}
                </div>
                <div className="handicap-field">
                  <label htmlFor={`handicap-${index}`}>Handicap <span>(18-hole, optional)</span></label>
                  <input id={`handicap-${index}`} type="number" inputMode="numeric"
                    min={0} max={54} step={1} placeholder="0-54"
                    value={handicaps[index] ?? ""}
                    aria-invalid={!validHandicap(handicaps[index] ?? "")}
                    aria-describedby={!validHandicap(handicaps[index] ?? "") ? `handicap-error-${index}` : undefined}
                    onChange={(event) => onHandicapChange(index, event.target.value)} />
                  {!validHandicap(handicaps[index] ?? "") && <p id={`handicap-error-${index}`} className="handicap-error">Use a whole number from 0 to 54.</p>}
                </div>
                <div className="player-tee-options" role="group" aria-label={`Player ${index + 1} tees`}>
                  {teeOptions.map((option) => (
                    <button key={option.id} type="button"
                      aria-pressed={(playerTees[index] ?? "white") === option.id}
                      onClick={() => onPlayerTeeChange(index, option.id)}>
                      <span className={`tee-dot tee-${option.id}`} aria-hidden="true" />{option.label}
                    </button>
                  ))}
                </div>
                {course.id === "old" && playerTees[index] === "red" && (
                  <div className="red-par-options" role="group" aria-label={`Player ${index + 1} red tee par`}>
                    <span>Red tee par</span>
                    {(["men", "women"] as const).map((category) => (
                      <button key={category} type="button" aria-pressed={(redPars[index] ?? "women") === category} onClick={() => onRedParChange(index, category)}>
                        {category === "men" ? "Men" : "Women"} / Par {course.holes.reduce((total, hole) => total + (hole.redPar?.[category] ?? hole.par), 0)}
                      </button>
                    ))}
                  </div>
                )}
                <Button className="save-player-button" disabled={!name.trim() || !validHandicap(handicaps[index] ?? "")}
                  onClick={() => onSavePlayer(index)}><Check aria-hidden="true" /> Done</Button>
              </fieldset>
            ))}
          </div>
          {names.length < 4 && (
            <Button className="add-player-button" disabled={!canAdd} onClick={onAddPlayer} variant="outline">
              <Plus /> Add player
            </Button>
          )}
          <div className="setup-bottom">
            <Button className="start-button" disabled={!canStart} onClick={onStart}>
              Start round <ArrowRight />
            </Button>
          </div>
        </section>
      </div>
    </section>
  );
}

function HoleMap({ holeNumber, courseId }: { holeNumber: number; courseId: CourseId }) {
  const map = courseId === "old" ? oldHoleMaps[(holeNumber - 1) % 9] : holeMaps[holeNumber - 1];
  if (!map) return null;
  return (
    <figure className="hole-map-figure">
      <div className="hole-map-art">
        <svg aria-label={`Hole ${holeNumber} scorecard plan, highlighted from tee to green`} role="img" viewBox={map.viewBox}>
          <desc>A cropped view of the printed 2024 course plan. The highlighted line identifies this hole; this is a schematic, not a GPS map.</desc>
          <image href={courseId === "old" ? "/maps/billingbear-old-course-2024.webp" : "/maps/billingbear-new-course-2024.webp"} width={courseId === "old" ? 1980 : 1710} height={courseId === "old" ? 1320 : 720} />
          <path d={map.route} fill="none" stroke="#123c2b" strokeWidth="7" vectorEffect="non-scaling-stroke" />
          <path d={map.route} fill="none" stroke="#e6ef72" strokeWidth="3" strokeDasharray="8 5" vectorEffect="non-scaling-stroke" />
          <circle cx={map.tee[0]} cy={map.tee[1]} r="9" fill="#e6ef72" stroke="#123c2b" strokeWidth="2" vectorEffect="non-scaling-stroke" />
          <circle cx={map.green[0]} cy={map.green[1]} r="14" fill="none" stroke="#123c2b" strokeWidth="3" vectorEffect="non-scaling-stroke" />
        </svg>
      </div>
      <figcaption>Clere Golf &copy; / 2024 scorecard plan{courseId === "old" && holeNumber > 9 && ` / Hole ${((holeNumber - 1) % 9) + 1} layout, second nine`}</figcaption>
    </figure>
  );
}

function ResultsScreen({ round, onNewRound }: { round: Round; onNewRound: () => void }) {
  const course = getCourse(round.courseId, round.holeCount);
  const totals = round.players.map((player, index) => {
    const playedHoles = course.holes.filter((hole) => round.scores[hole.number][index] != null);
    const score = playedHoles.reduce((sum, hole) => sum + round.scores[hole.number][index]!, 0);
    const playedPar = playedHoles.reduce((sum, hole) => sum + holePar(hole, player), 0);
    const net = player.handicap == null ? null : playedHoles.reduce((sum, hole) =>
      sum + netScoreForHole(round.scores[hole.number][index]!, player, hole, course.holes), 0);
    return { player, index, score, net, played: playedHoles.length, toPar: score - playedPar };
  });
  const complete = totals.every(({ played }) => played === course.holes.length);

  return (
    <section className="results-screen">
      <div className="results-heading">
        <p className="eyebrow">{complete ? "Round complete" : "Round summary"}</p>
        <h1>Your scores</h1>
        <p>{course.name} <i /> {course.holes.length} holes <i /> Par {courseParLabel(course)}</p>
      </div>
      <div className="results-player-list">
        {totals.map(({ player, index, score, net, played, toPar }) => (
          <article className="result-player-card" key={player.id} aria-label={`${player.name}'s results`}>
            <div className="result-player-summary">
              <div className="result-player-info">
                <h2>{player.name}</h2>
                <p><span className={`tee-dot tee-${player.tee ?? round.tee}`} aria-hidden="true" />
                  {teeOptions.find((option) => option.id === (player.tee ?? round.tee))?.label} tees
                  {player.handicap != null && <span> / HCP {player.handicap}</span>}
                  {course.id === "old" && player.tee === "red" && <span> / {player.redPar === "men" ? "Men" : "Women"}</span>}
                </p>
                <span className="result-progress">{played === course.holes.length ? (toPar === 0 ? "Even par" : `${toPar > 0 ? "+" : ""}${toPar} to par`) : `${played} / ${course.holes.length} holes scored`}</span>
              </div>
              <div className="result-totals">
                <div className="total-score" aria-label={played ? `Gross total ${score}` : "Gross total not entered"}>{played ? score : "\u2014"}<span>Gross</span></div>
                {net != null && played > 0 && <span className="result-net-total">Net <strong>{net}</strong></span>}
              </div>
            </div>
            <details className="result-hole-details">
              <summary>Hole scores<ChevronDown size={22} aria-hidden="true" /></summary>
              <table className="result-hole-table">
                <caption className="sr-only">{player.name}&apos;s hole-by-hole scores</caption>
                <thead><tr><th scope="col">Hole</th><th scope="col">Par</th><th scope="col">Gross</th>{player.handicap != null && <th scope="col">Net</th>}</tr></thead>
                <tbody>{course.holes.map((hole) => {
                  const gross = round.scores[hole.number][index];
                  return (
                    <tr key={hole.number}>
                      <th scope="row">{hole.number}</th><td>{holePar(hole, player)}</td><td>{gross ?? "\u2014"}</td>
                      {player.handicap != null && <td>{gross == null ? "\u2014" : netScoreForHole(gross, player, hole, course.holes)}</td>}
                    </tr>
                  );
                })}</tbody>
              </table>
            </details>
          </article>
        ))}
      </div>
      <div className="results-actions">
        <Button className="new-round-button" onClick={onNewRound}><RotateCcw /> New round</Button>
      </div>
    </section>
  );
}
