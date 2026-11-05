// Preloads every sprite before the first rep. One shared promise per page load.
import { SPRITES, SPRITE_NAMES, type SpriteName } from './manifest';

export type SpriteImages = Record<SpriteName, HTMLImageElement>;

let pending: Promise<SpriteImages> | null = null;
let ready: SpriteImages | null = null;

export const spritesReady = (): SpriteImages | null => ready;

export function loadSprites(onProgress?: (done: number, total: number) => void): Promise<SpriteImages> {
  if (pending) return pending;
  const base = import.meta.env.BASE_URL;
  let done = 0;
  const total = SPRITE_NAMES.length;
  pending = Promise.all(
    SPRITE_NAMES.map(async name => {
      const img = new Image();
      img.decoding = 'async';
      img.src = `${base}${SPRITES[name].file}`;
      await img.decode();
      onProgress?.(++done, total);
      return [name, img] as const;
    })
  ).then(entries => (ready = Object.fromEntries(entries) as SpriteImages));
  pending.catch(() => (pending = null)); // allow a retry after a failed load
  return pending;
}
