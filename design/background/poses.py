"""Animal rigs and their animation, as plain maths (no bpy): which solid sits where at time t.

Each animal is a set of ellipsoids and tapered limbs. All of them move in the side-view plane (x forward, z up,
metres), because the artwork shows them in profile; the crow is the exception and is posed in 3D. `rigs.py` builds
the solids in Blender from these lists and renders them as flat silhouettes.

A pose is a list of primitives:
    ("ell",  cx, cz, rx, rz, angle)          ellipsoid, angle in radians (counter-clockwise, +x towards +z)
    ("limb", ax, az, bx, bz, ra, rb)         tapered limb with rounded ends from a to b
    ("ell3", (x, y, z), (rx, ry, rz), (ex, ey, ez))   free 3D ellipsoid: centre, radii, Euler XYZ in radians

Motion rules used throughout, because a silhouette shows nothing but timing and gait:
- every move is eased, with a small anticipation before it and an overshoot and settle after it;
- feet are planted by inverse kinematics, so the body can shift its weight over them without sliding;
- animals hold still between moves (holds also cost no bytes: identical frames are stored once);
- loop lengths differ per animal (16, 18, 8, 1 and 0.5 s), so the animals never move in step.
"""
from __future__ import annotations

import math

FPS = 12                    # drawn "on twos": the classic cadence for hand-drawn animal animation
rad = math.radians


# ================================================================ timing helpers
def ease(u: float) -> float:
    u = min(1.0, max(0.0, u))
    return u * u * u * (u * (u * 6 - 15) + 10)


def move(t: float, start: float, end: float, a: float, b: float, settle: float = 0.0) -> float:
    """a before `start`, b after `end`, eased in between. `settle` adds an overshoot that rings out after `end`
    (as a fraction of the move), which is what makes a head stop like a head and not like a machine."""
    if t <= start:
        return a
    if t < end:
        return a + (b - a) * ease((t - start) / (end - start))
    if t - end > 0.75:                                  # then truly still, so held frames are identical
        return b
    ring = settle * math.exp(-(t - end) * 7.0) * math.sin((t - end) * 14.0) * (1 - (t - end) / 0.75)
    return b + (b - a) * ring


def track(t: float, keys: list, settle: float = 0.0) -> float:
    """Value at t of a list of (start, end, value) moves; before the first move it holds keys[0][2]'s origin."""
    value = keys[0][2]
    for (start, end, target), prev in zip(keys[1:], keys[:-1]):
        if t > start:
            value = move(t, start, end, prev[2], target, settle)
    return value


def flick(t: float, at: float, length: float = 0.25) -> float:
    """A quick out-and-back, 0 -> 1 -> 0, fast out and slower back."""
    u = (t - at) / length
    if not 0.0 < u < 1.0:
        return 0.0
    return math.sin(math.pi * u ** 0.6) ** 2


def rot(x: float, z: float, a: float):
    c, s = math.cos(a), math.sin(a)
    return x * c - z * s, x * s + z * c


def two_bone(a, c, l1, l2, bend):
    """The middle joint of a two-bone chain from a to c. bend = +1 or -1 picks the side the joint folds to
    (seen from a looking at c: +1 is to the left). A target out of reach gives a straight limb."""
    dx, dz = c[0] - a[0], c[1] - a[1]
    d = max(1e-6, min(math.hypot(dx, dz), l1 + l2 - 1e-4))
    along = (l1 * l1 - l2 * l2 + d * d) / (2 * d)
    off = math.sqrt(max(0.0, l1 * l1 - along * along)) * bend
    ux, uz = dx / math.hypot(dx, dz), dz / math.hypot(dx, dz)
    return a[0] + ux * along - uz * off, a[1] + uz * along + ux * off


def polar(p, angle, length):
    return p[0] + math.cos(angle) * length, p[1] + math.sin(angle) * length


# ================================================================ deer
DEER_BODY_Z = 0.82
FETLOCK_Z = 0.058
FORE_X, HIND_X = 0.35, -0.46          # where the fetlocks stand


