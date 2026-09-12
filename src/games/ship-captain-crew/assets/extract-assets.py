"""Extract real artwork plates + sprites from the Ship Captain Crew concept art.

Nothing here re-draws the art. Every output is real pixels from the source jpgs:
the plates are the paintings themselves, and the regions that have to carry live
values (dice, names, totals, the round counter) are covered by mirror-tiled
copies of clean texture taken from a few rows above and below the same spot, so
the wash keeps its own grain instead of turning into a gradient smear.
"""
import os
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from scipy import ndimage

SRC = '/Users/joshkauffman/devel/streamingfast/accessible files/dicegame/'
OUT = '/Users/joshkauffman/devel/gamehub/src/games/ship-captain-crew/assets/'
os.makedirs(OUT, exist_ok=True)


def load(name):
    return Image.open(SRC + name).convert('RGB')


def fix_corners(im):
    """Replace the phone-mockup's black rounded corners with the nearest art pixel."""
    a = np.asarray(im).astype(np.int16)
    lum = a.mean(2)
    h, w, _ = a.shape
    for y in range(h):
        ok = np.where(lum[y] >= 60)[0]
        if len(ok) == 0:
            continue
        l, r = ok[0], ok[-1]
        if l > 0:
            a[y, :l] = a[y, l]
        if r < w - 1:
            a[y, r + 1:] = a[y, r]
    return Image.fromarray(a.astype(np.uint8))


def _mirror_stack(src, n):
    """Repeat `src` rows to length n, flipping every other copy so seams vanish."""
    rows = []
    flip = False
    while sum(len(r) for r in rows) < n:
        rows.append(src[::-1] if flip else src)
        flip = not flip
    return np.concatenate(rows, axis=0)[:n]


def cover(arr, y0, y1, x0, x1, top_src, bot_src=None, feather_px=4, smooth=0):
    """Cover rows y0..y1 with mirror-tiled clean texture from the same painting.

    top_src/bot_src are (ya, yb) row ranges of untouched art. When both are given
    the fill cross-fades from one to the other so the vertical gradient survives.
    """
    n = y1 - y0
    a = _mirror_stack(arr[top_src[0]:top_src[1], x0:x1], n)
    if bot_src is not None:
        b = _mirror_stack(arr[bot_src[0]:bot_src[1], x0:x1][::-1], n)[::-1]
        t = np.linspace(0, 1, n)[:, None, None]
        a = a * (1 - t) + b * t
    if smooth:
        a = np.asarray(
            Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))
            .filter(ImageFilter.GaussianBlur(smooth))
        ).astype(np.float64)
    arr[y0:y1, x0:x1] = a
    if feather_px:
        _feather_edges(arr, (x0, y0, x1, y1), feather_px)
    return arr


def cover_h(arr, y0, y1, x0, x1, left_src, right_src=None, feather_px=4, smooth=0):
    """Horizontal twin of `cover` — mirror-tile clean columns across a region.

    Right for the flat washes inside the score panels, where the only structure
    worth keeping is the soft vignette down each edge.
    """
    n = x1 - x0
    a = _mirror_stack(arr[y0:y1, left_src[0]:left_src[1]].transpose(1, 0, 2), n)
    if right_src is not None:
        b = _mirror_stack(
            arr[y0:y1, right_src[0]:right_src[1]].transpose(1, 0, 2)[::-1], n)[::-1]
        t = np.linspace(0, 1, n)[:, None, None]
        a = a * (1 - t) + b * t
    a = a.transpose(1, 0, 2)
    if smooth:
        a = np.asarray(
            Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))
            .filter(ImageFilter.GaussianBlur(smooth))
        ).astype(np.float64)
    arr[y0:y1, x0:x1] = a
    if feather_px:
        _feather_edges(arr, (x0, y0, x1, y1), feather_px)
    return arr


def smear_rows(arr, y0, y1, x0, x1, *src_cols, feather_px=3):
    """Repaint a region row by row with that row's own median colour.

    The gold pills and the input frame are pure vertical gradients, so taking
    each row's median from the clean columns beside it rebuilds the stock
    exactly — no tiling, and no banding where the fill meets the original.
    """
    donors = np.concatenate([arr[y0:y1, a:b] for a, b in src_cols], axis=1)
    arr[y0:y1, x0:x1] = np.median(donors, axis=1)[:, None, :]
    if feather_px:
        _feather_edges(arr, (x0, y0, x1, y1), feather_px)
    return arr


