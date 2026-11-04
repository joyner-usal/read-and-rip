// Code-drawn field view from behind the shooter's stick (no image files).
// Draws one frame from poses computed in src/anim/cues.ts. Colors come from tokens.
import type { Game, Hand } from '../scenarios/types';
import type { BallState, GoaliePose, ShooterPose } from '../anim/cues';
import { token } from '../ui/theme';

export interface Rect { x: number; y: number; w: number; h: number }

export interface SceneInput {
  game: Game;
  approachAngleDeg: number;
  shooterHand: Hand;
  goalie: GoaliePose;
  shooter: ShooterPose;
  ball: BallState | null;
}

/** Where the goal mouth sits, in CSS pixels. The tap grid lines up with this. */
export function goalMouth(width: number, height: number, angleDeg: number): Rect {
  const rad = (angleDeg * Math.PI) / 180;
  // Big enough that each of the nine cells stays at least 48 px on a phone.
  const size = Math.min(width * 0.6, height * 0.58);
  const w = size * Math.max(0.85, Math.cos(rad));
  const h = size;
  const x = width / 2 - w / 2 - Math.sin(rad) * width * 0.12;
  const y = height * 0.16;
  return { x, y, w, h };
}

// Crease radius in goal widths (goal is 6 ft wide). Boys 9 ft, girls 8.5 ft.
// Approximate art: confirm against the current rulebooks before launch.
const CREASE_RADIUS = { boys: 9 / 6, girls: 8.5 / 6 } as const;

function colors() {
  return {
    turf: token('--rr-turf'),
    line: token('--rr-turf-line'),
    crease: token('--rr-crease'),
    pipe: token('--rr-goal-pipe'),
    net: token('--rr-goal-net'),
    netBack: token('--rr-net-back'),
    goalie: token('--rr-goalie-fill'),
    goalieStick: token('--rr-goalie-stick'),
    shaft: token('--rr-stick-shaft'),
    head: token('--rr-stick-head'),
    mesh: token('--rr-stick-mesh'),
    ball: token('--rr-ball'),
    ballEdge: token('--rr-ball-edge'),
    jersey: token('--rr-shooter-jersey')
  };
}

