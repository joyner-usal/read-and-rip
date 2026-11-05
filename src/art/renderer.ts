// Draws the boys sprite scene. Two layers:
//  - static: background and goal, painted once per size change
//  - dynamic: goalie shadow, goalie, ball, shooter and effects, every frame with drawImage
// All drawing happens in reference-frame px under one transform (fitFrame).
import type { Zone } from '../scenarios/types';
import type { SpriteImages } from './loader';
import {
  BACKGROUND, GOAL, GOALIE_FEET, MOUTH, SHOOTER_HELMET, SPRITES, fitFrame, placeSprite, toFrame, toScreen, zoneCenter,
  type Fit, type Rect, type SpriteName
} from './manifest';
import { goalieTarget, shooterTarget, shotPlan, type ActorTarget, type RepView } from './poses';
import { ballAt, type BallFrame, type Pt } from './ball';
import { token } from '../ui/theme';

/** What the stage needs from any renderer (sprite set or the code-drawn fallback). */
export interface StageRenderer {
  paintStatic(ctx: CanvasRenderingContext2D, w: number, h: number): void;
  /** Draws over the static layer, which the stage has already copied in this frame. */
  draw(ctx: CanvasRenderingContext2D, w: number, h: number, now: number): void;
  /** Goal mouth in CSS px for the current size. */
  mouth(w: number, h: number): Rect;
  /** Press ripple at a point in CSS px. */
  ripple(x: number, y: number, now: number): void;
  rippleZone(z: Zone, now: number): void;
}

const CROSSFADE_MS = 90;
const MOVE_MS = 200;
const REP_TRANSITION_MS = 250;
const RIPPLE_MS = 320;

const clamp01 = (k: number) => Math.max(0, Math.min(1, k));
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
/** Ease out with a slight overshoot. */
function easeOutBack(k: number): number {
  const c1 = 1.2;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(k - 1, 3) + c1 * Math.pow(k - 1, 2);
}

interface Placed { target: ActorTarget; box: Rect; anchor: Pt }

function place(t: ActorTarget): Placed {
  let ax: number;
  let ay: number;
  if (t.place === 'zone' && t.zone) {
    const z = zoneCenter(t.zone);
    ax = z.x + t.dx;
    ay = z.y + t.dy;
  } else if (t.place === 'helmet') {
    ax = SHOOTER_HELMET.x + t.dx;
    ay = SHOOTER_HELMET.y + t.dy;
  } else {
    ax = GOALIE_FEET.x + t.dx;
    ay = GOALIE_FEET.y + t.dy;
  }
  return { target: t, box: placeSprite(t.sprite, ax, ay), anchor: { x: ax, y: ay } };
}

const center = (p: Placed): Pt => ({ x: p.box.x + p.box.w / 2, y: p.box.y + p.box.h / 2 });
const sameTarget = (a: ActorTarget, b: ActorTarget) =>
  a.sprite === b.sprite && a.place === b.place && a.zone === b.zone && a.dx === b.dx && a.dy === b.dy && a.rot === b.rot && a.scale === b.scale;

/** Blends pose changes: short crossfade plus an eased move and scale with a little overshoot. */
class Actor {
  cur: Placed | null = null;
  prev: Placed | null = null;
  start = 0;
  move = MOVE_MS;
  fade = CROSSFADE_MS;

  set(t: ActorTarget, now: number, slow: boolean) {
    if (this.cur && sameTarget(this.cur.target, t)) return;
    this.prev = this.cur;
    this.cur = place(t);
    this.start = now;
    this.move = slow ? REP_TRANSITION_MS : MOVE_MS;
    this.fade = slow ? REP_TRANSITION_MS : CROSSFADE_MS;
  }

  draw(ctx: CanvasRenderingContext2D, img: SpriteImages, now: number, reduced: boolean, bob: { dy: number; s: number }, before?: (p: Placed, alpha: number, offset: Pt) => void) {
    const cur = this.cur;
    if (!cur) return;
    const prev = reduced ? null : this.prev;
    const km = prev ? clamp01((now - this.start) / this.move) : 1;
    const kf = prev ? clamp01((now - this.start) / this.fade) : 1;
    const ke = prev ? easeOutBack(km) : 1;
    const cc = center(cur);
    const pc = prev ? center(prev) : cc;
    const curOff = { x: (pc.x - cc.x) * (1 - ke), y: (pc.y - cc.y) * (1 - ke) + bob.dy };
    const scale = prev ? lerp(prev.target.scale, cur.target.scale, ke) : cur.target.scale;
    const rot = prev ? lerp(prev.target.rot, cur.target.rot, ke) : cur.target.rot;
    if (prev && kf < 1 && prev.target.sprite !== cur.target.sprite) {
      const prevOff = { x: (cc.x - pc.x) * ke, y: (cc.y - pc.y) * ke + bob.dy };
      before?.(prev, 1 - kf, prevOff);
      drawPlaced(ctx, img, prev, prevOff, scale * bob.s, rot, 1 - kf);
    }
    before?.(cur, prev && prev.target.sprite !== cur.target.sprite ? kf : 1, curOff);
    drawPlaced(ctx, img, cur, curOff, scale * bob.s, rot, prev && prev.target.sprite !== cur.target.sprite ? kf : 1);
  }
}

