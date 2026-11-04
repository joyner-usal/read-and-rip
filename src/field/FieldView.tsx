import { useEffect, useRef, useState } from 'react';
import { drawField, type FieldOptions, type Rect } from './drawField';
import { ZONES, type Zone } from '../scenarios/types';

interface Props extends FieldOptions {
  /** Called when a zone is tapped. Phase 0: preview only, no scoring. */
  onPick?: (zone: Zone) => void;
  selected?: Zone | null;
  disabled?: boolean;
}

export const zoneLabel = (z: Zone) => z.replace('-', ' ');

/**
 * Canvas draws the scene; real buttons sit on top of the goal mouth for the
 * 3x3 grid. Buttons keep the grid usable by keyboard, switch, and screen reader.
 */
export function FieldView({ approachAngleDeg, shooterHand, onPick, selected, disabled }: Props) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [mouth, setMouth] = useState<Rect | null>(null);

  useEffect(() => {
    const el = wrap.current;
    const cv = canvas.current;
    if (!el || !cv) return;
    const render = () => {
      const { width, height } = el.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 3);
      cv.width = Math.round(width * dpr);
      cv.height = Math.round(height * dpr);
      const ctx = cv.getContext('2d');
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      setMouth(drawField(ctx, width, height, { approachAngleDeg, shooterHand }));
    };
    render();
    const ro = new ResizeObserver(render);
    ro.observe(el);
    return () => ro.disconnect();
  }, [approachAngleDeg, shooterHand]);

  return (
    <div className="field" ref={wrap}>
      <canvas ref={canvas} className="field__canvas" aria-hidden="true" />
      {mouth && (
        <div
          className="grid"
          role="group"
          aria-label="Goal, nine zones, shown from the shooter's view"
          style={{ left: mouth.x, top: mouth.y, width: mouth.w, height: mouth.h }}
        >
          {ZONES.map(z => (
            <button
              key={z}
              type="button"
              className="grid__cell"
              aria-label={zoneLabel(z)}
              aria-pressed={selected === z}
              disabled={disabled}
              onClick={() => onPick?.(z)}
            >
              {selected === z && <span className="grid__mark" aria-hidden="true">●</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
