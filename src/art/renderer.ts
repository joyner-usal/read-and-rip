// Draws the boys sprite scene (Phase 1.6 motion pass).
//  - static layer: background and goal, painted once per size into an offscreen canvas
//  - dynamic layer: goalie, ball, shooter and effects, every frame with drawImage
// The stage applies one camera transform (push-in and shake) to both layers and to the
// tap grid, so the cached static layer is reused as is.
import type { Zone } from '../scenarios/types';
import type { SpriteImages } from './loader';
import { BACKGROUND, GOAL, GOALIE_FEET, MOUTH, SHOOTER_HELMET, SPRITES, fitFrame, placeSprite, toFrame, toScreen, zoneCenter, type Rect } from './manifest';
import { shotPlan, type RepView, type ShotPlan } from './poses';
import { blendDrawn, cameraAt, goalieAt, shooterAt, type Drawn } from './motion';
import { ballAt, type BallFrame, type Pt } from './ball';
import { NET_BULGE, REP_TRANSITION_MS, SMEAR_ALPHA, TAP_FLASH_MS, shotSchedule, type ShotSchedule } from '../game/timing';
import { token } from '../ui/theme';

/** Camera as a CSS-px transform: screen' = s * screen + (tx, ty). */
export interface CameraTransform { s: number; tx: number; ty: number }
export const NO_CAMERA: CameraTransform = { s: 1, tx: 0, ty: 0 };

/** What the stage needs from any renderer (sprite set or the code-drawn fallback). */
export interface StageRenderer {
  paintStatic(ctx: CanvasRenderingContext2D, w: number, h: number): void;
  /** Called first each frame: the camera for this frame. */
  camera(w: number, h: number, now: number): CameraTransform;
  /** Draws over the static layer, under the camera transform the stage already set. */
  draw(ctx: CanvasRenderingContext2D, w: number, h: number, now: number): void;
  /** Goal mouth in CSS px for the current size (before the camera). */
  mouth(w: number, h: number): Rect;
  /** A tap: press ripple (at a CSS-px point, or the zone) plus a quick zone highlight. */
  tap(z: Zone, now: number, point?: Pt): void;
}

const RIPPLE_MS = 320;
const clamp01 = (k: number) => Math.max(0, Math.min(1, k));

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

interface FrameState {
  v: RepView;
  sched: ShotSchedule;
  shot: ShotPlan | null;
  ball: BallFrame | null;
  reduced: boolean;
}

export class BoysRenderer implements StageRenderer {
  private ripples: { x: number; y: number; at: number }[] = [];
  private flashes: { zone: Zone; at: number }[] = [];
  private shadow = makeShadow();
  private lastPhase: RepView['phase'] | null = null;
  private lastGoalie: Drawn | null = null;
  private lastShooter: Drawn | null = null;
  private transition: { at: number; goalie: Drawn; shooter: Drawn } | null = null;
  private fs: FrameState | null = null;
  private w = 0;
  private h = 0;

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

  tap(zone: Zone, now: number, point?: Pt) {
    if (this.o.reduced()) return;
    const p = point ? toFrame(fitFrame(this.w, this.h), point.x, point.y) : zoneCenter(zone);
    this.ripples.push({ ...p, at: now });
    this.flashes.push({ zone, at: now });
  }

  camera(w: number, h: number, now: number): CameraTransform {
    this.w = w;
    this.h = h;
    const v = this.o.view(now);
    const reduced = this.o.reduced();
    if (!v) {
      this.fs = null;
      return NO_CAMERA;
    }
    const resolved = v.resolveMs !== null && v.outcome !== null;
    const sched = shotSchedule(v.mode, v.scenario.fake, v.timing, resolved ? v.resolveMs : null, reduced);
    const shot = shotPlan(v, reduced);
    let ball: BallFrame | null = null;
    if (shot && v.repMs >= shot.startMs) {
      const team = v.mode === 'shooter' ? 'navy' : 'gray';
      const rel = placeSprite(`shooter_${team}_release`, SHOOTER_HELMET.x, SHOOTER_HELMET.y);
      const pocket = SPRITES[`shooter_${team}_release`].pocket!;
      ball = ballAt({ x: rel.x + pocket[0], y: rel.y + pocket[1] }, shot.zone, shot.kind, v.repMs - shot.startMs, shot.final, reduced, shot.nearPost);
    }
    this.fs = { v, sched, shot, ball, reduced };
    const cam = cameraAt(v, shot ? sched : v.mode === 'goalie' ? sched : null, shot, reduced, shot?.nearPost);
    const f = fitFrame(w, h);
    const fx = f.x + cam.focus.x * f.scale;
    const fy = f.y + cam.focus.y * f.scale;
    const sx = cam.shake.x * f.scale;
    const sy = cam.shake.y * f.scale;
    // Never let a shake expose the canvas edge: zoom in just enough to cover it.
    const s = Math.max(cam.zoom, 1 + (2 * Math.max(Math.abs(sx), Math.abs(sy))) / Math.min(w, h));
    return { s, tx: fx * (1 - s) + sx, ty: fy * (1 - s) + sy };
  }