def deer_pose(*, buck=False, shift=0.0, drop=0.0, pitch=0.0, neck1=55.0, neck2=68.0, head=-18.0, ears=(52.0, 108.0),
              tail=-104.0, lift_near_fore=0.0, lift_far_hind=0.0) -> list:
    """shift: body forward (m) over planted feet. drop: body lower (m). pitch: degrees, + raises the front.
    neck1, neck2, head: degrees above horizontal of the lower neck, upper neck and head. ears, tail: same.
    lift_*: 0..1, how far that leg is picked up."""
    k = 1.22 if buck else 1.0                           # a rutting buck's neck is much thicker
    o = (shift, DEER_BODY_Z - drop)
    p = rad(pitch)

    def at(x, z):                                       # body-local point to the picture plane
        bx, bz = rot(x, z, p)
        return o[0] + bx, o[1] + bz

    out = []

    def ell(x, z, rx, rz, a=0.0):
        cx, cz = at(x, z)
        out.append(("ell", cx, cz, rx, rz, a + p))

    ell(0.20, -0.01, 0.26, 0.185)                       # ribcage
    ell(0.31, 0.03, 0.14, 0.185)                        # shoulder
    ell(0.00, 0.085, 0.33, 0.08)                        # back: one long line from withers to croup
    ell(-0.08, 0.00, 0.29, 0.15, rad(-4))               # barrel, tucked up towards the flank
    ell(-0.32, 0.01, 0.19, 0.185)                       # hindquarter
    ell(-0.41, 0.045, 0.125, 0.135)                     # croup: a round rump, not a corner
    ell(0.40, -0.03, 0.085, 0.12)                       # brisket
    ell(0.39, 0.07, 0.125 * k, 0.125 * k)               # where the neck meets the chest

    # legs: near pair, then far pair standing a little off so all four read
    for side, fx, hx in (("near", FORE_X, HIND_X), ("far", FORE_X - 0.12, HIND_X + 0.14)):
        elbow = at(0.30 if side == "near" else 0.27, -0.17)
        lift = lift_near_fore if side == "near" else 0.0
        foot = (fx + 0.05 * lift, FETLOCK_Z + 0.16 * lift)
        knee = two_bone(elbow, foot, 0.31, 0.265, +1)                            # the knee folds forward
        hoof = polar(foot, rad(-72 - 55 * lift), 0.055)
        out += [("limb", *elbow, *knee, 0.060, 0.032), ("limb", *knee, *foot, 0.028, 0.021),
                ("limb", *foot, *hoof, 0.022, 0.026)]
        hip = at(-0.34 if side == "near" else -0.31, -0.02)
        stifle = polar(hip, p + rad(-64), 0.23)
        lift = lift_far_hind if side == "far" else 0.0
        foot = (hx + 0.03 * lift, FETLOCK_Z + 0.10 * lift)
        hock = two_bone(stifle, foot, 0.31, 0.30, -1)                           # the hock points back
        hoof = polar(foot, rad(-70 - 40 * lift), 0.055)
        out += [("limb", *hip, *stifle, 0.115, 0.058), ("limb", *stifle, *hock, 0.052, 0.027),
                ("limb", *hock, *foot, 0.026, 0.021), ("limb", *foot, *hoof, 0.022, 0.026)]

    # neck and head
    n0 = at(0.40, 0.08)
    n1 = polar(n0, rad(neck1), 0.23)
    n2 = polar(n1, rad(neck2), 0.23)
    out += [("limb", *n0, *n1, 0.100 * k, 0.072 * k), ("limb", *n1, *n2, 0.072 * k, 0.052 * k)]
    h = rad(head)
    out.append(("ell", *polar(n2, h, 0.04), 0.085, 0.062, h))                    # skull
    out.append(("limb", *polar(n2, h, 0.07), *polar(n2, h, 0.185), 0.045, 0.028))  # muzzle
    out.append(("ell", *polar(polar(n2, h, 0.09), h - rad(90), 0.028), 0.06, 0.028, h))  # jaw
    root = polar(polar(n2, h, -0.03), h + rad(90), 0.04)
    for e in ears:
        out.append(("ell", *polar(root, h + rad(e), 0.09), 0.095, 0.034, h + rad(e)))
    if buck:
        out += antlers(n2, h)

    t0 = at(-0.50, 0.09)
    out.append(("limb", *t0, *polar(t0, rad(tail), 0.19), 0.030, 0.020))
    return out