function drawPlaced(ctx: CanvasRenderingContext2D, img: SpriteImages, p: Placed, off: Pt, scale: number, rot: number, alpha: number) {
  if (alpha <= 0) return;
  const im = img[p.target.sprite as SpriteName];
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(p.anchor.x + off.x, p.anchor.y + off.y);
  if (rot) ctx.rotate(rot);
  if (scale !== 1) ctx.scale(scale, scale);
  ctx.drawImage(im, p.box.x - p.anchor.x, p.box.y - p.anchor.y, p.box.w, p.box.h);
  ctx.restore();
}

function makeShadow(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 32;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(64, 16, 2, 64, 16, 64);
  grad.addColorStop(0, token('--rr-ground-shadow'));
  grad.addColorStop(1, token('--rr-ground-shadow-edge'));
  g.setTransform(1, 0, 0, 0.25, 0, 12);
  g.fillStyle = grad;
  g.fillRect(0, -48, 128, 128);
  return c;
}

export interface BoysRendererOptions {
  images: SpriteImages;
  /** The rep to draw at `now`, or null between rounds. */
  view: (now: number) => RepView | null;
  reduced: () => boolean;
}

export class BoysRenderer implements StageRenderer {
  private goalie = new Actor();
  private shooter = new Actor();
  private ripples: { x: number; y: number; at: number }[] = [];
  private shadow = makeShadow();
  private lastPhase: RepView['phase'] | null = null;
  private fit: Fit = { scale: 1, x: 0, y: 0 };

  constructor(private o: BoysRendererOptions) {}

  mouth(w: number, h: number): Rect {
    return toScreen(fitFrame(w, h), MOUTH);
  }

  paintStatic(ctx: CanvasRenderingContext2D, w: number, h: number) {
    const f = fitFrame(w, h);
    ctx.fillStyle = token('--rr-navy');
    ctx.fillRect(0, 0, w, h);
    ctx.save();
    ctx.translate(f.x, f.y);
    ctx.scale(f.scale, f.scale);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(this.o.images.background, BACKGROUND.x, BACKGROUND.y, BACKGROUND.w, BACKGROUND.h);
    ctx.drawImage(this.o.images.goal, GOAL.x, GOAL.y, GOAL.w, GOAL.h);
    ctx.restore();
  }

  ripple(x: number, y: number, now: number) {
    if (this.o.reduced()) return;
    const p = toFrame(this.fit, x, y);
    this.ripples.push({ ...p, at: now });
  }

  rippleZone(z: Zone, now: number) {
    if (this.o.reduced()) return;
    this.ripples.push({ ...zoneCenter(z), at: now });
  }

  draw(ctx: CanvasRenderingContext2D, w: number, h: number, now: number) {
    const f = (this.fit = fitFrame(w, h));
    const reduced = this.o.reduced();
    const v = this.o.view(now);
    if (!v) return;
    ctx.save();
    ctx.translate(f.x, f.y);
    ctx.scale(f.scale, f.scale);
    ctx.imageSmoothingQuality = 'high';

    // A new rep after feedback eases in over the rep transition.
    const slow = v.phase === 'setup' && this.lastPhase === 'feedback';
    this.lastPhase = v.phase;
    this.goalie.set(goalieTarget(v), now, slow);
    this.shooter.set(shooterTarget(v), now, slow);

    const shot = shotPlan(v);
    let ball: BallFrame | null = null;
    if (shot) {
      const rel = placeSprite(`shooter_${v.mode === 'shooter' ? 'navy' : 'gray'}_release`, SHOOTER_HELMET.x, SHOOTER_HELMET.y);
      const pocket = SPRITES[`shooter_${v.mode === 'shooter' ? 'navy' : 'gray'}_release`].pocket!;
      ball = ballAt({ x: rel.x + pocket[0], y: rel.y + pocket[1] }, shot.zone, shot.kind, v.repMs - shot.startMs, shot.final, reduced);
    }

    if (ball?.effect?.kind === 'goal') this.drawNet(ctx, ball.effect.at, ball.effect.age, reduced);

    const t = now / 1000;
    const bobG = reduced ? { dy: 0, s: 1 } : { dy: Math.sin(t * 3.7) * 1.4, s: 1 + Math.sin(t * 3.7) * 0.004 };
    const bobS = reduced ? { dy: 0, s: 1 } : { dy: Math.sin(t * 3.1 + 1.3) * 1.8, s: 1 };
    this.goalie.draw(ctx, this.o.images, now, reduced, bobG, (p, alpha, off) => this.drawShadow(ctx, p, alpha, off.x));

    if (ball) this.drawBall(ctx, ball, reduced);
    this.shooter.draw(ctx, this.o.images, now, reduced, bobS);
    this.drawRipples(ctx, now);
    ctx.restore();
  }