export function drawScene(ctx: CanvasRenderingContext2D, width: number, height: number, s: SceneInput): Rect {
  const m = goalMouth(width, height, s.approachAngleDeg);
  const c = colors();
  const cx = m.x + m.w / 2;
  const groundY = m.y + m.h;
  const X = (u: number) => m.x + ((u + 1) / 2) * m.w; // mouth space to px
  const Y = (v: number) => m.y + ((v + 1) / 2) * m.h;

  // Turf
  ctx.fillStyle = c.turf;
  ctx.fillRect(0, 0, width, height);

  // Pack markings
  ctx.strokeStyle = c.line;
  ctx.lineWidth = 2;
  if (s.game === 'girls') {
    // 8 meter arc with hash marks, near the shooter. Placeholder art.
    const rx = m.w * 3.3;
    const ry = (height - groundY) * 0.82;
    ctx.beginPath();
    ctx.ellipse(cx, groundY, rx, ry, 0, 0.05 * Math.PI, 0.95 * Math.PI);
    ctx.stroke();
    for (let i = 1; i < 12; i++) {
      const a = (0.05 + (0.9 * i) / 12) * Math.PI;
      const px = cx + rx * Math.cos(a);
      const py = groundY + ry * Math.sin(a);
      ctx.beginPath();
      ctx.moveTo(px, py - 6);
      ctx.lineTo(px, py + 6);
      ctx.stroke();
    }
  }

  // Crease, flattened for the low camera
  ctx.strokeStyle = c.crease;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(cx, groundY, m.w * CREASE_RADIUS[s.game], m.h * 0.3, 0, 0, Math.PI * 2);
  ctx.stroke();

  // Net: back shading, back bar and diamond mesh inside the mouth
  const backY = groundY - m.h * 0.14;
  const backHalf = m.w * 0.32;
  ctx.save();
  ctx.beginPath();
  ctx.rect(m.x, m.y, m.w, m.h);
  ctx.clip();
  ctx.fillStyle = c.netBack;
  ctx.fillRect(m.x, m.y, m.w, m.h);
  ctx.globalAlpha = 0.3;
  ctx.strokeStyle = c.net;
  ctx.lineWidth = 1;
  const cell = m.w / 9;
  for (let d = -m.h; d < m.w + m.h; d += cell) {
    ctx.beginPath();
    ctx.moveTo(m.x + d, m.y);
    ctx.lineTo(m.x + d + m.h, m.y + m.h);
    ctx.moveTo(m.x + d, m.y + m.h);
    ctx.lineTo(m.x + d + m.h, m.y);
    ctx.stroke();
  }
  ctx.globalAlpha = 0.7;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(m.x, groundY);
  ctx.lineTo(cx - backHalf, backY);
  ctx.lineTo(cx + backHalf, backY);
  ctx.lineTo(m.x + m.w, groundY);
  ctx.moveTo(m.x, m.y);
  ctx.lineTo(cx - backHalf, backY);
  ctx.moveTo(m.x + m.w, m.y);
  ctx.lineTo(cx + backHalf, backY);
  ctx.stroke();
  ctx.restore();

  // Goal line between the posts
  ctx.strokeStyle = c.line;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(m.x, groundY);
  ctx.lineTo(m.x + m.w, groundY);
  ctx.stroke();

  drawGoalie(ctx, m, s.goalie, c, X, Y);

  // Pipes over the net and goalie
  ctx.strokeStyle = c.pipe;
  ctx.lineWidth = Math.max(4, m.w * 0.035);
  ctx.lineJoin = 'miter';
  ctx.beginPath();
  ctx.moveTo(m.x, groundY);
  ctx.lineTo(m.x, m.y);
  ctx.lineTo(m.x + m.w, m.y);
  ctx.lineTo(m.x + m.w, groundY);
  ctx.stroke();

  drawShooter(ctx, width, height, s, c, X, Y);

  if (s.ball) {
    const r = Math.max(3, width * (0.03 - 0.019 * s.ball.progress));
    ctx.fillStyle = c.ball;
    ctx.strokeStyle = c.ballEdge;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(X(s.ball.x), Y(s.ball.y), r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  return m;
}

type Colors = ReturnType<typeof colors>;

function drawGoalie(ctx: CanvasRenderingContext2D, m: Rect, p: GoaliePose, c: Colors, X: (u: number) => number, Y: (v: number) => number) {
  const groundY = m.y + m.h;
  const tall = m.h * (0.86 - p.crouch * 0.28);
  const bodyW = m.w * (0.3 + p.crouch * 0.05);
  const bx = X(p.x);
  const top = groundY - tall;
  ctx.fillStyle = c.goalie;
  // Legs, wider in a crouch
  const legW = bodyW * 0.3;
  const spread = bodyW * (0.12 + p.crouch * 0.18);
  ctx.fillRect(bx - bodyW / 2 - spread, groundY - tall * 0.34, legW, tall * 0.34);
  ctx.fillRect(bx + bodyW / 2 - legW + spread, groundY - tall * 0.34, legW, tall * 0.34);
  // Chest protector
  ctx.fillRect(bx - bodyW / 2, top + tall * 0.18, bodyW, tall * 0.5);
  // Helmet
  ctx.beginPath();
  ctx.arc(bx, top + tall * 0.09, bodyW * 0.24, 0, Math.PI * 2);
  ctx.fill();
  // Stick: shaft from the hands to a big goalie head
  const hx = X(p.stickX);
  const hy = Y(p.stickY);
  const handX = bx + Math.sign(p.stickX - p.x || 1) * bodyW * 0.45;
  const handY = top + tall * 0.42;
  // Stick in a lighter shade so it reads in front of the body
  ctx.strokeStyle = c.goalieStick;
  ctx.fillStyle = c.goalieStick;
  ctx.lineWidth = Math.max(3, m.w * 0.022);
  ctx.beginPath();
  ctx.moveTo(handX, handY);
  ctx.lineTo(hx, hy);
  ctx.stroke();
  const gw = m.w * 0.17;
  const gh = m.h * 0.2;
  ctx.lineWidth = Math.max(3, m.w * 0.018);
  ctx.strokeRect(hx - gw / 2, hy - gh / 2, gw, gh);
  ctx.save();
  ctx.globalAlpha = 0.35;
  ctx.fillRect(hx - gw / 2, hy - gh / 2, gw, gh);
  ctx.restore();
}

function drawShooter(ctx: CanvasRenderingContext2D, width: number, height: number, s: SceneInput, c: Colors, X: (u: number) => number, Y: (v: number) => number) {
  const side = s.shooterHand === 'right' ? 1 : -1;
  // Back of the shooter's shoulders along the bottom edge
  ctx.save();
  ctx.translate(width / 2 - side * width * 0.06, height * 1.01);
  ctx.rotate(s.shooter.shoulderTilt);
  ctx.fillStyle = c.jersey;
  ctx.beginPath();
  ctx.ellipse(0, 0, width * 0.3, height * 0.07, 0, Math.PI, 2 * Math.PI);
  ctx.fill();
  ctx.restore();

  // Stick: from the bottom hand off the edge to the head pose
  const hx = X(s.shooter.headX);
  const hy = Y(s.shooter.headY);
  const baseX = width / 2 + side * width * 0.36;
  const baseY = height + 20;
  ctx.strokeStyle = c.shaft;
  ctx.lineWidth = Math.max(8, width * 0.028);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(baseX, baseY);
  ctx.lineTo(hx, hy);
  ctx.stroke();

  // Head points along the shaft. Boys: wider head, deep mesh pocket.
  // Girls: narrower head, shallow strung pocket. Placeholder art.
  const angle = Math.atan2(hy - baseY, hx - baseX) + Math.PI / 2;
  const girls = s.game === 'girls';
  const headW = width * (girls ? 0.12 : 0.15);
  const headH = height * 0.16;
  ctx.save();
  ctx.translate(hx, hy);
  ctx.rotate(angle);
  ctx.beginPath();
  ctx.moveTo(-headW * 0.16, 0);
  ctx.bezierCurveTo(-headW * 0.6, -headH * 0.4, -headW * 0.55, -headH, 0, -headH);
  ctx.bezierCurveTo(headW * 0.55, -headH, headW * 0.6, -headH * 0.4, headW * 0.16, 0);
  ctx.closePath();
  ctx.fillStyle = c.mesh;
  ctx.globalAlpha = girls ? 0.2 : 0.4;
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.strokeStyle = c.mesh;
  ctx.lineWidth = 1;
  for (let i = 1; i < 5; i++) {
    const y = (-headH * i) / 5;
    ctx.beginPath();
    if (girls) {
      ctx.moveTo(-headW * 0.4, y);
      ctx.lineTo(headW * 0.4, y);
    } else {
      ctx.moveTo(-headW * 0.42, y);
      ctx.quadraticCurveTo(0, y + headH * 0.12, headW * 0.42, y);
    }
    ctx.stroke();
  }
  ctx.strokeStyle = c.head;
  ctx.lineWidth = Math.max(3, width * 0.012);
  ctx.beginPath();
  ctx.moveTo(-headW * 0.16, 0);
  ctx.bezierCurveTo(-headW * 0.6, -headH * 0.4, -headW * 0.55, -headH, 0, -headH);
  ctx.bezierCurveTo(headW * 0.55, -headH, headW * 0.6, -headH * 0.4, headW * 0.16, 0);
  ctx.closePath();
  ctx.stroke();
  ctx.restore();
}
