"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import type { ReactNode } from "react";
import { HolePager } from "@/components/hole-pager";
import Link from "next/link";
import {
  ArrowRight,
  Check,
  ChevronLeft,
  ChevronRight,
  Flag,
  Minus,
  Plus,
  RotateCcw,
  Trash2,
  Trophy,
  Wifi,
  WifiOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { sampleCourse, teeOptions, type TeeId } from "@/lib/course";

type Player = { id: string; name: string; tee?: TeeId };
type Round = {
  players: Player[];
  tee: TeeId;
  scores: Record<number, (number | null)[]>;
  currentHole: number;
};

const storageKey = "golf-scorecard-round-v1";

function subscribeOnlineStatus(callback: () => void) {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

function getOnlineStatus() {
  return navigator.onLine;
}

function getServerOnlineStatus() {
  return true;
}

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
  const isOnline = useSyncExternalStore(
    subscribeOnlineStatus,
    getOnlineStatus,
    getServerOnlineStatus,
  );

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

  const isComplete = !!round && round.currentHole > sampleCourse.holes.length;

  function startRound() {
    const players = playerNames
      .map((name, index) => ({ id: `${Date.now()}-${index}`, name: name.trim(), tee: playerTees[index] ?? "white" }))
      .filter((player) => player.name);
    if (players.length === 0) return;

    const scores = Object.fromEntries(
      sampleCourse.holes.map((hole) => [hole.number, players.map(() => null)]),
    );
    saveRound({ players, tee: "white", scores, currentHole: 1 });
  }

  function changeHole(direction: -1 | 1) {
    updateRound((previous) => {
      if (!previous) return previous;
      return {
        ...previous,
        currentHole: Math.max(
          1,
          Math.min(sampleCourse.holes.length + 1, previous.currentHole + direction),
        ),
      };
    });
  }

  function changeScore(playerIndex: number, amount: -1 | 1) {
    updateRound((previous) => {
      if (!previous || previous.currentHole > sampleCourse.holes.length) return previous;
      const scores = [...previous.scores[previous.currentHole]];
      const score = scores[playerIndex];
      scores[playerIndex] = score == null
        ? sampleCourse.holes[previous.currentHole - 1].par
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
  }

  function renderHole(holeNumber: number, navigate: (direction: -1 | 1) => void): ReactNode {
    if (!round) return null;
    const currentHole = sampleCourse.holes[holeNumber - 1];
    if (!currentHole) return <ResultsScreen round={round} onNewRound={clearRound} />;
    return (
      <section
        aria-label={`Hole ${currentHole.number} score entry`}
        className="hole-screen"
      >
        <div className="hole-heading">
          <div>
            <p className="eyebrow">{sampleCourse.name}</p>
            <h1>Hole <span>{currentHole.number}</span></h1>
          </div>
          <div className="hole-facts">
            <div><span>Par</span><strong>{currentHole.par}</strong></div>
            <div><span>Stroke index</span><strong>{currentHole.strokeIndex}</strong></div>
          </div>
        </div>

        <div className="hole-progress" role="progressbar" aria-label="Round progress" aria-valuemin={0} aria-valuemax={sampleCourse.holes.length} aria-valuenow={currentHole.number}>
          <div className="progress-track">
            <span style={{ width: `${(currentHole.number / sampleCourse.holes.length) * 100}%` }} />
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
            <HoleMap holeNumber={currentHole.number} />
          </section>

          <section className="players-panel" aria-label="Player scores">
            <div className="player-score-list">
              {round.players.map((player, index) => {
                const score = round.scores[currentHole.number][index];
                const playerTee = player.tee ?? round.tee;
                return (
                  <div className="player-score-row" key={player.id}>
                    <div className="player-identity">
                      <div><strong>{player.name}</strong><span className="player-tee"><span className={`tee-dot tee-${playerTee}`} aria-hidden="true" />{teeOptions.find((option) => option.id === playerTee)?.label} tees</span></div>
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
                      <output aria-live="polite" aria-label={score === null ? `${player.name}: score not entered` : `${player.name}: ${score} strokes`} className="score-value">{score ?? "\u2014"}</output>
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
            <span>{currentHole.number === sampleCourse.holes.length ? "Results" : "Next hole"}</span>
            {currentHole.number === sampleCourse.holes.length ? <Trophy /> : <ChevronRight />}
          </Button>
        </div>
      </section>
    );
  }

  return (
    <div className="app-backdrop">
      <header className="topbar">
        <Link aria-label="Coursecard home" className="wordmark" href="/">
          <span className="wordmark-icon"><Flag size={17} strokeWidth={2.2} /></span>
          <span>golf <span className="wordmark-light">scorecard</span></span>
        </Link>
        <div className="course-context">
          <span className="context-club">{sampleCourse.club}</span>
          <span className="context-course">{sampleCourse.name}</span>
        </div>
        <div className={`connection-status ${isOnline ? "is-online" : "is-offline"}`}>
          {isOnline ? <Wifi size={15} /> : <WifiOff size={15} />}
          <span>{isOnline ? "Online" : "Offline ready"}</span>
        </div>
      </header>

      <main className="main-content">
        {!round ? (
          <SetupScreen
            names={playerNames}
            playerTees={playerTees}
            onPlayerTeeChange={(index, value) => setPlayerTees((previous) => previous.map((item, i) => i === index ? value : item))}
            onNameChange={updatePlayerName}
            onAddPlayer={() => {
              setPlayerNames((previous) => [...previous, ""]);
              setPlayerTees((previous) => [...previous, "white"]);
            }}
            onRemovePlayer={(index) => {
              setPlayerNames((previous) => previous.filter((_, i) => i !== index));
              setPlayerTees((previous) => previous.filter((_, i) => i !== index));
            }}
            onStart={startRound}
          />
        ) : isComplete ? (
          <ResultsScreen round={round} onNewRound={clearRound} />
        ) : (
          <HolePager
            key={round.currentHole}
            hole={round.currentHole}
            lastHole={sampleCourse.holes.length}
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
  playerTees,
  onPlayerTeeChange,
  onNameChange,
  onAddPlayer,
  onRemovePlayer,
  onStart,
}: {
  names: string[];
  playerTees: TeeId[];
  onPlayerTeeChange: (index: number, tee: TeeId) => void;
  onNameChange: (index: number, name: string) => void;
  onAddPlayer: () => void;
  onRemovePlayer: (index: number) => void;
  onStart: () => void;
}) {
  const canStart = names.some((name) => name.trim().length > 0);

  return (
    <section className="setup-screen">
      <div className="setup-intro">
        <h1>{sampleCourse.club}</h1>
      </div>

      <div className="setup-grid">
        <section className="setup-panel course-panel">
          <div className="panel-heading">
            <h2>Course</h2>
          </div>
          <div className="course-nameplate">
            <strong>{sampleCourse.name}</strong>
            <span className="course-overline">{sampleCourse.holes.length} holes <i /> Par {sampleCourse.holes.reduce((total, hole) => total + hole.par, 0)}</span>
          </div>
          <dl className="course-distances" aria-label="Course distance by tee">
            {teeOptions.map((option) => {
              const total = sampleCourse.holes.reduce((sum, hole) => sum + hole.tees[option.id], 0);
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
            {names.map((name, index) => (
              <div className="player-setup-entry" key={index}>
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
                <div className="player-tee-options" role="group" aria-label={`Player ${index + 1} tees`}>
                  {teeOptions.map((option) => (
                    <button key={option.id} type="button"
                      aria-pressed={(playerTees[index] ?? "white") === option.id}
                      onClick={() => onPlayerTeeChange(index, option.id)}>
                      <span className={`tee-dot tee-${option.id}`} aria-hidden="true" />{option.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
          {names.length < 4 && (
            <Button className="add-player-button" onClick={onAddPlayer} variant="outline">
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

function HoleMap({ holeNumber }: { holeNumber: number }) {
  const isLeft = holeNumber % 2 === 0;
  return (
    <div className="hole-map-art">
      <svg aria-label={`Illustration of hole ${holeNumber}`} role="img" viewBox="0 0 640 220">
        <path className="map-rough" d="M0 0h640v220H0z" />
        <path className="map-fairway" d={isLeft ? "M38 138c99-54 133-50 214-45 100 6 172-17 356-65v105c-174 38-236 54-344 55-98 1-137 1-226 38z" : "M26 96c133-29 195-28 282-11 104 21 191 6 306-39v119c-115 30-206 43-311 25-92-15-154-5-277 27z"} />
        <path className="map-water" d={isLeft ? "M0 13c91 9 130 30 180 53 24 11 47 15 71 15v28c-44 4-77-5-112-23C87 56 57 42 0 39z" : "M501 0h139v67c-52 10-87 30-139 25-33-4-55-15-76-29z"} />
        <ellipse className="map-bunker" cx={isLeft ? "410" : "245"} cy="68" rx="33" ry="12" transform={isLeft ? "rotate(-12 410 68)" : "rotate(10 245 68)"} />
        <ellipse className="map-bunker" cx={isLeft ? "487" : "310"} cy="155" rx="27" ry="10" transform={isLeft ? "rotate(8 487 155)" : "rotate(-8 310 155)"} />
        <ellipse className="map-green" cx={isLeft ? "544" : "574"} cy="106" rx="44" ry="31" transform={isLeft ? "rotate(-20 544 106)" : "rotate(18 574 106)"} />
        <path className="map-green-ring" d={isLeft ? "M516 103c16-16 45-22 64-9" : "M546 111c13-19 42-27 61-16"} />
        <path className="map-route" d={isLeft ? "M63 139c100-49 160-52 242-48s146-14 228-38" : "M58 120c127-29 188-25 279-9 88 16 151 3 216-23"} />
        <circle className="map-tee" cx="63" cy={isLeft ? "139" : "120"} r="8" />
        <path className="map-pin" d={isLeft ? "M544 74v33" : "M574 73v33"} />
        <circle className="map-pin-head" cx={isLeft ? "544" : "574"} cy={isLeft ? "70" : "69"} r="5" />
      </svg>
      <span className="map-north">N <i /></span>
      <span className="map-start-label">TEE</span>
      <span className="map-green-label">GREEN</span>
    </div>
  );
}

function ResultsScreen({ round, onNewRound }: { round: Round; onNewRound: () => void }) {
  const totals = round.players.map((player, index) => {
    const score = sampleCourse.holes.reduce(
      (sum, hole) => sum + (round.scores[hole.number][index] ?? 0),
      0,
    );
    const played = sampleCourse.holes.filter((hole) => round.scores[hole.number][index] != null);
    const playedPar = played.reduce((sum, hole) => sum + hole.par, 0);
    return { player, index, score, played: played.length, toPar: score - playedPar };
  });

  return (
    <section className="results-screen">
      <div className="results-heading">
        <span className="results-icon"><Trophy size={23} /></span>
        <p className="eyebrow">Round complete</p>
        <h1>That&apos;s the round.</h1>
        <p>{sampleCourse.name} <i /> 18 holes</p>
      </div>
      <div className="results-table-wrap">
        <table className="results-table">
          <thead><tr><th>Player</th>{sampleCourse.holes.map((hole) => <th key={hole.number}>{hole.number}</th>)}<th>Par</th><th>Total</th></tr></thead>
          <tbody>
            {totals.map(({ player, index, score, toPar, played }) => (
              <tr key={player.id}>
                <th scope="row"><span className="result-avatar">{player.name.slice(0, 1).toUpperCase()}</span>{player.name}</th>
                {sampleCourse.holes.map((hole) => <td key={hole.number}>{round.scores[hole.number][index] ?? "\u2014"}</td>)}
                <td>72</td>
                <td className="total-score">{played ? score : "\u2014"}<small>{played === sampleCourse.holes.length ? (toPar === 0 ? "E" : toPar > 0 ? `+${toPar}` : toPar) : `${played}/${sampleCourse.holes.length} scored`}</small></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="results-actions">
        <span><Check size={16} /> Round saved on this device</span>
        <Button className="start-button" onClick={onNewRound}><RotateCcw /> New round</Button>
      </div>
    </section>
  );
}