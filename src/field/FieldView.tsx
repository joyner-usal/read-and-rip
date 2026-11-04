import { useEffect, useRef, useState } from 'react';
import { drawScene, type Rect, type SceneInput } from './scene';
import { ZONES, type Zone } from '../scenarios/types';
import { zoneKey, zoneLabel } from '../game/zones';

export type MarkKind = 'best' | 'good' | 'tap' | 'bait';
export interface Mark { kind: MarkKind; label: string }

interface Props {
  /** Called every animation frame with performance.now(); returns what to draw. */
  getScene: (now: number) => SceneInput;
  onTap?: (zone: Zone, at: number) => void;
  disabled?: boolean;
  /** Text marks shown in cells after a rep. Text, not color, carries the meaning. */
  marks?: Partial<Record<Zone, Mark[]>>;
  /** Hides the field (pause). */
  hidden?: boolean;
  /** Extra label for the zone buttons, for example the goalie's side. */
  describeZone?: (z: Zone) => string;
}

/**
 * Canvas draws the scene each frame; real buttons sit over the goal mouth for the
 * 3x3 grid so it works by touch, keyboard, switch and screen reader.
 */
export function FieldView({ getScene, onTap, disabled, marks, hidden, describeZone }: Props) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef(getScene);
  sceneRef.current = getScene;
  const [mouth, setMouth] = useState<Rect | null>(null);
  const pointerTapped = useRef(false);

  useEffect(() => {
    const el = wrap.current;
    const cv = canvas.current;
    if (!el || !cv) return;
    let raf = 0;
    let size = { w: 0, h: 0, dpr: 1 };
    let lastMouth = '';
    const measure = () => {
      const r = el.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 3);
      size = { w: r.width, h: r.height, dpr };
      cv.width = Math.round(r.width * dpr);
      cv.height = Math.round(r.height * dpr);
    };
    const frame = (now: number) => {
      const ctx = cv.getContext('2d');
      if (ctx && size.w > 0) {
        ctx.setTransform(size.dpr, 0, 0, size.dpr, 0, 0);
        const m = drawScene(ctx, size.w, size.h, sceneRef.current(now));
        const key = `${m.x.toFixed(1)},${m.y.toFixed(1)},${m.w.toFixed(1)},${m.h.toFixed(1)}`;
        if (key !== lastMouth) {
          lastMouth = key;
          setMouth(m);
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
  }, []);

  return (
    <div className={`field${hidden ? ' field--hidden' : ''}`} ref={wrap}>
      <canvas ref={canvas} className="field__canvas" aria-hidden="true" />
      {hidden && <div className="field__cover" aria-hidden="true" />}
      {mouth && !hidden && (
        <div
          className="grid"
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
                  onTap?.(z, e.timeStamp);
                }}
                onClick={e => {
                  // Keyboard or switch activation has no pointerdown.
                  if (pointerTapped.current) {
                    pointerTapped.current = false;
                    return;
                  }
                  if (!disabled && e.detail === 0) onTap?.(z, performance.now());
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
    </div>
  );
}