  private drawShadow(ctx: CanvasRenderingContext2D, p: Placed, alpha: number, dx: number) {
    const airborne = p.target.place === 'zone';
    const x = (airborne ? p.box.x + p.box.w * 0.55 : p.anchor.x) + dx;
    const w = airborne ? 90 : 80;
    ctx.globalAlpha = alpha * (airborne ? 0.5 : 1);
    ctx.drawImage(this.shadow, x - w / 2, GOALIE_FEET.y - 8, w, 18);
    ctx.globalAlpha = 1;
  }

  private drawNet(ctx: CanvasRenderingContext2D, at: Pt, age: number, reduced: boolean) {
    if (reduced) return;
    const k = 1 - age / 520;
    if (k <= 0) return;
    const m = 1 + 0.11 * k * (0.65 + 0.35 * Math.cos(age / 45));
    ctx.save();
    ctx.beginPath();
    ctx.arc(at.x, at.y, 26, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(this.o.images.background, BACKGROUND.x, BACKGROUND.y, BACKGROUND.w, BACKGROUND.h);
    ctx.translate(at.x, at.y);
    ctx.scale(m, m);
    ctx.translate(-at.x, -at.y);
    ctx.drawImage(this.o.images.goal, GOAL.x, GOAL.y, GOAL.w, GOAL.h);
    ctx.restore();
    // Ripple rings, kept inside the mouth
    ctx.save();
    ctx.beginPath();
    ctx.rect(MOUTH.x, MOUTH.y, MOUTH.w, MOUTH.h);
    ctx.clip();
    ctx.strokeStyle = token('--rr-white');
    ctx.lineWidth = 1.5;
    for (const lag of [0, 120]) {
      const a = age - lag;
      if (a <= 0) continue;
      ctx.globalAlpha = 0.55 * Math.max(0, 1 - a / 400);
      ctx.beginPath();
      ctx.ellipse(at.x, at.y, 5 + a * 0.08, 4 + a * 0.06, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawBall(ctx: CanvasRenderingContext2D, b: BallFrame, reduced: boolean) {
    const white = token('--rr-ball');
    const edge = token('--rr-ball-edge');
    ctx.save();
    // Motion trail
    b.trail.forEach((p, i) => {
      ctx.globalAlpha = b.alpha * (0.32 - i * 0.07);
      ctx.fillStyle = white;
      ctx.beginPath();
      ctx.arc(p.x, p.y, b.r * (0.85 - i * 0.12), 0, Math.PI * 2);
      ctx.fill();
    });
    // Soft shadow, then the ball
    ctx.globalAlpha = b.alpha * 0.28;
    ctx.fillStyle = edge;
    ctx.beginPath();
    ctx.ellipse(b.x + b.r * 0.35, b.y + b.r * 0.55, b.r * 1.05, b.r * 0.7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = b.alpha;
    ctx.fillStyle = white;
    ctx.strokeStyle = edge;
    ctx.lineWidth = Math.max(0.6, b.r * 0.14);
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // Impact burst on a save
    const e = b.effect;
    if (e && e.kind === 'save' && !reduced && e.age < 220) {
      const k = e.age / 220;
      ctx.globalAlpha = 1 - k;
      ctx.strokeStyle = white;
      ctx.lineWidth = 2;
      for (let i = 0; i < 7; i++) {
        const ang = (i / 7) * Math.PI * 2 + 0.3;
        const r0 = 5 + k * 6;
        const r1 = 10 + k * 12;
        ctx.beginPath();
        ctx.moveTo(e.at.x + Math.cos(ang) * r0, e.at.y + Math.sin(ang) * r0);
        ctx.lineTo(e.at.x + Math.cos(ang) * r1, e.at.y + Math.sin(ang) * r1);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  private drawRipples(ctx: CanvasRenderingContext2D, now: number) {
    this.ripples = this.ripples.filter(r => now - r.at < RIPPLE_MS);
    if (!this.ripples.length) return;
    ctx.save();
    ctx.strokeStyle = token('--rr-white');
    for (const r of this.ripples) {
      const k = (now - r.at) / RIPPLE_MS;
      ctx.globalAlpha = 0.7 * (1 - k);
      ctx.lineWidth = 2.5 * (1 - k) + 0.5;
      ctx.beginPath();
      ctx.arc(r.x, r.y, 6 + k * 20, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }
}