ANTLER = {  # head-local (along the muzzle, up from it), metres: a main beam and four tines
    "beam": [(-0.03, 0.06), (-0.10, 0.20), (-0.04, 0.33), (0.10, 0.40), (0.22, 0.36)],
    "tines": [[(-0.03, 0.07), (0.05, 0.19)], [(-0.09, 0.24), (-0.14, 0.44)], [(0.02, 0.37), (0.02, 0.54)],
              [(0.13, 0.40), (0.16, 0.51)]],
}


def antlers(p, h) -> list:
    out = []
    for dx, scale in ((0.0, 1.0), (0.035, 0.93)):       # the far antler shows just ahead of the near one

        def pt(q):
            return polar(polar(p, h, q[0] * scale + dx), h + rad(90), q[1] * scale)
        chains = [ANTLER["beam"], *ANTLER["tines"]]
        for chain in chains:
            for i, (a, b) in enumerate(zip(chain, chain[1:])):
                taper = 1 - 0.5 * (i + 1) / len(chain)
                out.append(("limb", *pt(a), *pt(b), 0.013 * taper + 0.003, 0.011 * taper))
    return out


DOE_SECONDS = 16


def doe(t: float) -> list:
    """Grazes, lifts her head to look, flicks ears and tail, stamps once, goes back to grazing."""
    up = track(t, [(0, 0, 0.0), (4.4, 4.62, -0.06), (4.62, 5.45, 1.0), (9.3, 9.55, 1.05), (9.55, 10.7, 0.0)], 0.06)
    nib = (1 - up) * math.sin(2 * math.pi * t / 0.5) if (t < 4.0 or 11.0 < t < 12.5 or t > 14.0) else 0.0
    stamp = flick(t, 12.6, 0.75)
    weight = track(t, [(0, 0, 0.0), (4.5, 5.6, -0.022), (8.4, 9.3, -0.006), (9.6, 10.8, 0.0)])
    ear_a = 52 - 40 * flick(t, 6.3, 0.33) - 28 * flick(t, 7.55, 0.3) + 22 * (1 - up)
    ear_b = 108 + 34 * flick(t, 6.45, 0.33) - 22 * (1 - up)
    tail = -104 + 150 * (flick(t, 8.0, 0.3) + 0.8 * flick(t, 8.34, 0.3))
    return deer_pose(
        shift=weight, drop=0.04 * (1 - up) + 0.01 * stamp, pitch=-13.0 * (1 - up) + 1.0 * up,
        neck1=-44 + 100 * up + 2.5 * nib, neck2=-58 + 126 * up + 3.5 * nib, head=-74 + 56 * up + 5 * nib,
        ears=(ear_a, ear_b), tail=tail, lift_near_fore=stamp)


BUCK_SECONDS = 18


def buck(t: float) -> list:
    """Stands alert, drops his head to scent the ground, raises it, stamps, tests the air."""
    low = track(t, [(0, 0, 0.0), (1.9, 2.1, -0.05), (2.1, 3.3, 1.0), (4.9, 5.1, 1.04), (5.1, 6.2, 0.0)], 0.05)
    air = track(t, [(0, 0, 0.0), (13.6, 14.5, 1.0), (15.6, 16.6, 0.0)], 0.04)
    stamp = flick(t, 9.4, 0.7)
    weight = track(t, [(0, 0, 0.0), (2.2, 3.2, 0.02), (5.2, 6.2, 0.0), (13.6, 14.4, -0.015), (15.8, 16.6, 0.0)])
    return deer_pose(
        buck=True, shift=weight, drop=0.02 * low + 0.01 * stamp, pitch=-8.0 * low + 1.5 * air,
        neck1=52 - 70 * low + 6 * air, neck2=66 - 100 * low + 6 * air, head=-20 - 44 * low + 26 * air,
        ears=(52 - 38 * flick(t, 7.3, 0.3), 108 + 30 * flick(t, 7.42, 0.3) - 24 * flick(t, 11.9, 0.3)),
        tail=-104 + 140 * (flick(t, 11.6, 0.3) + 0.7 * flick(t, 11.95, 0.3)), lift_near_fore=stamp)