  draw(ctx: CanvasRenderingContext2D, w: number, h: number, now: number) {
    const st = this.fs;
    if (!st) return;
    const { v, sched, shot, ball, reduced } = st;
    const f = fitFrame(w, h);
    ctx.save();
    ctx.translate(f.x, f.y);
    ctx.scale(f.scale, f.scale);
    ctx.imageSmoothingQuality = 'high';

    // Players from the motion model
    let goalie = goalieAt(v, sched, shot, reduced);
    let shooter = shooterAt(v, shot || v.mode === 'goalie' ? sched : null, reduced);

    // A new rep eases in from where the last one ended (no crossfade).
    if (v.phase === 'setup' && this.lastPhase === 'feedback' && this.lastGoalie && this.lastShooter && !reduced) {
      this.transition = { at: now, goalie: this.lastGoalie, shooter: this.lastShooter };
    }
    if (v.phase !== 'setup') this.transition = null;
    if (this.transition) {
      const k = (now - this.transition.at) / REP_TRANSITION_MS;
      if (k < 1) {
        goalie = blendDrawn(this.transition.goalie, goalie, k);
        shooter = blendDrawn(this.transition.shooter, shooter, k);
      } else this.transition = null;
    }
    this.lastPhase = v.phase;
    this.lastGoalie = goalie;
    this.lastShooter = shooter;

    // Idle breathing so nothing is ever frozen (none in reduced motion).
    const t = now / 1000;
    if (!reduced && !(ball?.effect?.frozen)) {
      goalie = { ...goalie, cy: goalie.cy + Math.sin(t * 3.7) * 1.4 };
      shooter = { ...shooter, cy: shooter.cy + Math.sin(t * 3.1 + 1.3) * 1.8 };
    }

    if (ball?.effect?.kind === 'goal' && !ball.effect.frozen) this.drawNet(ctx, ball.effect.at, ball.effect.age, reduced);
    this.drawGoalieShadow(ctx, goalie);
    this.drawActor(ctx, goalie, reduced);
    if (ball) this.drawBall(ctx, ball, reduced);
    this.drawActor(ctx, shooter, reduced);
    this.drawTapFeedback(ctx, now);
    ctx.restore();
  }

  private drawActor(ctx: CanvasRenderingContext2D, d: Drawn, reduced: boolean) {
    const img = this.o.images[d.sprite];
    const [w, h] = SPRITES[d.sprite].draw;
    const one = (dx: number, dy: number, alpha: number) => {
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(d.cx + dx, d.cy + dy);
      if (d.rot) ctx.rotate(d.rot);
      if (d.scale !== 1) ctx.scale(d.scale, d.scale);
      ctx.drawImage(img, -w / 2, -h / 2, w, h);
      ctx.restore();
    };
    if (d.smear && !reduced) one(d.smear.x, d.smear.y, SMEAR_ALPHA);
    one(0, 0, 1);
  }

  private drawGoalieShadow(ctx: CanvasRenderingContext2D, d: Drawn) {
    const airborne = d.sprite.includes('dive');
    const width = airborne ? 90 : 80;
    ctx.globalAlpha = airborne ? 0.5 : 1;
    ctx.drawImage(this.shadow, d.cx - width / 2, GOALIE_FEET.y - 8, width, 18);
    ctx.globalAlpha = 1;
  }