def _feather_edges(arr, box, radius):
    """Blur only the ring straddling the seam, so no hard edge survives."""
    x0, y0, x1, y1 = box
    pad = radius * 4
    h, w, _ = arr.shape
    sx0, sy0 = max(0, x0 - pad), max(0, y0 - pad)
    sx1, sy1 = min(w, x1 + pad), min(h, y1 + pad)
    region = np.clip(arr[sy0:sy1, sx0:sx1], 0, 255).astype(np.uint8)
    blur = np.asarray(
        Image.fromarray(region).filter(ImageFilter.GaussianBlur(radius))
    ).astype(np.float64)
    mask = np.zeros(blur.shape[:2], np.float64)
    mask[y0 - sy0:y1 - sy0, x0 - sx0:x1 - sx0] = 1.0
    mask = np.asarray(
        Image.fromarray((mask * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(radius))
    ).astype(np.float64) / 255.0
    ring = np.clip(mask * (1 - mask) * 4, 0, 1)[..., None]
    arr[sy0:sy1, sx0:sx1] = arr[sy0:sy1, sx0:sx1] * (1 - ring) + blur * ring
    return arr


def patch(arr, box, src_box, feather_px=3):
    """Copy a clean rectangle of the painting over a dirty one."""
    x0, y0, x1, y1 = box
    sx0, sy0, sx1, sy1 = src_box
    p = arr[sy0:sy1, sx0:sx1]
    if p.shape[:2] != (y1 - y0, x1 - x0):
        p = np.asarray(
            Image.fromarray(np.clip(p, 0, 255).astype(np.uint8))
            .resize((x1 - x0, y1 - y0), Image.LANCZOS)
        ).astype(np.float64)
    arr[y0:y1, x0:x1] = p
    if feather_px:
        _feather_edges(arr, box, feather_px)
    return arr


def heal_disc(arr, cx, cy, r, ring=7):
    """Fill a small disc from the ring of art around it (inverse-distance weighted).

    Used only on the die pips: they are round blobs on near-flat cream, which is
    exactly the case this reconstructs cleanly.
    """
    y0, y1 = int(cy - r - ring), int(cy + r + ring) + 1
    x0, x1 = int(cx - r - ring), int(cx + r + ring) + 1
    yy, xx = np.mgrid[y0:y1, x0:x1]
    d = np.sqrt((xx - cx) ** 2 + (yy - cy) ** 2)
    hole = d <= r
    donor = (d > r) & (d <= r + ring)
    dy, dx = np.where(donor)
    src = arr[y0:y1, x0:x1][dy, dx]
    hy, hx = np.where(hole)
    for i in range(len(hy)):
        w = 1.0 / (((dy - hy[i]) ** 2 + (dx - hx[i]) ** 2) ** 1.6 + 1e-6)
        arr[y0 + hy[i], x0 + hx[i]] = (src * w[:, None]).sum(0) / w.sum()
    _feather_edges(arr, (x0 + ring, y0 + ring, x1 - ring, y1 - ring), 2)
    return arr


def save_jpg(arr, name, quality=93):
    Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8)).save(OUT + name, quality=quality)


def cutout(im, box, out, bg_at=(1, 1), tol=32, softness=1.3, size=None):
    """Crop a sprite off flat card stock and matte the surround into alpha."""
    a = np.asarray(im.crop(box).convert('RGB')).astype(np.float64)
    bg = a[bg_at[1], bg_at[0]]
    dist = np.sqrt(((a - bg) ** 2).sum(2))
    alpha = np.clip((dist - tol) / (tol * softness), 0, 1)
    img = Image.fromarray(np.dstack([a, alpha * 255]).astype(np.uint8), 'RGBA')
    if size:
        img = img.resize(size, Image.LANCZOS)
    img.save(OUT + out)
    return img


def cutout_dark(im, box, out, lo=96, hi=188):
    """Matte a dark glyph off a pale ground by luminance, keeping its own colour."""
    a = np.asarray(im.crop(box).convert('RGB')).astype(np.float64)
    lum = a.mean(2)
    alpha = np.clip((hi - lum) / (hi - lo), 0, 1)
    Image.fromarray(np.dstack([a, alpha * 255]).astype(np.uint8), 'RGBA').save(OUT + out)


