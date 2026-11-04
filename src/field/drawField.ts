// Code-drawn field view from behind the shooter's stick. No image files.
// Phase 0 draws a still frame; Phase 1 adds the goalie and shooter cue motion.
import type { Hand } from '../scenarios/types';
import { token } from '../ui/theme';

export interface Rect { x: number; y: number; w: number; h: number }

export interface FieldOptions {
  /** Degrees from straight on; see Scenario.approachAngleDeg. */
  approachAngleDeg: number;
  shooterHand: Hand;
}

/** Where the goal mouth sits, in CSS pixels. The tap grid lines up with this. */
export function goalMouth(width: number, height: number, angleDeg: number): Rect {
  const rad = (angleDeg * Math.PI) / 180;
  const size = Math.min(width * 0.62, height * 0.42);
  const w = size * Math.max(0.55, Math.cos(rad));
  const h = size;
  const x = width / 2 - w / 2 - Math.sin(rad) * width * 0.12;
  const y = height * 0.2;
  return { x, y, w, h };
}

export function drawField(ctx: CanvasRenderingContext2D, width: number, height: number, opts: FieldOptions): Rect {
  const mouth = goalMouth(width, height, opts.approachAngleDeg);
  const c = {
    turf: token('--rr-turf'),
    line: token('--rr-turf-line'),
    crease: token('--rr-crease'),
    pipe: token('--rr-goal-pipe'),
    net: token('--rr-goal-net'),
    goalie: token('--rr-goalie-fill'),
    shaft: token('--rr-stick-shaft'),
    head: token('--rr-stick-head'),
    mesh: token('--rr-stick-mesh')
  };

  // Turf
  ctx.fillStyle = c.turf;
  ctx.fillRect(0, 0, width, height);

  // Crease, flattened into an ellipse for the low camera
  const cx = mouth.x + mouth.w / 2;
  const groundY = mouth.y + mouth.h;
  ctx.strokeStyle = c.crease;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(cx, groundY, mouth.w * 1.25, mouth.h * 0.32, 0, 0, Math.PI * 2);
  ctx.stroke();

  // Net: back pocket plus mesh inside the mouth
  ctx.save();
  ctx.globalAlpha = 0.35;
  ctx.strokeStyle = c.net;
  ctx.lineWidth = 1;
  const step = mouth.w / 10;
  for (let i = 1; i < 10; i++) {
    ctx.beginPath();
    ctx.moveTo(mouth.x + i * step, mouth.y);
    ctx.lineTo(cx + (i - 5) * step * 0.45, groundY - mouth.h * 0.1);
    ctx.stroke();
  }
  for (let j = 1; j < 10; j++) {
    const y = mouth.y + (j * mouth.h) / 10;
    ctx.beginPath();
    ctx.moveTo(mouth.x, y);
    ctx.lineTo(mouth.x + mouth.w, y);
    ctx.stroke();
  }
  ctx.restore();

  // Goalie: a neutral ready stance, simple shapes only
  const gW = mouth.w * 0.34;
  const gH = mouth.h * 0.78;
  const gx = cx - gW / 2;
  const gy = groundY - gH;
  ctx.fillStyle = c.goalie;
  ctx.fillRect(gx, gy + gH * 0.18, gW, gH * 0.52); // torso
  ctx.fillRect(gx + gW * 0.1, gy + gH * 0.7, gW * 0.28, gH * 0.3); // left leg
  ctx.fillRect(gx + gW * 0.62, gy + gH * 0.7, gW * 0.28, gH * 0.3); // right leg
  ctx.beginPath();
  ctx.arc(cx, gy + gH * 0.1, gW * 0.2, 0, Math.PI * 2); // helmet
  ctx.fill();
  // Goalie stick head held high on stick side
  ctx.strokeStyle = c.goalie;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(gx + gW, gy + gH * 0.45);
  ctx.lineTo(gx + gW * 1.25, gy);
  ctx.stroke();
  ctx.strokeRect(gx + gW * 1.05, gy - gH * 0.22, gW * 0.42, gH * 0.24);

  // Goal frame (pipes) over the net
  ctx.strokeStyle = c.pipe;
  ctx.lineWidth = Math.max(4, mouth.w * 0.03);
  ctx.lineJoin = 'miter';
  ctx.beginPath();
  ctx.moveTo(mouth.x, groundY);
  ctx.lineTo(mouth.x, mouth.y);
  ctx.lineTo(mouth.x + mouth.w, mouth.y);
  ctx.lineTo(mouth.x + mouth.w, groundY);
  ctx.stroke();

  // Shooter's stick in the foreground. Right hand: stick on the right side.
  const side = opts.shooterHand === 'right' ? 1 : -1;
  const baseX = width / 2 + side * width * 0.42;
  const tipX = width / 2 + side * width * 0.3;
  const tipY = height * 0.5;
  ctx.strokeStyle = c.shaft;
  ctx.lineWidth = Math.max(8, width * 0.03);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(baseX, height + 10);
  ctx.lineTo(tipX, tipY);
  ctx.stroke();

  // Stick head: an open pocket shape at the top of the shaft
  const headW = width * 0.16;
  const headH = height * 0.17;
  ctx.save();
  ctx.translate(tipX, tipY);
  ctx.rotate(side * -0.25);
  ctx.beginPath();
  ctx.moveTo(-headW * 0.18, 0);
  ctx.bezierCurveTo(-headW * 0.6, -headH * 0.4, -headW * 0.55, -headH, 0, -headH);
  ctx.bezierCurveTo(headW * 0.55, -headH, headW * 0.6, -headH * 0.4, headW * 0.18, 0);
  ctx.closePath();
  ctx.fillStyle = c.mesh;
  ctx.globalAlpha = 0.35;
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.strokeStyle = c.head;
  ctx.lineWidth = Math.max(3, width * 0.012);
  ctx.stroke();
  ctx.restore();

  return mouth;
}
