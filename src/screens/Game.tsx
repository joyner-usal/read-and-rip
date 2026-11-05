import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Stage, type Mark } from '../field/Stage';
import type { SceneInput } from '../field/scene';
import { LegacyRenderer } from '../field/legacyRenderer';
import { BoysRenderer, type StageRenderer } from '../art/renderer';
import type { SpriteImages } from '../art/loader';
import type { RepView } from '../art/poses';
import {
  ballAt, FLIGHT_MS, goalieTimeline, NEUTRAL_GOALIE, sample, shooterCarry, shooterLoad, shooterTimeline
} from '../anim/cues';
import {
  clockLeftMs, createGame, gameNow, lastElapsedMs, readElapsedMs, reduce, type GameConfig, type GameEvent, type GameState
} from '../game/machine';
import { bestLine, cardChips, cardPoints, cardWord } from '../game/copy';
import { colIndex, goalieLabel, rowIndex, zoneFromKey } from '../game/zones';
import { isScoring } from '../game/scoring';
import { randomSeed } from '../game/rng';
import type { Scenario, Zone } from '../scenarios/types';
import { ResultIcon } from '../ui/icons';

interface Props {
  config: GameConfig;
  pool: Scenario[];
  reducedMotion: boolean;
  haptics: boolean;
  /** Boys sprite set, preloaded. Null uses the code-drawn field (girls, for now). */
  sprites: SpriteImages | null;
  onDone: (final: GameState) => void;
}

const vibrate = (ms: number) => {
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* not supported */
  }
};