def crop_png(im, box, out, size=None):
    c = im.crop(box)
    if size:
        c = c.resize(size, Image.LANCZOS)
    c.save(OUT + out)
    return c


# ============================================================== harbor =======
# 8Msyl.jpg is an iPhone mockup; the live screen is (23,23)-(757,1168) and the
# first 58 rows of that are the mocked-up status bar.
HARBOR_RAW = fix_corners(load('8Msyl.jpg').crop((23, 23, 757, 1168)))   # 734 x 1145
HARBOR_TOP = 62          # below the mocked-up status bar and the notch


def build_harbor():
    a = np.asarray(HARBOR_RAW).astype(np.float64)

    # the notch reaches just past the crop line; paint it out with its own sky
    cover_h(a, 0, 72, 280, 466, (240, 278), (468, 506))
    # ★ row under SHIP / CAPTAIN / CREW lights up per claimed role -> live
    cover_h(a, 334, 373, 104, 636, (212, 248), (300, 336), smooth=1.2)
    for dx in (270, 457):                      # keep the dashed column rules
        patch(a, (dx, 334, dx + 12, 373), (dx, 291, dx + 12, 330), feather_px=2)
    # the five painted dice sit on open water -> live
    cover(a, 488, 630, 20, 716, (462, 486), (632, 652), feather_px=5)
    # player names and totals -> live (ribbon, rule and emblem stay baked in)
    for x0, x1, lx, rx in ((36, 350, (38, 62), (320, 344)),
                           (382, 698, (384, 408), (668, 692))):
        cover_h(a, 722, 770, x0, x1, lx, rx, smooth=2.0)
        cover_h(a, 790, 884, x0, x1, lx, rx, smooth=2.0)
    save_jpg(a[HARBOR_TOP:], 'harbor-plate.jpg')

    # --- sprites, lifted straight out of the painting -----------------------
    cutout(HARBOR_RAW, (168, 340, 206, 376), 'harbor-star.png', bg_at=(1, 1), tol=26)
    _harbor_die()


# die #3 of the painted row faces the camera squarely. Its five pips sit on a
# 24.2 x 26.8 grid centred at (60, 66) inside this crop — the app relays pips on
# that same grid, so every value keeps the painting's own spacing.
HARBOR_DIE_BOX = (310, 486, 432, 628)
HARBOR_PIP_GRID = dict(cx=60.0, cy=66.0, dx=24.2, dy=26.8)


def _harbor_die():
    a = np.asarray(HARBOR_RAW.crop(HARBOR_DIE_BOX)).astype(np.float64)
    g = HARBOR_PIP_GRID
    for ox, oy in ((-1, -1), (1, -1), (0, 0), (-1, 1), (1, 1)):
        heal_disc(a, g['cx'] + ox * g['dx'], g['cy'] + oy * g['dy'], 12)
    # lift the die off the water: keep the cream body, drop the painted sea
    rgb = np.clip(a, 0, 255)
    warm = rgb[..., 0] - rgb[..., 2]                       # cream is warm, sea is cold
    body = ndimage.binary_fill_holes(ndimage.binary_closing(warm > 6, np.ones((7, 7))))
    lab, n = ndimage.label(body)
    if n:
        body = lab == (np.argmax(ndimage.sum(body, lab, range(1, n + 1))) + 1)
    alpha = np.asarray(
        Image.fromarray((body * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.1))
    ).astype(np.float64)
    Image.fromarray(np.dstack([rgb, alpha]).astype(np.uint8), 'RGBA').save(OUT + 'harbor-die.png')

    # one pip, alpha-matted off the cream, re-laid by the app in standard patterns
    cutout(HARBOR_RAW, (332, 511, 361, 540), 'harbor-pip.png',
           bg_at=(1, 1), tol=22, softness=0.9)


# =============================================================== home ========
# 4B94z.jpg is a frameless poster, so the whole 784 x 1168 frame is the screen.
# Almost everything on it is static, so the plate ships untouched and the app
# covers only the two pill rows and the player-2 block with the card's own
# cream stock when their state changes.
HOME_RAW = load('4B94z.jpg')


