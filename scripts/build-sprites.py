#!/usr/bin/env python3
"""Build the boys sprite set from read-and-rip-sprites.zip (repo root).

    python3 scripts/build-sprites.py

- Unpacks the PNGs to a temp folder (the originals never enter public/ or the build).
- Writes WebP (alpha kept, quality 85) to public/sprites/boys/, each resized to no
  more than 2x its on-screen size in the 390 x 844 reference frame.
- Writes src/art/boys-sprites.json: frame layout, draw sizes and anchor points.

Anchor points below were measured from the source PNGs (bounding boxes, foot lines,
helmet edges, stick pockets). If the art changes, re-measure and update ANCHORS.
Needs Pillow with WebP support.
"""
import json
import os
import sys
import tempfile
import zipfile

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ZIP = os.path.join(ROOT, 'read-and-rip-sprites.zip')
OUT_DIR = os.path.join(ROOT, 'public', 'sprites', 'boys')
MANIFEST = os.path.join(ROOT, 'src', 'art', 'boys-sprites.json')
QUALITY = 85
MAX_DENSITY = 2  # never ship more than 2x the on-screen size

# ---- Reference frame (CSS px at scale 1) ----
FRAME = {'w': 390, 'h': 844}
MOUTH = {'x': 112.5, 'y': 357.6, 'w': 165.0, 'h': 164.4}  # inside edges of the pipes
CREASE_CENTER_Y = 522
GOALIE_FEET = [195, 535]
SHOOTER_LEFT = 118          # left edge of the cocked pose
SHOOTER_OVERLAP = 14        # how far the shooter hangs below the bottom edge

# ---- Measured in source pixels ----
BG_CREASE_CENTER = (425.5, 1083.0)       # white crease ellipse center in background.png
GOAL_MOUTH_SRC = (80, 48, 960, 925)       # x0, y0, x1, y1 of the mouth in goal.png

GOALIE_READY_H = 507                      # ready pose canvas height -> about 174 on screen
GOALIE_SCALE = 174 / GOALIE_READY_H
NAVY_DIVE_NORMALIZE = 544 / 420           # navy dive is drawn smaller than the gray dive

SHOOTER_SCALE = 0.815                     # cocked pose (normalized width 325) -> about 265 wide
NAVY_BIG = 1.46                           # navy carry and cocked are 1.46x the other poses

# kind: 'feet' anchors at the feet (x center, foot line); 'pocket' at the stick pocket;
# 'helmet' at the helmet's left edge and the hem (bottom). Values in source px.
ANCHORS = {
    'goalie_gray_ready_high_screenleft': ('feet', 166.5, 499, None),
    'goalie_gray_high_screenleft_lean': ('feet', 210, 498, None),
    'goalie_gray_high_screenright': ('feet', 180.5, 499, None),
    'goalie_gray_low_screenleft': ('feet', 183, 363, None),
    'goalie_gray_low_screenright': ('feet', 190.5, 375, None),
    'goalie_gray_dive_screenleft': ('pocket', 97, 89, None),
    'goalie_navy_dive_screenleft': ('pocket', 80, 71, None),
    'shooter_navy_carry': ('helmet', 38, 483, None),
    'shooter_navy_cocked': ('helmet', 29, 481, None),
    'shooter_navy_release': ('helmet', 27, 353, (291, 43)),
    'shooter_navy_follow': ('helmet', 13, 313, None),
    'shooter_gray_carry': ('helmet', 39, 332, None),
    'shooter_gray_cocked': ('helmet', 34, 331, None),
    'shooter_gray_release': ('helmet', 28, 353, (291, 43)),
    'shooter_gray_follow': ('helmet', 16, 314, None),
}


def draw_scale(name):
    if name == 'background':
        return (FRAME['w'] * 1.3) / 852
    if name == 'goal':
        return MOUTH['w'] / (GOAL_MOUTH_SRC[2] - GOAL_MOUTH_SRC[0])
    if name == 'goalie_navy_dive_screenleft':
        return GOALIE_SCALE * NAVY_DIVE_NORMALIZE
    if name.startswith('goalie_'):
        return GOALIE_SCALE
    if name in ('shooter_navy_carry', 'shooter_navy_cocked'):
        return SHOOTER_SCALE / NAVY_BIG
    if name.startswith('shooter_'):
        return SHOOTER_SCALE
    raise KeyError(name)


