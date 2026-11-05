// The code-drawn scene, kept for fields with no sprite set yet (girls). Same stage API.
import type { Zone } from '../scenarios/types';
import { NO_CAMERA, type CameraTransform, type StageRenderer } from '../art/renderer';
import type { Rect } from '../art/manifest';
import { drawScene, goalMouth, type SceneInput } from './scene';
import { token } from '../ui/theme';

export class LegacyRenderer implements StageRenderer {
  private m: Rect | null = null;
  private angle = 0;
  constructor(private sceneAt: (now: number) => SceneInput | null) {}
  paintStatic(ctx: CanvasRenderingContext2D, w: number, h: number) {
    ctx.fillStyle = token('--rr-navy');
    ctx.fillRect(0, 0, w, h); // drawScene paints the whole field each frame
  }
  draw(ctx: CanvasRenderingContext2D, w: number, h: number, now: number) {
    const s = this.sceneAt(now);
    if (!s) return;
    this.angle = s.approachAngleDeg;
    this.m = drawScene(ctx, w, h, s);
  }
  mouth(w: number, h: number): Rect {
    return this.m ?? goalMouth(w, h, this.angle);
  }
  camera(): CameraTransform {
    return NO_CAMERA;
  }
  tap(_z: Zone) {}
}