# ================================================================ turkey
TURKEY_BODY_Z = 0.53
TURKEY_STRIDE = 0.36        # metres per walk cycle (two steps); the page moves the sprite exactly this far per cycle
TURKEY_WALK_SECONDS = 1.0


def turkey_pose(*, shift=0.0, drop=0.0, pitch=0.0, head=(0.26, 0.40), head_angle=-8.0, feet=((0.03, 0.0), (0.0, 0.0)),
                tail=0.0) -> list:
    """head: target of the head relative to the standing body centre. feet: (x, lift) per leg relative to the hip
    line. pitch: degrees, + raises the breast."""
    o = (shift, TURKEY_BODY_Z - drop)
    p = rad(pitch)

    def at(x, z):
        bx, bz = rot(x, z, p)
        return o[0] + bx, o[1] + bz

    out = []
    for x, z, rx, rz, a in ((0.0, 0.0, 0.24, 0.16, 6), (0.14, -0.04, 0.12, 0.15, 0), (-0.08, 0.04, 0.18, 0.11, 0)):
        out.append(("ell", *at(x, z), rx, rz, rad(a) + p))
    out.append(("limb", *at(-0.16, 0.02), *at(-0.53, -0.10 + tail), 0.070, 0.030))     # tail, folded and carried low
    for (fx, lift), side in zip(feet, (0, 1)):
        hip = at(0.02 - 0.03 * side, -0.09)
        foot = (shift * 0 + 0.02 + fx, 0.022 + lift)
        hock = two_bone(hip, foot, 0.21, 0.235, -1)
        toe = polar(foot, rad(-8 - 300 * lift), 0.085)
        out += [("limb", *hip, *hock, 0.042, 0.016), ("limb", *hock, *foot, 0.012, 0.010),
                ("limb", *foot, *toe, 0.012, 0.006), ("limb", *foot, *polar(foot, rad(190), 0.03), 0.010, 0.005)]
    base = at(0.21, 0.08)
    hp = (head[0], TURKEY_BODY_Z + head[1])
    mid = two_bone(base, hp, 0.20, 0.19, +1)                                           # the neck folds back: an S
    out += [("limb", *base, *mid, 0.042, 0.024), ("limb", *mid, *hp, 0.024, 0.018)]
    h = rad(head_angle)
    out.append(("ell", *polar(hp, h, 0.012), 0.038, 0.027, h))
    out.append(("limb", *polar(hp, h, 0.035), *polar(hp, h, 0.092), 0.015, 0.004))     # beak
    out.append(("ell", *polar(polar(hp, h, 0.02), h - rad(90), 0.034), 0.014, 0.026, h))  # wattle
    return out


def _step(u: float, stride: float, duty: float = 0.62):
    """Foot position relative to the hip over one cycle u in [0, 1): planted and sliding back, then lifted forward."""
    u %= 1.0
    half = stride * duty / 2
    if u < duty:
        return half - stride * u, 0.0
    v = (u - duty) / (1 - duty)
    return -half + 2 * half * ease(v), 0.075 * math.sin(math.pi * v) ** 1.3


def turkey_walk(t: float) -> list:
    """One walk cycle. The head does what a bird's head does: it stays put in the world while the body walks under
    it, then darts forward to the next hold."""
    u = (t / TURKEY_WALK_SECONDS) % 1.0
    w = (2 * u + 0.15) % 1.0                            # two head darts per cycle
    travel = TURKEY_STRIDE / 2 * 0.8                    # 80% stabilised: a full lock looks mechanical
    hold = 0.72
    hx = travel * (0.5 - w / hold) if w < hold else travel * (-0.5 + ease((w - hold) / (1 - hold)))
    return turkey_pose(
        drop=0.010 * (1 + math.cos(4 * math.pi * u)) / 2, pitch=1.6 * math.sin(4 * math.pi * u + 0.6),
        head=(0.28 + hx, 0.41 - 0.012 * abs(hx) / travel), head_angle=-6 + 5 * math.sin(4 * math.pi * u),
        feet=(_step(u, TURKEY_STRIDE), _step(u + 0.5, TURKEY_STRIDE)), tail=0.012 * math.sin(4 * math.pi * u + 1.0))


