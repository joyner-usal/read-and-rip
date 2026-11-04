import { useCallback, useEffect, useRef, useState } from 'react';
import { FieldView, type Mark } from '../field/FieldView';
import type { SceneInput } from '../field/scene';
import {
  ballAt, FLIGHT_MS, goalieTimeline, NEUTRAL_GOALIE, sample, shooterCarry, shooterLoad, shooterTimeline
} from '../anim/cues';
import {
  clockLeftMs, createGame, readElapsedMs, reduce, type GameConfig, type GameEvent, type GameState
} from '../game/machine';
import { bestLine, resultHeadline, SPEED_LINE } from '../game/copy';
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
  onDone: (final: GameState) => void;
}

const vibrate = (ms: number) => {
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* not supported */
  }
};

export function Game({ config, pool, reducedMotion, haptics, onDone }: Props) {
  const stateRef = useRef<GameState | null>(null);
  if (stateRef.current === null) stateRef.current = createGame(config, pool, randomSeed(), performance.now());
  const [state, setState] = useState<GameState>(stateRef.current);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [announce, setAnnounce] = useState('');
  const feedbackStart = useRef(0);
  const secRef = useRef<number | null>(null);
  const doneSent = useRef(false);
  const continueRef = useRef<HTMLButtonElement>(null);
  const resumeRef = useRef<HTMLButtonElement>(null);

  const dispatch = useCallback((e: GameEvent) => {
    const prev = stateRef.current!;
    const next = reduce(prev, e);
    if (next !== prev) {
      stateRef.current = next;
      setState(next);
    }
  }, []);

  // React to state changes: feedback start, haptics, announcements, end of round.
  const lastReps = useRef(0);
  useEffect(() => {
    if (state.reps.length > lastReps.current && state.last) {
      lastReps.current = state.reps.length;
      feedbackStart.current = performance.now();
      const r = state.last.record;
      setAnnounce(`${resultHeadline(r.outcome, r.points, r.speedBonus)}${r.speedBonus ? `. ${SPEED_LINE}` : ''}. ${bestLine(state.last.scenario.bestZone, config.mode)}.`);
      if (haptics) vibrate(isScoring(r.outcome) ? 25 : 70);
    }
    if (state.phase === 'summary' && !doneSent.current) {
      doneSent.current = true;
      onDone(state);
    }
  }, [state, config.mode, haptics, onDone]);

  useEffect(() => {
    if (state.phase === 'feedback' && config.practice) continueRef.current?.focus();
  }, [state.phase, config.practice]);
  useEffect(() => {
    if (state.paused) resumeRef.current?.focus();
  }, [state.paused]);

  // One animation loop drives both the engine (tick) and the canvas.
  const getScene = useCallback(
    (now: number): SceneInput => {
      dispatch({ type: 'tick', now });
      const s = stateRef.current!;
      if (!config.practice) {
        const sec = Math.ceil(clockLeftMs(s, now) / 1000);
        if (sec !== secRef.current) {
          secRef.current = sec;
          setSecondsLeft(sec);
          if (sec === 10 || sec === 5) setAnnounce(`${sec} seconds left`);
        }
      }
      const sc = s.rep?.scenario ?? s.last?.scenario ?? s.pool[0];
      if (!sc) return { game: config.game, approachAngleDeg: 0, shooterHand: 'right', goalie: NEUTRAL_GOALIE, shooter: { headX: 1.15, headY: 0.35, shoulderTilt: 0 }, ball: null };
      const base = { game: sc.game, approachAngleDeg: sc.approachAngleDeg, shooterHand: sc.shooterHand };

      if (s.rep) {
        const t = Math.max(0, readElapsedMs(s, now) ?? 0);
        const timing = s.rep.timing;
        return {
          ...base,
          goalie: sample(goalieTimeline(sc, timing), t, reducedMotion),
          shooter: sample(shooterTimeline(sc, timing), t, reducedMotion),
          ball: ballAt(sc, timing, t, reducedMotion)
        };
      }
      if (s.last) {
        // Feedback: hold the final read, then show where the ball went.
        const { timing, record } = s.last;
        const end = timing.windowMs;
        const since = now - feedbackStart.current;
        const goalie = sample(goalieTimeline(sc, timing), end, true);
        let shooter = sample(shooterTimeline(sc, timing), end, true);
        let ball = ballAt(sc, timing, end + FLIGHT_MS, true);
        if (sc.mode === 'shooter' && record.tappedZone) {
          const z: Zone = record.tappedZone;
          const k = reducedMotion ? 1 : Math.min(1, since / FLIGHT_MS);
          const from = shooterCarry(sc);
          shooter = k < 1 ? shooterLoad(sc, z) : from;
          ball = {
            x: from.headX + (colIndex(z) * (2 / 3) - from.headX) * k,
            y: from.headY + (rowIndex(z) * (2 / 3) - from.headY) * k,
            progress: k
          };
        }
        return { ...base, goalie, shooter, ball };
      }
      return { ...base, goalie: NEUTRAL_GOALIE, shooter: shooterCarry(sc), ball: null };
    },
    [config.game, config.practice, dispatch, reducedMotion]
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
  }, [tap, next, pause, resume]);

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

  return (
    <div className="game">
      <div className="hud" role="group" aria-label="Round status">
        {config.practice ? (
          <div className="hud__item">
            <span className="hud__label">Mode</span>
            <span className="hud__value hud__value--word">Practice</span>
          </div>
        ) : (
          <div className="hud__item hud__clock">
            <span className="hud__label">Clock</span>
            <span className="hud__value">{secondsLeft ?? 30}</span>
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
          <button type="button" className="hud__btn" onClick={state.paused ? resume : pause} aria-pressed={state.paused}>
            {state.paused ? 'Resume' : 'Pause'}
          </button>
        </div>
      </div>

      <FieldView
        getScene={getScene}
        onTap={tap}
        disabled={state.phase !== 'reading' || state.paused}
        marks={marks}
        hidden={state.paused}
        describeZone={mode === 'goalie' ? z => `your ${goalieLabel(z)} as the goalie` : undefined}
      />

      <div className="panel">
        {state.paused ? (
          <div className="paused">
            <h2 className="paused__title">Paused</h2>
            <p className="paused__note">The field is hidden while paused.</p>
            <div className="row">
              <button type="button" className="cta" ref={resumeRef} onClick={resume}>Resume</button>
              <button type="button" className="btn" onClick={end}>{config.practice ? 'End practice' : 'End round'}</button>
            </div>
          </div>
        ) : inFeedback ? (
          <div className={`result result--${last.record.outcome}`}>
            <div className="result__head">
              <ResultIcon outcome={last.record.outcome} />
              <p className="result__word">{resultHeadline(last.record.outcome, last.record.points, last.record.speedBonus)}</p>
            </div>
            {last.record.speedBonus && <p className="result__line">{SPEED_LINE}</p>}
            <p className="result__line">{bestLine(last.scenario.bestZone, mode)}</p>
            {config.practice && <p className="result__note">{last.scenario.rulesNote}</p>}
            <button type="button" className={config.practice ? 'cta' : 'btn btn--small'} ref={continueRef} onClick={next}>
              {config.practice ? 'Continue' : 'Next'}
            </button>
          </div>
        ) : (
          <div className="prompt">
            <p className="prompt__text">
              {state.phase === 'setup' ? 'Get set' : mode === 'shooter' ? 'Read the goalie. Pick your spot.' : 'Read the shooter. Pick the save.'}
            </p>
            <p className="prompt__keys">Tap the goal, or press 1 to 9.</p>
          </div>
        )}
      </div>
      <p className="sr-only" role="status" aria-live="polite">{announce}</p>
    </div>
  );
}