const clockText = (ms: number) => {
  const s = Math.ceil(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

/** The current rep as the sprite renderer sees it. */
function repView(s: GameState, now: number): RepView | null {
  if (s.rep) {
    return {
      mode: s.config.mode,
      phase: s.phase === 'reading' ? 'reading' : 'setup',
      scenario: s.rep.scenario,
      timing: s.rep.timing,
      repMs: readElapsedMs(s, now) ?? 0,
      resolveMs: null,
      outcome: null,
      tapped: null
    };
  }
  if (s.last) {
    const r = s.last.record;
    return {
      mode: s.config.mode,
      phase: 'feedback',
      scenario: s.last.scenario,
      timing: s.last.timing,
      repMs: lastElapsedMs(s, now) ?? 0,
      resolveMs: r.responseMs ?? s.last.timing.windowMs,
      outcome: r.outcome,
      tapped: r.tappedZone
    };
  }
  return null;
}

/** The code-drawn field, for packs with no sprite set yet. */
function legacyScene(s: GameState, now: number, reduced: boolean): SceneInput | null {
  const sc = s.rep?.scenario ?? s.last?.scenario ?? s.pool[0];
  if (!sc) return null;
  const base = { game: sc.game, approachAngleDeg: sc.approachAngleDeg, shooterHand: sc.shooterHand };
  if (s.rep) {
    const t = Math.max(0, readElapsedMs(s, now) ?? 0);
    const timing = s.rep.timing;
    return {
      ...base,
      goalie: sample(goalieTimeline(sc, timing), t, reduced),
      shooter: sample(shooterTimeline(sc, timing), t, reduced),
      ball: ballAt(sc, timing, t, reduced)
    };
  }
  if (s.last) {
    const { timing, record } = s.last;
    const end = timing.windowMs;
    const since = (lastElapsedMs(s, now) ?? end) - (record.responseMs ?? end);
    const goalie = sample(goalieTimeline(sc, timing), end, true);
    let shooter = sample(shooterTimeline(sc, timing), end, true);
    let ball = ballAt(sc, timing, end + FLIGHT_MS, true);
    if (sc.mode === 'shooter' && record.tappedZone) {
      const z: Zone = record.tappedZone;
      const k = reduced ? 1 : Math.min(1, since / FLIGHT_MS);
      const from = shooterCarry(sc);
      shooter = k < 1 ? shooterLoad(sc, z) : from;
      ball = { x: from.headX + (colIndex(z) * (2 / 3) - from.headX) * k, y: from.headY + (rowIndex(z) * (2 / 3) - from.headY) * k, progress: k };
    }
    return { ...base, goalie, shooter, ball };
  }
  return { ...base, goalie: NEUTRAL_GOALIE, shooter: shooterCarry(sc), ball: null };
}

export function Game({ config, pool, reducedMotion, haptics, sprites, onDone }: Props) {
  const stateRef = useRef<GameState | null>(null);
  if (stateRef.current === null) stateRef.current = createGame(config, pool, randomSeed(), performance.now());
  const [state, setState] = useState<GameState>(stateRef.current);
  const [clock, setClock] = useState(clockText(config.roundMs));
  const [announce, setAnnounce] = useState('');
  const secRef = useRef<number | null>(null);
  const doneSent = useRef(false);
  const nextRef = useRef<HTMLButtonElement>(null);
  const resumeRef = useRef<HTMLButtonElement>(null);
  const readBar = useRef<HTMLDivElement>(null);
  const advanceBar = useRef<HTMLDivElement>(null);
  const reducedRef = useRef(reducedMotion);
  reducedRef.current = reducedMotion;

  const dispatch = useCallback((e: GameEvent) => {
    const prev = stateRef.current!;
    const next = reduce(prev, e);
    if (next !== prev) {
      stateRef.current = next;
      setState(next);
    }
  }, []);

  const renderer: StageRenderer = useMemo(
    () =>
      sprites
        ? new BoysRenderer({ images: sprites, view: now => repView(stateRef.current!, now), reduced: () => reducedRef.current })
        : new LegacyRenderer(now => legacyScene(stateRef.current!, now, reducedRef.current)),
    [sprites]
  );

  // React to new results: announcement, haptics, end of round.
  const lastReps = useRef(0);
  useEffect(() => {
    if (state.reps.length > lastReps.current && state.last) {
      lastReps.current = state.reps.length;
      const r = state.last.record;
      const chips = cardChips(r.outcome, r.speedBonus).join(', ');
      setAnnounce(`${cardWord(r.outcome, config.mode)}, ${cardPoints(r.points)}. ${chips}. ${bestLine(state.last.scenario.bestZone, config.mode)}.`);
      if (haptics) vibrate(isScoring(r.outcome) ? 25 : 70);
    }
    if (state.phase === 'summary' && !doneSent.current) {
      doneSent.current = true;
      onDone(state);
    }
  }, [state, config.mode, haptics, onDone]);

  useEffect(() => {
    if (state.phase === 'feedback' && config.practice) nextRef.current?.focus();
  }, [state.phase, config.practice]);
  useEffect(() => {
    if (state.paused) resumeRef.current?.focus();
  }, [state.paused]);

  // Every frame: tick the engine, then move the read-window and auto-advance bars.
  const onFrame = useCallback(
    (now: number) => {
      dispatch({ type: 'tick', now });
      const s = stateRef.current!;
      if (!config.practice) {
        const left = clockLeftMs(s, now);
        const sec = Math.ceil(left / 1000);
        if (sec !== secRef.current) {
          secRef.current = sec;
          setClock(clockText(left));
          if (sec === 10 || sec === 5) setAnnounce(`${sec} seconds left`);
        }
      }
      if (readBar.current) {
        const t = s.rep && s.phase === 'reading' ? Math.min(1, (readElapsedMs(s, now) ?? 0) / s.rep.timing.windowMs) : s.phase === 'feedback' ? 1 : 0;
        readBar.current.style.transform = `scaleX(${t})`;
      }
      if (advanceBar.current && s.phase === 'feedback' && s.feedbackEndsAt !== null) {
        const k = 1 - (s.feedbackEndsAt - gameNow(s, now)) / s.config.feedbackMs;
        advanceBar.current.style.transform = `scaleX(${Math.max(0, Math.min(1, k))})`;
      }
    },
    [config.practice, dispatch]
  );

  const tap = useCallback((zone: Zone, at: number) => dispatch({ type: 'tap', zone, now: at }), [dispatch]);
  const next = useCallback(() => dispatch({ type: 'continue', now: performance.now() }), [dispatch]);
  const pause = useCallback(() => dispatch({ type: 'pause', now: performance.now() }), [dispatch]);
  const resume = useCallback(() => dispatch({ type: 'resume', now: performance.now() }), [dispatch]);
  const end = useCallback(() => dispatch({ type: 'end', now: performance.now() }), [dispatch]);

  // Keys: 1 to 9 pick zones, Space or Enter continues, P or Escape pauses.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const s = stateRef.current!;
      const z = zoneFromKey(e.key);
      if (z && !s.paused) {
        e.preventDefault();
        if (s.phase === 'reading') renderer.rippleZone(z, e.timeStamp);
        tap(z, e.timeStamp);
      } else if ((e.key === 'p' || e.key === 'P' || e.key === 'Escape') && s.phase !== 'summary') {
        e.preventDefault();
        if (s.paused) resume();
        else pause();
      } else if ((e.key === ' ' || e.key === 'Enter') && s.phase === 'feedback' && !s.paused) {
        e.preventDefault();
        next();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [tap, next, pause, resume, renderer]);

  // Leaving the tab pauses the round.
  useEffect(() => {
    const onHide = () => {
      if (document.hidden) pause();
    };
    document.addEventListener('visibilitychange', onHide);
    return () => document.removeEventListener('visibilitychange', onHide);
  }, [pause]);

  const last = state.last;
  const inFeedback = state.phase === 'feedback' && last;
  const marks: Partial<Record<Zone, Mark[]>> = {};
  const add = (z: Zone, m: Mark) => (marks[z] = [...(marks[z] ?? []), m]);
  if (inFeedback) {
    const sc = last.scenario;
    add(sc.bestZone, { kind: 'best', label: 'Best' });
    for (const g of sc.goodZones) add(g, { kind: 'good', label: 'Good' });
    if (sc.fake && sc.baitZone) add(sc.baitZone, { kind: 'bait', label: 'Bait' });
    if (last.record.tappedZone) add(last.record.tappedZone, { kind: 'tap', label: 'You' });
  }

  const mode = config.mode;
  const level = state.rep?.level ?? state.ramp.level;
  const prompt = state.phase === 'setup' ? 'Get set' : mode === 'shooter' ? 'Read the goalie. Pick your spot.' : 'Read the shooter. Pick the save.';

  return (
    <div className="game">
      <Stage
        renderer={renderer}
        onFrame={onFrame}
        onTap={tap}
        disabled={state.phase !== 'reading' || state.paused}
        marks={inFeedback ? marks : undefined}
        hidden={state.paused}
        describeZone={mode === 'goalie' ? z => `your ${goalieLabel(z)} as the goalie` : undefined}
      />

      <div className="hud" role="group" aria-label="Round status">
        {config.practice ? (
          <div className="hud__item">
            <span className="hud__label">Mode</span>
            <span className="hud__value hud__value--word">Practice</span>
          </div>
        ) : (
          <div className="hud__item">
            <span className="hud__label">Clock</span>
            <span className="hud__value">{clock}</span>
          </div>
        )}
        <div className="hud__item">
          <span className="hud__label">Score</span>
          <span className="hud__value">{state.score}</span>
        </div>
        {!config.practice && (
          <div className="hud__item">
            <span className="hud__label">Level</span>
            <span className="hud__value">{level}</span>
          </div>
        )}
        <div className="hud__btns">
          {config.practice && !state.paused && (
            <button type="button" className="hud__btn" onClick={end}>End</button>
          )}
          <button type="button" className="hud__round" onClick={state.paused ? resume : pause} aria-label={state.paused ? 'Resume' : 'Pause'} aria-pressed={state.paused}>
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
              {state.paused ? <path d="M5 3L13 8L5 13Z" fill="currentColor" /> : <path d="M5 3V13M11 3V13" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />}
            </svg>
          </button>
        </div>
      </div>
      <div className="readbar" aria-hidden="true"><div className="readbar__fill" ref={readBar} /></div>

      {!state.paused && !inFeedback && (
        <div className="pill-row"><p className="pill">{prompt}</p></div>
      )}

      {state.paused ? (
        <div className="card card--paused">
          <h2 className="card__word">Paused</h2>
          <p className="card__line">The field is hidden while paused.</p>
          <div className="row">
            <button type="button" className="cta" ref={resumeRef} onClick={resume}>Resume</button>
            <button type="button" className="btn" onClick={end}>{config.practice ? 'End practice' : 'End round'}</button>
          </div>
        </div>
      ) : inFeedback ? (
        <div className={`card result--${last.record.outcome}`}>
          <div className="card__head">
            <span className="card__icon"><ResultIcon outcome={last.record.outcome} size={22} /></span>
            <span className="card__word">{cardWord(last.record.outcome, mode)}</span>
            <span className="card__points">{cardPoints(last.record.points)}</span>
          </div>
          <div className="card__chips">
            {cardChips(last.record.outcome, last.record.speedBonus).map(c => <span key={c} className="chip-tag">{c}</span>)}
          </div>
          <p className="card__line">{config.practice ? last.scenario.rulesNote : bestLine(last.scenario.bestZone, mode)}</p>
          {config.practice ? (
            <button type="button" className="cta card__next" ref={nextRef} onClick={next}>Next</button>
          ) : (
            <div className="card__advance" aria-hidden="true"><div className="card__advance-fill" ref={advanceBar} /></div>
          )}
        </div>
      ) : null}
      <p className="sr-only" role="status" aria-live="polite">{announce}</p>
    </div>
  );
}