TURKEY_FEED_SECONDS = 8


def turkey_feed(t: float) -> list:
    """Three pecks of different depth, then head up to look round, a shuffle of the feet, and down again."""
    down = (0.95 * flick(t, 0.5, 0.75) + 1.0 * flick(t, 1.45, 0.7) + 0.8 * flick(t, 2.35, 0.6)
            + 0.9 * flick(t, 6.7, 0.7))
    alert = track(t, [(0, 0, 0.0), (3.1, 3.7, 1.0), (5.6, 6.3, 0.0)], 0.08)
    shuffle = flick(t, 4.6, 0.5)
    look = 0.02 * math.sin(2 * math.pi * (t - 3.7) / 1.6) if 3.7 < t < 5.6 else 0.0
    return turkey_pose(
        shift=0.012 * alert, drop=0.07 * down - 0.008 * alert, pitch=-40 * down + 5 * alert,
        head=(0.26 + 0.12 * down + look, 0.40 - 0.89 * down + 0.04 * alert), head_angle=-8 - 62 * down + 6 * alert,
        feet=((0.03, 0.0), (0.0 + 0.05 * ease(shuffle), 0.05 * math.sin(math.pi * shuffle) if shuffle else 0.0)),
        tail=0.03 * down)


# ================================================================ crow
CROW_SECONDS = 0.5


def crow(t: float) -> list:
    """One wingbeat, posed in 3D: the hand follows the arm a little late, and the body rises on the downstroke."""
    u = (t / CROW_SECONDS) % 1.0
    beat = math.sin(2 * math.pi * u)
    late = math.sin(2 * math.pi * u - 0.9)
    lift = -0.02 * math.cos(2 * math.pi * u)
    out = [("ell3", (0.0, 0.0, lift), (0.20, 0.055, 0.055), (0, 0, 0)),
           ("ell3", (0.17, 0.0, lift + 0.01), (0.07, 0.04, 0.04), (0, 0, 0)),
           ("ell3", (-0.22, 0.0, lift), (0.12, 0.05, 0.012), (0, 0, 0))]
    for s in (1, -1):
        a = rad(6 + 40 * beat)                          # arm above or below level
        b = a + rad(-12 + 36 * late)                    # hand, relative to the same level
        elbow = (0.02, s * 0.05, lift)
        wrist = (0.0, elbow[1] + s * 0.22 * math.cos(a), elbow[2] + 0.22 * math.sin(a))
        tip = (-0.06, wrist[1] + s * 0.34 * math.cos(b), wrist[2] + 0.34 * math.sin(b))
        for p0, p1, chord in ((elbow, wrist, 0.09), (wrist, tip, 0.055)):
            mid = tuple((p0[i] + p1[i]) / 2 for i in range(3))
            span = math.dist(p0, p1) / 2 + 0.03
            roll = math.atan2(p1[2] - p0[2], p1[1] - p0[1])
            out.append(("ell3", mid, (chord, span, 0.012), (roll, 0, 0)))
    return out


# ================================================================ clips
# box: the part of the side-view plane a frame shows (x0, z0, x1, z1 in metres). ground: z of the ground line.
CLIPS = {
    "doe": {"pose": doe, "seconds": DOE_SECONDS, "box": (-0.72, -0.04, 1.14, 1.56)},
    "buck": {"pose": buck, "seconds": BUCK_SECONDS, "box": (-0.72, -0.04, 1.24, 2.10)},
    "turkeyWalk": {"pose": turkey_walk, "seconds": TURKEY_WALK_SECONDS, "box": (-0.66, -0.03, 0.52, 1.07),
                   "stride": TURKEY_STRIDE},
    "turkeyFeed": {"pose": turkey_feed, "seconds": TURKEY_FEED_SECONDS, "box": (-0.66, -0.03, 0.52, 1.07)},
    "crow": {"pose": crow, "seconds": CROW_SECONDS, "box": (-0.72, -0.60, 0.72, 0.60), "camera": (24.0, -10.0)},
}


def frames(name: str) -> int:
    return round(CLIPS[name]["seconds"] * FPS)
