"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { TouchEvent } from "react";
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

type Player = { id: string; name: string };
type Round = {
  players: Player[];
  tee: TeeId;
  scores: Record<number, number[]>;
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

function scoreLabel(score: number, par: number) {
  const difference = score - par;
  if (difference <= -3) return "Albatross";
  if (difference === -2) return "Eagle";
  if (difference === -1) return "Birdie";
  if (difference === 0) return "Par";
  if (difference === 1) return "Bogey";
  if (difference === 2) return "Double bogey";
  return `+${difference}`;
}

export function Scorecard() {
  const storedRound = useSyncExternalStore(
    subscribeToRound,
    getStoredRound,
    () => null,
  );
  const round = parseRound(storedRound);
  const [playerNames, setPlayerNames] = useState([""]);
  const [tee, setTee] = useState<TeeId>("white");
  const [offlineReady, setOfflineReady] = useState(false);
  const isOnline = useSyncExternalStore(
    subscribeOnlineStatus,
    getOnlineStatus,
    getServerOnlineStatus,
  );
  const touchStart = useRef<number | null>(null);

  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    let active = true;

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
        const channel = new MessageChannel();
        channel.port1.onmessage = (event: MessageEvent<{ type?: string }>) => {
          if (event.data?.type === "CACHE_READY" && active) setOfflineReady(true);
          channel.port1.close();
        };
        worker.postMessage({ type: "CACHE_ASSETS", urls: [...new Set(assets)] }, [channel.port2]);
      })
      .catch(() => undefined);

    return () => {
      active = false;
    };
  }, []);

  const currentHole = round
    ? sampleCourse.holes[round.currentHole - 1]
    : undefined;
  const isComplete = !!round && round.currentHole > sampleCourse.holes.length;

  function startRound() {
    const players = playerNames
      .map((name) => name.trim())
      .filter(Boolean)
      .map((name, index) => ({ id: `${Date.now()}-${index}`, name }));
    if (players.length === 0) return;

    const scores = Object.fromEntries(
      sampleCourse.holes.map((hole) => [hole.number, players.map(() => hole.par)]),
    );
    saveRound({ players, tee, scores, currentHole: 1 });
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
      scores[playerIndex] = Math.max(1, Math.min(20, scores[playerIndex] + amount));
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
    setTee("white");
  }

  function handleTouchStart(event: TouchEvent<HTMLElement>) {
    const target = event.target as HTMLElement;
    touchStart.current = target.closest("button, input, a")
      ? null
      : event.touches[0]?.clientX ?? null;
  }

  function handleTouchEnd(event: TouchEvent<HTMLElement>) {
    const start = touchStart.current;
    touchStart.current = null;
    if (start === null) return;
    const difference = (event.changedTouches[0]?.clientX ?? start) - start;
    if (difference < -70) changeHole(1);
    if (difference > 70) changeHole(-1);
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
            tee={tee}
            onNameChange={updatePlayerName}
            onAddPlayer={() => setPlayerNames((previous) => [...previous, ""])}
            onRemovePlayer={(index) =>
              setPlayerNames((previous) => previous.filter((_, i) => i !== index))
            }
            onTeeChange={setTee}
            onStart={startRound}
          />
        ) : isComplete ? (
          <ResultsScreen round={round} onNewRound={clearRound} />
        ) : currentHole ? (
          <section
            aria-label={`Hole ${currentHole.number} score entry`}
            className="hole-screen"
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
            <div className="hole-heading">
              <div>
                <p className="eyebrow">{sampleCourse.name}</p>
                <h1>Hole <span>{currentHole.number.toString().padStart(2, "0")}</span></h1>
              </div>
              <div className="hole-facts">
                <div><span>Par</span><strong>{currentHole.par}</strong></div>
                <div><span>Stroke index</span><strong>{currentHole.strokeIndex}</strong></div>
              </div>
            </div>

            <div className="hole-progress" aria-label={`Hole ${currentHole.number} of 18`}>
              <div className="progress-track">
                <span style={{ width: `${(currentHole.number / sampleCourse.holes.length) * 100}%` }} />
              </div>
              <span>{currentHole.number} <i>/</i> {sampleCourse.holes.length}</span>
            </div>

            <div className="hole-layout">
              <section className="map-panel" aria-label="Hole map and tee distance">
                <div className="map-panel-head">
                  <div><span className="section-label">Hole map</span><span className="map-hole-name">{sampleCourse.name}</span></div>
                  <span className="map-distance"><Flag size={14} />{currentHole.tees[round.tee]} yd</span>
                </div>
                <HoleMap holeNumber={currentHole.number} />
                <div className="map-legend">
                  <span><i className="legend-tee" />{teeOptions.find((option) => option.id === round.tee)?.label} tee</span>
                  <span><i className="legend-green" />Green</span>
                  <span><i className="legend-water" />Water</span>
                </div>
              </section>

              <section className="players-panel" aria-label="Player scores">
                <div className="players-panel-head">
                  <div><span className="section-label">Enter scores</span><span className="score-hint">Starts at par</span></div>
                  <span className="tee-summary"><span className={`tee-dot tee-${round.tee}`} />{teeOptions.find((option) => option.id === round.tee)?.label} tees</span>
                </div>
                <div className="player-score-list">
                  {round.players.map((player, index) => {
                    const score = round.scores[currentHole.number][index];
                    return (
                      <div className="player-score-row" key={player.id}>
                        <div className="player-identity">
                          <span className="player-avatar">{player.name.slice(0, 1).toUpperCase()}</span>
                          <div><strong>{player.name}</strong><span>{scoreLabel(score, currentHole.par)}</span></div>
                        </div>
                        <div className="score-stepper" aria-label={`${player.name} score`}>
                          <Button
                            aria-label={`Lower ${player.name}'s score`}
                            className="score-step-button"
                            disabled={score <= 1}
                            onClick={() => changeScore(index, -1)}
                            size="icon-lg"
                            variant="outline"
                          ><Minus /></Button>
                          <output aria-live="polite" className="score-value">{score}</output>
                          <Button
                            aria-label={`Raise ${player.name}'s score`}
                            className="score-step-button"
                            disabled={score >= 20}
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
                onClick={() => changeHole(-1)}
                variant="outline"
              ><ChevronLeft /><span>Previous</span></Button>
              <span className="swipe-note">Swipe to move between holes</span>
              <Button className="nav-button nav-next" onClick={() => changeHole(1)}>
                <span>{currentHole.number === sampleCourse.holes.length ? "Results" : "Next hole"}</span>
                {currentHole.number === sampleCourse.holes.length ? <Trophy /> : <ChevronRight />}
              </Button>
            </div>
          </section>
        ) : null}
      </main>

      <footer className="page-footer">
        <span>{offlineReady ? "Ready for offline play" : "Scores are saved on this device"}</span>
        {!isOnline && <span className="offline-footer"><Check size={14} />Ready to play offline</span>}
      </footer>
    </div>
  );
}

function SetupScreen({
  names,
  tee,
  onNameChange,
  onAddPlayer,
  onRemovePlayer,
  onTeeChange,
  onStart,
}: {
  names: string[];
  tee: TeeId;
  onNameChange: (index: number, name: string) => void;
  onAddPlayer: () => void;
  onRemovePlayer: (index: number) => void;
  onTeeChange: (tee: TeeId) => void;
  onStart: () => void;
}) {
  const canStart = names.some((name) => name.trim().length > 0);

  return (
    <section className="setup-screen">
      <div className="setup-intro">
        <p className="eyebrow">New round <span className="sample-tag">Sample course</span></p>
        <h1>Good golf<br /><em>starts here.</em></h1>
        <p className="setup-description">Set up your group and choose the tees for today.</p>
      </div>

      <div className="setup-grid">
        <section className="setup-panel course-panel">
          <div className="panel-heading">
            <span className="panel-icon"><Flag size={17} /></span>
            <div><h2>Course</h2><p>{sampleCourse.club}</p></div>
            <span className="sample-pill">Demo</span>
          </div>
          <div className="course-nameplate">
            <span className="course-overline">18 holes <i /> Par 72</span>
            <strong>{sampleCourse.name}</strong>
            <span className="course-place">18-hole sample course</span>
          </div>
          <div className="tee-select-head"><span className="section-label">Choose tees</span><span>Yardage varies by hole</span></div>
          <div className="tee-options" role="group" aria-label="Choose tee color">
            {teeOptions.map((option) => {
              const total = sampleCourse.holes.reduce((sum, hole) => sum + hole.tees[option.id], 0);
              return (
                <button
                  aria-pressed={tee === option.id}
                  className={`tee-option ${tee === option.id ? "is-selected" : ""}`}
                  key={option.id}
                  onClick={() => onTeeChange(option.id)}
                  type="button"
                >
                  <span className={`tee-dot tee-${option.id}`} />
                  <span className="tee-option-text"><strong>{option.label}</strong><small>{total.toLocaleString()} yd</small></span>
                  {tee === option.id && <Check className="tee-check" size={16} />}
                </button>
              );
            })}
          </div>
        </section>

        <section className="setup-panel players-setup-panel">
          <div className="panel-heading">
            <span className="panel-icon panel-icon-coral"><Trophy size={17} /></span>
            <div><h2>Players</h2><p>Add up to four players</p></div>
            <span className="player-count">{names.filter((name) => name.trim()).length} / 4</span>
          </div>
          <div className="player-input-list">
            {names.map((name, index) => (
              <div className="player-input-row" key={index}>
                <span className="player-input-number">{String(index + 1).padStart(2, "0")}</span>
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
            ))}
          </div>
          {names.length < 4 && (
            <Button className="add-player-button" onClick={onAddPlayer} variant="outline">
              <Plus /> Add player
            </Button>
          )}
          <div className="setup-bottom">
            <span><Check size={15} /> Works without a signal</span>
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
      (sum, hole) => sum + round.scores[hole.number][index],
      0,
    );
    return { player, index, score, toPar: score - 72 };
  });

  return (
    <section className="results-screen">
      <div className="results-heading">
        <span className="results-icon"><Trophy size={23} /></span>
        <p className="eyebrow">Round complete</p>
        <h1>That&apos;s the round.</h1>
        <p>{sampleCourse.name} <i /> 18 holes <i /> {teeOptions.find((option) => option.id === round.tee)?.label} tees</p>
      </div>
      <div className="results-table-wrap">
        <table className="results-table">
          <thead><tr><th>Player</th>{sampleCourse.holes.map((hole) => <th key={hole.number}>{hole.number}</th>)}<th>Par</th><th>Total</th></tr></thead>
          <tbody>
            {totals.map(({ player, index, score, toPar }) => (
              <tr key={player.id}>
                <th scope="row"><span className="result-avatar">{player.name.slice(0, 1).toUpperCase()}</span>{player.name}</th>
                {sampleCourse.holes.map((hole) => <td key={hole.number}>{round.scores[hole.number][index]}</td>)}
                <td>72</td>
                <td className="total-score">{score}<small>{toPar === 0 ? "E" : toPar > 0 ? `+${toPar}` : toPar}</small></td>
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