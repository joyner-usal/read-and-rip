// Shot and feedback timing for every rep (Phase 1.6 motion pass). One module, pure,
// so the engine, the renderer and the tests all agree on when things happen.
// Times are "rep time": ms since the read window opened.
import type { Mode } from '../scenarios/types';
import type { Timing } from './ramp';

/** The shooter loads the stick before the ball leaves. */
export const LOAD_MS = 120;
/** The release pose holds this long before the follow-through. */
export const RELEASE_HOLD_MS = 160;
/** Ball flight from stick to contact, slow motion included. */
export const FLIGHT_MS = 600;
/** The last share of the path plays at this fraction of the normal speed. */
export const SLOWMO_SHARE = 0.2;
export const SLOWMO_SPEED = 0.5;
/** Everything holds still for a beat when the ball makes contact. */
export const CONTACT_FREEZE_MS = 70;
/** The card waits this long after contact, then slides up. */
export const CARD_DELAY_MS = 250;
export const CARD_SLIDE_MS = 200;
/** The opponent goalie (shooter mode) starts moving this long after release. */
export const REACTION_MS = 120;
/** On a goal the opponent goalie is beaten: he starts even later. */
export const LATE_EXTRA_MS = 180;
/** Goalie save move: a dip, then the travel. */
export const GOALIE_DIP_MS = 60;
export const GOALIE_TRAVEL_MS = 300;
export const GOALIE_LEAN_RAD = 0.18;
export const GOALIE_STRETCH = 1.08;
/** One motion-smear copy, for about 2 frames, on a hard sprite swap. */
export const SMEAR_MS = 34;
export const SMEAR_ALPHA = 0.25;
/** Shooter body motion around the release. */
export const LOAD_ROT = -0.06;
export const LOAD_RISE = 4;
export const LUNGE = { dx: -5, dy: -8, scale: 1.03 };
/** Camera: slow push toward the goal while reading, back out over the flight. */
export const PUSH_IN = 0.03;
export const SHAKE = { goal: { px: 4, ms: 120 }, save: { px: 3, ms: 110 }, post: { px: 2, ms: 80 } };
export const NET_BULGE = { radius: 40, ms: 650 };
/** Tapped-zone highlight right at the tap. */
export const TAP_FLASH_MS = 150;
/** A new rep eases in from the last one. */
export const REP_TRANSITION_MS = 250;
/** Reduced motion: release, mid-flight and contact as still frames, this long each. */
export const REDUCED_FRAME_MS = 250;

/** Release point of a goalie-mode shot: the fake's release time, else 70% into the window. */
export function releasePoint(t: Timing): number {
  return t.releaseMs ?? t.windowMs * 0.7;
}

export interface ShotSchedule {
  /** The shooter starts loading. */
  loadAt: number;
  /** The ball leaves the stick. */
  releaseAt: number;
  /** Release pose ends; follow-through starts. */
  followAt: number;
  /** The ball meets the net, the stick or the turf past the pipe. */
  contactAt: number;
  /** The feedback card starts to slide up. */
  revealAt: number;
}

/**
 * When the shot happens. `resolveMs` is when the rep resolved (tap or timeout), or null
 * while still reading. Shooter mode: your tap starts the load. Goalie mode: the shooter
 * releases at the cue's release point; a tap before a real (not fake) release makes the
 * shooter let it go right away. Scoring is still decided at the tap; only the reveal waits.
 */
export function shotSchedule(mode: Mode, fake: boolean, timing: Timing, resolveMs: number | null, reduced: boolean): ShotSchedule {
  let releaseAt: number;
  if (mode === 'shooter') {
    releaseAt = (resolveMs ?? Infinity) + LOAD_MS;
  } else {
    const point = releasePoint(timing);
    releaseAt = resolveMs !== null && !fake ? Math.min(point, resolveMs + LOAD_MS) : point;
  }
  const flight = reduced ? 2 * REDUCED_FRAME_MS : FLIGHT_MS;
  const contactAt = releaseAt + flight;
  return {
    loadAt: releaseAt - LOAD_MS,
    releaseAt,
    followAt: releaseAt + RELEASE_HOLD_MS,
    contactAt,
    revealAt: contactAt + (reduced ? REDUCED_FRAME_MS : CARD_DELAY_MS)
  };
}

/** Normal flight speed so that the whole flight, slow motion included, takes FLIGHT_MS. */
export const BASE_FLIGHT_MS = FLIGHT_MS / (1 - SLOWMO_SHARE + SLOWMO_SHARE / SLOWMO_SPEED);

/**
 * How far along its path the ball is (0 to 1) at `since` ms after release. Slow out of
 * the stick, fast through the middle, then the last 20% at half speed.
 */
export function flightProgress(since: number): number {
  if (since <= 0) return 0;
  const fastMs = BASE_FLIGHT_MS * (1 - SLOWMO_SHARE);
  if (since < fastMs) return (1 - SLOWMO_SHARE) * Math.pow(since / fastMs, 1.6);
  return Math.min(1, 1 - SLOWMO_SHARE + (SLOWMO_SHARE * (since - fastMs)) / (FLIGHT_MS - fastMs));
}