def main():
    if not os.path.exists(ZIP):
        sys.exit(f'missing {ZIP}')
    os.makedirs(OUT_DIR, exist_ok=True)
    os.makedirs(os.path.dirname(MANIFEST), exist_ok=True)
    sprites = {}
    with tempfile.TemporaryDirectory() as tmp:
        with zipfile.ZipFile(ZIP) as z:
            for info in z.infolist():
                base = os.path.basename(info.filename)
                if not base.endswith('.png') or '/' in info.filename.strip('/'):
                    continue  # flat PNGs only; ignore anything nested or odd
                z.extract(info, tmp)
        for file in sorted(os.listdir(tmp)):
            name = file[:-4]
            if name == 'spare_stick_head_back_view':
                continue  # unused for now; stays in the zip only
            im = Image.open(os.path.join(tmp, file))
            im = im.convert('RGBA' if im.mode in ('RGBA', 'LA', 'P') else 'RGB')
            s = draw_scale(name)
            factor = min(1.0, MAX_DENSITY * s)  # export px per source px
            w, h = im.size
            ew, eh = max(1, round(w * factor)), max(1, round(h * factor))
            if (ew, eh) != (w, h):
                im = im.resize((ew, eh), Image.LANCZOS)
            out = os.path.join(OUT_DIR, f'{name}.webp')
            im.save(out, 'WEBP', quality=QUALITY, method=6, exact=False)
            rec = {
                'file': f'sprites/boys/{name}.webp',
                'px': [ew, eh],
                'draw': [round(w * s, 2), round(h * s, 2)],
                'bytes': os.path.getsize(out),
            }
            if name in ANCHORS:
                kind, ax, ay, pocket = ANCHORS[name]
                rec['anchorKind'] = kind
                rec['anchor'] = [round(ax * s, 2), round(ay * s, 2)]
                if pocket:
                    rec['pocket'] = [round(pocket[0] * s, 2), round(pocket[1] * s, 2)]
            sprites[name] = rec

    bg_s = draw_scale('background')
    goal_s = draw_scale('goal')
    cocked_helmet = ANCHORS['shooter_navy_cocked'][1] * draw_scale('shooter_navy_cocked')
    manifest = {
        'frame': FRAME,
        'mouth': MOUTH,
        'background': {
            'x': round((FRAME['w'] - 852 * bg_s) / 2, 2),
            'y': round(CREASE_CENTER_Y - BG_CREASE_CENTER[1] * bg_s, 2),
            'w': round(852 * bg_s, 2),
            'h': round(1846 * bg_s, 2),
        },
        'goal': {
            'x': round(MOUTH['x'] - GOAL_MOUTH_SRC[0] * goal_s, 2),
            'y': round(MOUTH['y'] - GOAL_MOUTH_SRC[1] * goal_s, 2),
            'w': round(1042 * goal_s, 2),
            'h': round(954 * goal_s, 2),
        },
        'goalieFeet': GOALIE_FEET,
        # Every shooter pose puts its helmet's left edge here and its hem on this line.
        'shooterHelmet': [round(SHOOTER_LEFT + cocked_helmet, 2), FRAME['h'] + SHOOTER_OVERLAP],
        'sprites': sprites,
    }
    with open(MANIFEST, 'w') as f:
        json.dump(manifest, f, indent=2)
        f.write('\n')
    total = sum(v['bytes'] for v in sprites.values())
    print(f'{len(sprites)} sprites, {total / 1024:.0f} KB total -> {os.path.relpath(OUT_DIR, ROOT)}')
    for k, v in sprites.items():
        print(f"  {k:36s} {v['px'][0]:4d}x{v['px'][1]:<4d} draw {v['draw'][0]:.0f}x{v['draw'][1]:.0f}  {v['bytes'] // 1024} KB")


if __name__ == '__main__':
    main()