def build_home():
    a = np.asarray(HOME_RAW).astype(np.float64)
    # Every control on the card is stateful, so lift them all off the painting
    # and let the app put them back from the sprites below. The card's own left
    # and right margins are clean for its whole height, so the stock underneath
    # is the real paper rather than a flat fill.
    edges = ((68, 94), (688, 714))
    cover_h(a, 392, 492, 100, 690, *edges, smooth=2.5)     # 1 / 2 players
    cover_h(a, 504, 548, 100, 690, *edges, smooth=2.5)     # "Number of Rounds"
    cover_h(a, 552, 660, 100, 690, *edges, smooth=2.5)     # round count
    cover_h(a, 664, 934, 88, 700, *edges, smooth=2.5)      # both player blocks
    save_jpg(a, 'home-plate.jpg', quality=94)

    # the selected pill, with its numeral healed away, used as a CSS border-image
    pill = np.asarray(HOME_RAW.crop((110, 400, 394, 484))).astype(np.float64)
    smear_rows(pill, 6, 78, 30, 250, (12, 30), (250, 272))
    ph, pw = pill.shape[:2]
    pmask = Image.new('L', (pw * 4, ph * 4), 0)
    ImageDraw.Draw(pmask).rounded_rectangle((0, 0, pw * 4 - 1, ph * 4 - 1),
                                            radius=ph * 2, fill=255)
    pmask = pmask.resize((pw, ph), Image.LANCZOS)
    Image.fromarray(
        np.dstack([np.clip(pill, 0, 255), np.asarray(pmask)]).astype(np.uint8), 'RGBA'
    ).save(OUT + 'home-pill.png')

    cutout(HOME_RAW, (188, 508, 592, 544), 'home-rounds-label.png', bg_at=(1, 1), tol=22)
    cutout(HOME_RAW, (218, 676, 324, 712), 'home-label-1.png', bg_at=(1, 1), tol=26)
    cutout(HOME_RAW, (218, 813, 326, 850), 'home-label-2.png', bg_at=(1, 1), tol=26)

    field = np.asarray(HOME_RAW.crop((206, 714, 676, 788))).astype(np.float64)
    smear_rows(field, 10, 64, 40, 430, (22, 38), (432, 450))   # drop the sample name
    Image.fromarray(np.clip(field, 0, 255).astype(np.uint8)).save(OUT + 'home-field.png')

    cutout(HOME_RAW, (374, 552, 410, 586), 'home-star.png', bg_at=(1, 1), tol=30)
    cutout(HOME_RAW, (146, 414, 200, 470), 'home-anchor.png', bg_at=(1, 1), tol=30)
    cutout(HOME_RAW, (96, 684, 198, 788), 'home-avatar-1.png', bg_at=(1, 1), tol=26)
    cutout(HOME_RAW, (96, 820, 198, 924), 'home-avatar-2.png', bg_at=(1, 1), tol=26)


# ================================================================ cove =======
# W4wo1.jpg is an iPhone mockup; live screen (34,22)-(750,1146), status bar 52px.
COVE_RAW = fix_corners(load('W4wo1.jpg').crop((34, 22, 750, 1146)))     # 716 x 1124
COVE_TOP = 52
COVE_BOT = 1124


def build_cove():
    a = np.asarray(COVE_RAW).astype(np.float64)

    cover_h(a, 0, 58, 250, 470, (210, 248), (472, 510))     # notch
    # "Round 1 of 3" inside the parchment banner -> live
    cover_h(a, 270, 314, 212, 508, (180, 210), (510, 540), smooth=1.0)
    # the five glass dice -> live
    cover(a, 450, 634, 16, 706, (444, 458), (638, 656), smooth=0.8, feather_px=5)
    # each card's total and crew name -> live (banner, emblem, compass star,
    # palm and ruled lines all stay baked in)
    cover(a, 704, 846, 250, 512, (678, 702), smooth=3.0)
    cover(a, 896, 1038, 250, 512, (884, 896), smooth=3.0)
    # the closing flourish makes way for the action row
    cover_h(a, 1048, COVE_BOT, 196, 524, (146, 194), (526, 574), smooth=1.0)
    # --- sprites ------------------------------------------------------------
    Image.fromarray(np.clip(a[268:316, 168:556], 0, 255).astype(np.uint8)) \
         .save(OUT + 'cove-banner.png')                            # emptied banner
    _cove_die()
    save_jpg(a[COVE_TOP:COVE_BOT], 'cove-plate.jpg')