  private drawNet(ctx: CanvasRenderingContext2D, at: Pt, age: number, reduced: boolean) {
    if (reduced) return;
    const k = 1 - age / NET_BULGE.ms;
    if (k <= 0) return;
    const m = 1 + 0.12 * k * (0.65 + 0.35 * Math.cos(age / 45));
    ctx.save();
    ctx.beginPath();
    ctx.arc(at.x, at.y, NET_BULGE.radius, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(this.o.images.background, BACKGROUND.x, BACKGROUND.y, BACKGROUND.w, BACKGROUND.h);
    ctx.translate(at.x, at.y);
    ctx.scale(m, m);
    ctx.translate(-at.x, -at.y);
    ctx.drawImage(this.o.images.goal, GOAL.x, GOAL.y, GOAL.w, GOAL.h);
    ctx.restore();
    ctx.save();
    ctx.beginPath();
    ctx.rect(MOUTH.x, MOUTH.y, MOUTH.w, MOUTH.h);
    ctx.clip();
    ctx.strokeStyle = token('--rr-white');
    ctx.lineWidth = 1.5;
    for (const lag of [0, 140, 280]) {
      const a = age - lag;
      if (a <= 0) continue;
      ctx.globalAlpha = 0.55 * Math.max(0, 1 - a / 450);
      ctx.beginPath();
      ctx.ellipse(at.x, at.y, 6 + a * 0.09, 5 + a * 0.07, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawBall(ctx: CanvasRenderingContext2D, b: BallFrame, reduced: boolean) {
    const white = token('--rr-ball');
    const edge = token('--rr-ball-edge');
    ctx.save();
    if (b.shadow) {
      ctx.globalAlpha = b.alpha * b.shadow.alpha;
      ctx.fillStyle = edge;
      ctx.beginPath();
      ctx.ellipse(b.shadow.x, b.shadow.y, b.shadow.rx, b.shadow.ry, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    b.trail.forEach((p, i) => {
      ctx.globalAlpha = b.alpha * (0.42 - i * 0.06);
      ctx.fillStyle = white;
      ctx.beginPath();
      ctx.arc(p.x, p.y, b.r * (0.9 - i * 0.1), 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = b.alpha;
    ctx.fillStyle = white;
    ctx.strokeStyle = edge;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    const e = b.effect;
    if (e && !reduced && !e.frozen) {
      if (e.kind === 'save' && e.age < 240) this.burst(ctx, e.at, e.age / 240, 8, white);
      if (e.ping && e.age < 200) this.burst(ctx, e.at, e.age / 200, 5, white);
    }
    ctx.restore();
  }

  private burst(ctx: CanvasRenderingContext2D, at: Pt, k: number, rays: number, color: string) {
    ctx.globalAlpha = 1 - k;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    for (let i = 0; i < rays; i++) {
      const ang = (i / rays) * Math.PI * 2 + 0.3;
      const r0 = 6 + k * 7;
      const r1 = 12 + k * 14;
      ctx.beginPath();
      ctx.moveTo(at.x + Math.cos(ang) * r0, at.y + Math.sin(ang) * r0);
      ctx.lineTo(at.x + Math.cos(ang) * r1, at.y + Math.sin(ang) * r1);
      ctx.stroke();
    }
  }

  private drawTapFeedback(ctx: CanvasRenderingContext2D, now: number) {
    this.ripples = this.ripples.filter(r => now - r.at < RIPPLE_MS);
    this.flashes = this.flashes.filter(r => now - r.at < TAP_FLASH_MS);
    if (!this.ripples.length && !this.flashes.length) return;
    ctx.save();
    ctx.strokeStyle = token('--rr-white');
    for (const fl of this.flashes) {
      // The tapped zone lights up so you know the tap landed before the shot plays.
      const c = zoneCenter(fl.zone);
      const cw = MOUTH.w / 3;
      const ch = MOUTH.h / 3;
      ctx.globalAlpha = 0.4 * (1 - clamp01((now - fl.at) / TAP_FLASH_MS) * 0.5);
      ctx.lineWidth = 3;
      ctx.strokeRect(c.x - cw / 2 + 1.5, c.y - ch / 2 + 1.5, cw - 3, ch - 3);
    }
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
