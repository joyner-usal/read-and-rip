// Typed access to the generated sprite manifest (scripts/build-sprites.py) and the
// reference-frame layout. All positions are in reference-frame px (390 x 844).
import data from './boys-sprites.json';
import type { Zone } from '../scenarios/types';
import { colIndex, rowIndex } from '../game/zones';

export type SpriteName = keyof typeof data.sprites;

export interface SpriteInfo {
  file: string;
  px: number[];
  draw: number[];
  bytes: number;
  anchorKind?: string;
  anchor?: number[];
  pocket?: number[];
}

export interface Rect { x: number; y: number; w: number; h: number }

export const FRAME = data.frame;
export const MOUTH: Rect = data.mouth;
export const BACKGROUND: Rect = data.background;
export const GOAL: Rect = data.goal;
export const GOALIE_FEET = { x: data.goalieFeet[0], y: data.goalieFeet[1] };
export const SHOOTER_HELMET = { x: data.shooterHelmet[0], y: data.shooterHelmet[1] };
export const SPRITES = data.sprites as Record<SpriteName, SpriteInfo>;
export const SPRITE_NAMES = Object.keys(SPRITES) as SpriteName[];

/** Center of a grid zone, in frame px. */
export function zoneCenter(z: Zone): { x: number; y: number } {
  return {
    x: MOUTH.x + MOUTH.w * ((colIndex(z) + 1 + 0.5) / 3),
    y: MOUTH.y + MOUTH.h * ((rowIndex(z) + 1 + 0.5) / 3)
  };
}

/** Where a sprite's box lands when its anchor is placed at (ax, ay). */
export function placeSprite(name: SpriteName, ax: number, ay: number): Rect {
  const s = SPRITES[name];
  const [anx, any] = s.anchor ?? [0, 0];
  return { x: ax - anx, y: ay - any, w: s.draw[0], h: s.draw[1] };
}

export interface Fit { scale: number; x: number; y: number }

/** Sky a short screen may lose from the top before the scene shrinks (D38). */
export const MAX_SKY_CROP = 160;

/**
 * Uniform scale of the reference frame into a viewport. Wider screens letterbox
 * (centered). Short screens first crop up to MAX_SKY_CROP of sky off the top, keeping
 * the bottom anchored, so the goal zones stay full size in a phone browser (D38).
 */
export function fitFrame(width: number, height: number): Fit {
  const contain = Math.min(width / FRAME.w, height / FRAME.h);
  const cropped = Math.min(width / FRAME.w, height / (FRAME.h - MAX_SKY_CROP));
  const scale = Math.min(cropped, Math.max(1, contain));
  const frameH = FRAME.h * scale;
  return { scale, x: (width - FRAME.w * scale) / 2, y: frameH > height ? height - frameH : (height - frameH) / 2 };
}

export const toScreen = (f: Fit, r: Rect): Rect => ({ x: f.x + r.x * f.scale, y: f.y + r.y * f.scale, w: r.w * f.scale, h: r.h * f.scale });
export const toFrame = (f: Fit, x: number, y: number) => ({ x: (x - f.x) / f.scale, y: (y - f.y) / f.scale });