COVE_DIE_BOX = (422, 502, 512, 600)


def _cove_die():
    """Keep die #4's front face and its glass edges; repaint only the interior
    with the blank right-hand face, which carries no glyph."""
    a = np.asarray(COVE_RAW.crop(COVE_DIE_BOX)).astype(np.float64)
    h, w = a.shape[:2]
    strip = np.asarray(COVE_RAW.crop((512, 512, 546, 584))).astype(np.float64)
    fill = _mirror_stack(strip.transpose(1, 0, 2), 66).transpose(1, 0, 2)
    fill = np.asarray(
        Image.fromarray(fill.astype(np.uint8)).resize((66, 76), Image.LANCZOS)
        .filter(ImageFilter.GaussianBlur(0.6))
    ).astype(np.float64)
    a[12:88, 12:78] = fill
    _feather_edges(a, (12, 12, 78, 88), 4)
    mask = Image.new('L', (w * 4, h * 4), 0)
    ImageDraw.Draw(mask).rounded_rectangle((4, 4, w * 4 - 5, h * 4 - 5), radius=64, fill=255)
    mask = mask.resize((w, h), Image.LANCZOS).filter(ImageFilter.GaussianBlur(0.8))
    Image.fromarray(
        np.dstack([np.clip(a, 0, 255), np.asarray(mask)]).astype(np.uint8), 'RGBA'
    ).save(OUT + 'cove-die.png')

    # role glyphs the painted dice already carry
    cutout_dark(COVE_RAW, (94, 526, 170, 596), 'cove-role-ship.png')
    cutout_dark(COVE_RAW, (220, 508, 294, 562), 'cove-role-captain.png')
    cutout_dark(COVE_RAW, (323, 530, 385, 600), 'cove-role-crew.png')


# ================================================================= sea =======
# xXYiG.jpg is a frameless poster: the whole 784 x 1168 frame is the screen.
SEA_RAW = load('xXYiG.jpg')


def build_sea():
    a = np.asarray(SEA_RAW).astype(np.float64)

    cover(a, 428, 600, 14, 772, (400, 426), (602, 628), feather_px=5)   # dice
    for top in (668, 852):                                             # score bars
        cover(a, top + 47, top + 96, 196, 520, (top + 22, top + 44), (top + 97, top + 106), smooth=2.0)
        cover_h(a, top + 62, top + 138, 546, 726, (540, 558), (728, 744), smooth=1.4)
    # closing flourish and footer make way for the action row
    cover(a, 1048, 1168, 0, 784, (1036, 1058), feather_px=4)
    save_jpg(a, 'sea-plate.jpg')

    _sea_die()


# the first painted die is the only one that carries pips rather than a
# numeral, so healing those five discs leaves the cleanest blank face.
SEA_DIE_BOX = (26, 434, 172, 588)
SEA_PIP_GRID = dict(cx=72.25, cy=75.5, dx=26.25, dy=28.5)


def _sea_die():
    a = np.asarray(SEA_RAW.crop(SEA_DIE_BOX)).astype(np.float64)
    g = SEA_PIP_GRID
    for ox, oy in ((-1, -1), (1, -1), (0, 0), (-1, 1), (1, 1)):
        heal_disc(a, g['cx'] + ox * g['dx'], g['cy'] + oy * g['dy'], 14)
    rgb = np.clip(a, 0, 255)
    body = ndimage.binary_fill_holes(
        ndimage.binary_closing(rgb[..., 0] - rgb[..., 2] > 4, np.ones((7, 7))))
    lab, n = ndimage.label(body)
    if n:
        body = lab == (np.argmax(ndimage.sum(body, lab, range(1, n + 1))) + 1)
    alpha = np.asarray(
        Image.fromarray((body * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.1))
    ).astype(np.float64)
    Image.fromarray(np.dstack([rgb, alpha]).astype(np.uint8), 'RGBA').save(OUT + 'sea-die.png')


if __name__ == '__main__':
    build_harbor()
    build_home()
    build_cove()
    build_sea()
    print('ok')
