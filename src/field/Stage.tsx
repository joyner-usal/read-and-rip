import { useEffect, useRef, useState } from 'react';
import { ZONES, type Zone } from '../scenarios/types';
import { zoneKey, zoneLabel } from '../game/zones';
import type { StageRenderer } from '../art/renderer';
import type { Rect } from '../art/manifest';

export type MarkKind = 'best' | 'good' | 'tap' | 'bait';
export interface Mark { kind: MarkKind; label: string }

interface Props {
  renderer: StageRenderer;
  /** Runs first in every animation frame (the game ticks here). */
  onFrame?: (now: number) => void;
  onTap?: (zone: Zone, at: number) => void;
  disabled?: boolean;
  /** Zone outlines and tags, shown only in feedback. */
  marks?: Partial<Record<Zone, Mark[]>>;
  hidden?: boolean;
  describeZone?: (z: Zone) => string;
}

const MAX_DPR = 2;
/** Render scales to fall back to when frames run slow. Never below 1. */
const DPR_STEPS = [2, 1.5, 1];
const SLOW_FRAME_MS = 18; // average slower than about 55 fps
const WINDOW = 90; // frames per check

/**
 * Steps the canvas resolution down when the device can't keep up. Software raster on a
 * slow phone costs per pixel: at 4x CPU throttle we measured 28 fps at 2x density,
 * 42 at 1.5x and 58 at 1x. Only steps down, so it never flickers between levels.
 */
export function nextDpr(current: number, meanFrameMs: number): number {
  if (meanFrameMs <= SLOW_FRAME_MS) return current;
  const lower = DPR_STEPS.find(d => d < current - 0.01);
  return lower ?? current;
}

/**
 * The static layer (background, goal) is painted once per size change into an offscreen
 * canvas. Each frame copies it into one opaque on-screen canvas, then draws the players,
 * ball and effects. One opaque layer is much cheaper to composite than two stacked
 * full-screen canvases (measured: about 2x the frame rate at 4x CPU throttle). Nine real buttons sit
 * over the goal mouth, invisible during play, so the grid works by touch, keyboard,
 * switch and screen reader.
 */
export function Stage({ renderer, onFrame, onTap, disabled, marks, hidden, describeZone }: Props) {
  const wrap = useRef<HTMLDivElement>(null);
  const cv = useRef<HTMLCanvasElement>(null);
  const fpsRef = useRef<HTMLSpanElement>(null);
  const frameRef = useRef(onFrame);
  frameRef.current = onFrame;
  const [mouth, setMouth] = useState<Rect | null>(null);
  const pointerTapped = useRef(false);

  useEffect(() => {
    const el = wrap.current;
    const dc = cv.current;
    if (!el || !dc) return;
    const sc = document.createElement('canvas');
    const ctx = dc.getContext('2d', { alpha: false });
    if (!ctx) return;
    let raf = 0;
    let size = { w: 0, h: 0, dpr: 1 };
    let dprCap = MAX_DPR;
    let lastT = 0;
    const recent: number[] = [];
    const mountedAt = performance.now();
    let lastMouth = '';
    let frames = 0;
    let fpsAt = performance.now();
    const measure = () => {
      const r = el.getBoundingClientRect();
      const dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, dprCap));
      size = { w: r.width, h: r.height, dpr };
      for (const c of [sc, dc]) {
        c.width = Math.round(r.width * dpr);
        c.height = Math.round(r.height * dpr);
      }
      const sctx = sc.getContext('2d', { alpha: false });
      if (sctx && r.width > 0) {
        sctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        renderer.paintStatic(sctx, r.width, r.height);
      }
    };
    const frame = (now: number) => {
      // Adaptive resolution: sample frame times, ignoring gaps (tab switches, pauses).
      const dt = lastT ? now - lastT : 0;
      lastT = now;
      // Skip the first second: image decode and first paints stutter on any device.
      if (dt > 0 && dt < 100 && now - mountedAt > 1000) recent.push(dt);
      if (recent.length >= WINDOW) {
        const mean = recent.reduce((a, b) => a + b, 0) / recent.length;
        recent.length = 0;
        const next = nextDpr(Math.min(size.dpr, dprCap), mean);
        if (next < size.dpr) {
          dprCap = next;
          measure();
        }
      }
      frameRef.current?.(now);
      if (size.w > 0) {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.drawImage(sc, 0, 0);
        ctx.setTransform(size.dpr, 0, 0, size.dpr, 0, 0);
        renderer.draw(ctx, size.w, size.h, now);
        const m = renderer.mouth(size.w, size.h);
        const key = `${m.x.toFixed(1)},${m.y.toFixed(1)},${m.w.toFixed(1)},${m.h.toFixed(1)}`;
        if (key !== lastMouth) {
          lastMouth = key;
          setMouth(m);
        }
      }
      if (import.meta.env.DEV && fpsRef.current) {
        frames++;
        if (now - fpsAt >= 500) {
          fpsRef.current.textContent = `${Math.round((frames * 1000) / (now - fpsAt))} fps, ${size.dpr}x`;
          frames = 0;
          fpsAt = now;
        }
      }
      raf = requestAnimationFrame(frame);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [renderer]);

  const showMarks = !!marks && Object.keys(marks).length > 0;

  return (
    <div className="stage" ref={wrap}>
      <canvas ref={cv} className="stage__canvas" aria-hidden="true" />
      {hidden && <div className="stage__cover" aria-hidden="true" />}
      {mouth && !hidden && (
        <div
          className={`grid${showMarks ? ' grid--marks' : ''}`}
          role="group"
          aria-label="Goal, nine zones, named from the shooter's view"
          style={{ left: mouth.x, top: mouth.y, width: mouth.w, height: mouth.h }}
        >
          {ZONES.map(z => {
            const ms = marks?.[z] ?? [];
            const extra = describeZone ? `, ${describeZone(z)}` : '';
            const markText = ms.length ? `, ${ms.map(m => m.label).join(', ')}` : '';
            return (
              <button
                key={z}
                type="button"
                className={`grid__cell${ms.map(m => ` grid__cell--${m.kind}`).join('')}`}
                aria-label={`${zoneLabel(z)}${extra}, key ${zoneKey(z)}${markText}`}
                aria-disabled={disabled || undefined}
                onPointerDown={e => {
                  if (disabled || e.button !== 0) return;
                  pointerTapped.current = true;
                  const r = wrap.current!.getBoundingClientRect();
                  renderer.ripple(e.clientX - r.left, e.clientY - r.top, e.timeStamp);
                  onTap?.(z, e.timeStamp);
                }}
                onClick={e => {
                  if (pointerTapped.current) {
                    pointerTapped.current = false;
                    return;
                  }
                  if (!disabled && e.detail === 0) {
                    const now = performance.now();
                    renderer.rippleZone(z, now);
                    onTap?.(z, now);
                  }
                }}
              >
                {ms.length > 0 && (
                  <span className="grid__marks" aria-hidden="true">
                    {ms.map(m => (
                      <span key={m.kind} className={`grid__mark grid__mark--${m.kind}`}>{m.label}</span>
                    ))}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
      {import.meta.env.DEV && <span className="stage__fps" ref={fpsRef} aria-hidden="true" />}
    </div>
  );
}
