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
FPS_FAST = 24               # "on ones", for the birds: quick heads and wings need every frame to read smooth
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
    """A quick out-and-back, 0 -> 1 -> 0, quicker out than back, starting and ending at rest."""
    u = (t - at) / length
    if not 0.0 < u < 1.0:
        return 0.0
    return math.sin(math.pi * u ** 0.75) ** 2


def keys(t: float, points: list) -> float:
    """Value at t of (time, value) keyframes, eased from each to the next (zero speed at every key, so each move
    accelerates in and decelerates out). Holds the first value before the first key and the last after the last."""
    if t <= points[0][0]:
        return points[0][1]
    for (t0, v0), (t1, v1) in zip(points, points[1:]):
        if t < t1:
            return v0 + (v1 - v0) * ease((t - t0) / (t1 - t0))
    return points[-1][1]


def follow(signal, t: float, period: float, hz: float, damping: float = 0.7, history: float = 1.5):
    """Where a part dragged along by `signal` (a function of time, looping every `period` s; a number or a tuple)
    is at t: a spring and damper chasing the signal. It lags a little, overshoots a little when the signal stops
    and settles: the follow-through and overlap that keep a neck or a body from moving rigidly with the head.
    Lower hz lags more; damping under 1 overshoots. Simulated over the last `history` seconds, which is long enough
    for the start to be forgotten, so a looping signal gives a seamless loop."""
    w, dt = 2 * math.pi * hz, 1 / 600
    steps = round(history / dt)
    t0 = t - history
    x = list(_vec(signal(t0 % period)))
    v = [0.0] * len(x)
    for i in range(1, steps + 1):
        target = _vec(signal((t0 + i * dt) % period))
        for j, s_j in enumerate(target):
            v[j] += (w * w * (s_j - x[j]) - 2 * damping * w * v[j]) * dt
            x[j] += v[j] * dt
    return x[0] if len(x) == 1 else tuple(x)


def _vec(v):
    return v if isinstance(v, tuple) else (v,)


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
# Proportions follow adult white-tailed deer, as ratios of shoulder height H (about 0.96 m here); proportions.py
# measures the rendered silhouette against them:
#   chest depth (withers to brisket) about equal to leg length (brisket to ground), each about 0.5 H;
#   body length (point of shoulder to buttock) about 1.1 H; flank (waist) about 0.75 of chest depth;
#   rump level with or a little above the withers; head (poll to nose) about 0.3 H; ear about 0.6 of the head;
#   hock about 0.42 H off the ground, pointing back; cannons slender.
DEER_BODY_Z = 0.74
FETLOCK_Z = 0.058
FORE_X, HIND_X = 0.33, -0.47          # where the fetlocks stand
DEER_HEAD = {"skull": (0.04, 0.088, 0.064), "muzzle": (0.07, 0.205, 0.047, 0.029), "ear": 0.082}
DEER_TAIL = -116.0                    # resting tail, degrees: hanging down and a little out from the rump
DEER_EARS = (70.0, 125.0)             # resting ear angles, degrees from the line of the muzzle: up and a little apart
DEER_LANDMARKS = {"withers_x": 0.30, "girth_x": 0.12, "waist_x": -0.10, "rump_x": -0.40}   # body-local x (m)


def deer_head_length() -> float:
    """Poll (back of the skull) to the tip of the nose, metres."""
    sx, srx, _ = DEER_HEAD["skull"]
    return (DEER_HEAD["muzzle"][1] + DEER_HEAD["muzzle"][3]) - (sx - srx)


def deer_pose(*, buck=False, shift=0.0, drop=0.0, pitch=0.0, neck1=55.0, neck2=68.0, head=-18.0, ears=None,
              tail=DEER_TAIL, lift_near_fore=0.0, lift_far_hind=0.0) -> list:
    """shift: body forward (m) over planted feet. drop: body lower (m). pitch: degrees, + raises the front.
    neck1, neck2, head: degrees above horizontal of the lower neck, upper neck and head. ears, tail: same.
    lift_*: 0..1, how far that leg is picked up."""
    ears = ears or DEER_EARS
    k = 1.2 if buck else 1.0                            # a rutting buck's neck is much thicker
    o = (shift, DEER_BODY_Z - drop)
    p = rad(pitch)

    def at(x, z):                                       # body-local point to the picture plane
        bx, bz = rot(x, z, p)
        return o[0] + bx, o[1] + bz

    out = []

    def ell(x, z, rx, rz, a=0.0):
        cx, cz = at(x, z)
        out.append(("ell", cx, cz, rx, rz, a + p))

    ell(0.17, -0.02, 0.27, 0.24)                      # ribcage: deep, the brisket line well below the elbow
    ell(0.30, 0.02, 0.15, 0.20)                         # shoulder, up to the withers
    ell(-0.02, 0.155, 0.34, 0.06, rad(-2))              # back: one long line from withers to croup
    ell(-0.11, 0.04, 0.27, 0.175, rad(-6))             # barrel, tucked up towards the flank (the waist)
    ell(-0.37, 0.05, 0.19, 0.19, rad(-12))             # hindquarter (the ham), its top sloping down to the tail
    ell(-0.40, 0.165, 0.12, 0.11, rad(-14))            # croup: a round rump, a little above the withers
    ell(0.40, -0.02, 0.11, 0.13)                        # brisket, rising forward from the deepest point
    ell(0.38, 0.10, 0.145 * k, 0.15 * k)                # where the neck meets the chest: broad

    # legs: near pair, then far pair standing a little off so all four read
    for side, fx, hx in (("near", FORE_X, HIND_X), ("far", FORE_X - 0.12, HIND_X + 0.14)):
        elbow = at(0.27 if side == "near" else 0.24, -0.19)
        lift = lift_near_fore if side == "near" else 0.0
        foot = (fx + 0.05 * lift, FETLOCK_Z + 0.16 * lift)
        knee = two_bone(elbow, foot, 0.255, 0.25, +1)                            # the knee folds forward
        hoof = polar(foot, rad(-72 - 55 * lift), 0.05)
        out += [("limb", *elbow, *knee, 0.050, 0.024), ("limb", *knee, *foot, 0.019, 0.016),
                ("limb", *foot, *hoof, 0.018, 0.022)]
        hip = at(-0.35 if side == "near" else -0.32, 0.0)
        stifle = polar(hip, p + rad(-55), 0.16)
        lift = lift_far_hind if side == "far" else 0.0
        foot = (hx + 0.03 * lift, FETLOCK_Z + 0.10 * lift)
        hock = two_bone(stifle, foot, 0.29, 0.36, -1)                           # the hock points back, high
        hoof = polar(foot, rad(-70 - 40 * lift), 0.05)
        out += [("limb", *hip, *stifle, 0.12, 0.062), ("limb", *stifle, *hock, 0.050, 0.024),
                ("limb", *hock, *foot, 0.020, 0.016), ("limb", *foot, *hoof, 0.018, 0.022)]

    # neck and head
    n0 = at(0.40, 0.10)
    n1 = polar(n0, rad(neck1), 0.22)
    n2 = polar(n1, rad(neck2), 0.21)
    out += [("limb", *n0, *n1, 0.118 * k, 0.074 * k), ("limb", *n1, *n2, 0.074 * k, 0.054 * k)]
    h = rad(head)
    sx, srx, srz = DEER_HEAD["skull"]
    ma, mb, mra, mrb = DEER_HEAD["muzzle"]
    out.append(("ell", *polar(n2, h, sx), srx, srz, h))                           # skull
    out.append(("limb", *polar(n2, h, ma), *polar(n2, h, mb), mra, mrb))         # muzzle
    out.append(("ell", *polar(polar(n2, h, 0.09), h - rad(90), 0.03), 0.065, 0.03, h))  # jaw
    root = polar(polar(n2, h, -0.03), h + rad(90), 0.045)
    for e in ears:
        out.append(("ell", *polar(root, h + rad(e), DEER_HEAD["ear"]), DEER_HEAD["ear"], 0.036, h + rad(e)))
    if buck:
        out += antlers(n2, h)

    t0 = at(-0.50, 0.11)
    out.append(("limb", *t0, *polar(t0, rad(tail), 0.18), 0.032, 0.022))
    return out


# Head-local (x along the muzzle, z up from it), metres. A mature 8-pointer: the main beam leaves the skull back
# and up, sweeps forward over the face; the brow tine is short, G2 the longest; tines stand near vertical.
ANTLER = {
    "beam": [(-0.02, 0.06), (-0.07, 0.13), (-0.06, 0.21), (0.0, 0.27), (0.09, 0.30), (0.17, 0.27)],
    "tines": [[(-0.065, 0.12), (-0.035, 0.19)], [(-0.03, 0.255), (-0.05, 0.43)], [(0.06, 0.295), (0.06, 0.44)],
              [(0.13, 0.29), (0.15, 0.37)]],
}
# The far antler, seen past the near one: a mature buck's spread (about 0.45 m) shows as this offset in profile.
# Only its beam and longest tine (G2) are drawn: the rest hide behind the near antler, and in a small
# silhouette extra tines only merge into a blob.
FAR_ANTLER = (0.05, 0.02, 0.92)          # along the muzzle, up, scale


def antlers(p, h) -> list:
    out = []
    near = (ANTLER["beam"], *ANTLER["tines"])
    far = (ANTLER["beam"], ANTLER["tines"][1])
    for (dx, dz, scale), chains in (((0.0, 0.0, 1.0), near), (FAR_ANTLER, far)):

        def pt(q):
            return polar(polar(p, h, q[0] * scale + dx), h + rad(90), q[1] * scale + dz)
        for chain in chains:
            for i, (a, b) in enumerate(zip(chain, chain[1:])):
                taper = 1 - 0.55 * (i + 1) / len(chain)
                out.append(("limb", *pt(a), *pt(b), 0.019 * taper + 0.004, 0.015 * taper + 0.003))
    return out


DOE_SECONDS = 16


def doe(t: float) -> list:
    """Grazes, lifts her head to look, flicks ears and tail, stamps once, goes back to grazing."""
    up = track(t, [(0, 0, 0.0), (4.4, 4.62, -0.06), (4.62, 5.45, 1.0), (9.3, 9.55, 1.05), (9.55, 10.7, 0.0)], 0.06)
    nib = (1 - up) * math.sin(2 * math.pi * t / 0.5) if (t < 4.0 or 11.0 < t < 12.5 or t > 14.0) else 0.0
    stamp = flick(t, 12.6, 0.75)
    weight = track(t, [(0, 0, 0.0), (4.5, 5.6, -0.022), (8.4, 9.3, -0.006), (9.6, 10.8, 0.0)])
    ear_a = DEER_EARS[0] - 40 * flick(t, 6.3, 0.33) - 28 * flick(t, 7.55, 0.3) + 22 * (1 - up)
    ear_b = DEER_EARS[1] + 34 * flick(t, 6.45, 0.33) - 22 * (1 - up)
    tail = DEER_TAIL + 150 * (flick(t, 8.0, 0.3) + 0.8 * flick(t, 8.34, 0.3))
    return deer_pose(
        shift=weight, drop=0.005 * (1 - up) + 0.01 * stamp, pitch=-5.0 * (1 - up) + 1.0 * up,
        neck1=-56 + 112 * up + 2.5 * nib, neck2=-66 + 134 * up + 3.5 * nib, head=-74 + 56 * up + 5 * nib,
        ears=(ear_a, ear_b), tail=tail, lift_near_fore=stamp)


BUCK_SECONDS = 18


def buck(t: float) -> list:
    """Stands alert, drops his head to scent the ground, raises it, stamps, tests the air."""
    low = track(t, [(0, 0, 0.0), (1.9, 2.1, -0.05), (2.1, 3.3, 1.0), (4.9, 5.1, 1.04), (5.1, 6.2, 0.0)], 0.05)
    air = track(t, [(0, 0, 0.0), (13.6, 14.5, 1.0), (15.6, 16.6, 0.0)], 0.04)
    stamp = flick(t, 9.4, 0.7)
    weight = track(t, [(0, 0, 0.0), (2.2, 3.2, 0.02), (5.2, 6.2, 0.0), (13.6, 14.4, -0.015), (15.8, 16.6, 0.0)])
    return deer_pose(
        buck=True, shift=weight, drop=0.012 * low + 0.01 * stamp, pitch=-4.5 * low + 1.5 * air,
        neck1=52 - 70 * low + 6 * air, neck2=66 - 100 * low + 6 * air, head=-20 - 44 * low + 26 * air,
        ears=(DEER_EARS[0] - 38 * flick(t, 7.3, 0.3), DEER_EARS[1] + 30 * flick(t, 7.42, 0.3) - 24 * flick(t, 11.9, 0.3)),
        tail=DEER_TAIL + 140 * (flick(t, 11.6, 0.3) + 0.7 * flick(t, 11.95, 0.3)), lift_near_fore=stamp)


# ================================================================ turkey
TURKEY_BODY_Z = 0.53
TURKEY_STRIDE = 0.36        # metres per walk cycle (two steps); the page moves the sprite exactly this far per cycle
TURKEY_WALK_SECONDS = 1.0


def turkey_pose(*, shift=0.0, drop=0.0, pitch=0.0, head=(0.26, 0.40), head_angle=-8.0, feet=((0.03, 0.0), (0.0, 0.0)),
                tail=0.0, neck=None) -> list:
    """head: target of the head relative to the standing body centre. feet: (x, lift) per leg relative to the hip
    line. pitch: degrees, + raises the breast. neck: where the neck's bend aims (a lagging copy of head, so the
    neck trails the head a little); None aims it at the head."""
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
        foot = (0.02 + fx, 0.022 + lift)
        hock = two_bone(hip, foot, 0.21, 0.235, -1)
        toe = polar(foot, rad(-8 - 300 * lift), 0.085)
        out += [("limb", *hip, *hock, 0.042, 0.016), ("limb", *hock, *foot, 0.012, 0.010),
                ("limb", *foot, *toe, 0.012, 0.006), ("limb", *foot, *polar(foot, rad(190), 0.03), 0.010, 0.005)]
    base = at(0.21, 0.08)
    hp = (head[0], TURKEY_BODY_Z + head[1])
    aim = hp if neck is None else (neck[0], TURKEY_BODY_Z + neck[1])
    mid = two_bone(base, aim, 0.20, 0.19, +1)                                          # the neck folds back: an S
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


# The head-bob of a walking bird, per half cycle (one step): the head holds still in the world while the body walks
# under it, then thrusts forward to the next hold. Its speed in the world, as a share of the body's, is HOLD during
# the hold and rises and falls on a smooth bell during the thrust, so it never starts or stops in a single frame.
HEAD_HOLD = 0.2             # 80% stabilised during the hold: a full lock looks mechanical
HEAD_THRUST = 0.46          # share of the step spent thrusting (0.23 s): quick, but six frames at 24 fps
HEAD_THRUST_AT = 0.42       # where in the step the thrust starts (the foot that is down is about to lift)


def _head_travel(w: float) -> float:
    """How far (in strides of half a cycle) the head has moved in the world by w in [0, 1) of a step."""
    d = HEAD_THRUST
    u = min(max(w - HEAD_THRUST_AT, 0.0), d)
    bell = (1 - HEAD_HOLD) / d * (u - d / (2 * math.pi) * math.sin(2 * math.pi * u / d))
    return HEAD_HOLD * w + bell


_HEAD_MEAN = sum(_head_travel(i / 200) - i / 200 for i in range(200)) / 200


def _walk_head(t: float) -> tuple:
    """Target of the walking head relative to the body: (forward, up)."""
    w = (2 * t / TURKEY_WALK_SECONDS) % 1.0
    half = TURKEY_STRIDE / 2
    hx = half * (_head_travel(w) - w - _HEAD_MEAN)
    return 0.28 + hx, 0.41 - 0.10 * abs(hx)


def turkey_walk(t: float) -> list:
    """One walk cycle. The head does what a bird's head does: it stays put in the world while the body walks under
    it, then thrusts forward to the next hold. The head itself follows its target on a stiff spring (it overshoots a
    touch at the end of each thrust and settles), the neck's bend trails the head, and the head nods into the thrust
    and lifts out of it."""
    period = TURKEY_WALK_SECONDS
    u = (t / period) % 1.0
    head = follow(_walk_head, t, period, hz=7.0, damping=0.6)
    neck = follow(_walk_head, t, period, hz=4.0, damping=0.8)
    nod = 160 * (head[0] - neck[0])                     # degrees: beak dips while the head leads the neck
    return turkey_pose(
        drop=0.010 * (1 + math.cos(4 * math.pi * u)) / 2, pitch=1.6 * math.sin(4 * math.pi * u + 0.6),
        head=head, neck=neck, head_angle=-6 - nod + 3 * math.sin(4 * math.pi * u),
        feet=(_step(u, TURKEY_STRIDE), _step(u + 0.5, TURKEY_STRIDE)), tail=0.012 * math.sin(4 * math.pi * u + 1.0))


TURKEY_FEED_SECONDS = 8
FEEDING = 0.65              # head height while feeding between pecks: 0 is head up, 1 is beak on the ground


def _peck(at: float, depth: float = 1.0) -> list:
    """Keys of one peck from the feeding posture: a small draw back, the strike, a moment at the ground, back up."""
    return [(at, FEEDING), (at + 0.13, FEEDING - 0.07), (at + 0.38, depth), (at + 0.47, depth - 0.04),
            (at + 0.84, FEEDING)]


# 0 = head up and alert, FEEDING = head low over the ground, 1 = beak on the ground. Starts and ends at FEEDING.
_FEED_KEYS = [(0.0, FEEDING), *_peck(0.30, 0.97), *_peck(1.30, 1.0), *_peck(2.20, 0.9),
              (3.05, FEEDING), (3.15, FEEDING + 0.05), (3.85, -0.03), (4.2, 0.0),     # dips, then up to look round
              (5.55, 0.0), (6.30, FEEDING), *_peck(6.65, 1.0), (8.0, FEEDING)]


def _feed_down(t: float) -> float:
    return keys(t, _FEED_KEYS)


def _feed_head(t: float) -> tuple:
    d = _feed_down(t)
    look = 0.02 * math.sin(2 * math.pi * (t - 4.0) / 1.6) * keys(t, [(3.9, 0.0), (4.3, 1.0), (5.2, 1.0), (5.6, 0.0)])
    return 0.26 + 0.12 * d + look, 0.44 - 0.93 * d


def turkey_feed(t: float) -> list:
    """Feeds with the head low, pecking three times, comes up to look round, shuffles a foot, lowers again and
    pecks. The head leads every move; the neck's bend, the head's tilt and the body's pitch follow it on springs,
    so they arrive a moment later and settle."""
    period = TURKEY_FEED_SECONDS
    head = _feed_head(t)
    neck = follow(_feed_head, t, period, hz=4.5, damping=0.75)
    body = follow(_feed_down, t, period, hz=2.0, damping=0.85)          # the body tips forward after the head
    tilt = follow(_feed_down, t, period, hz=5.5, damping=0.55)          # the head turns down a moment late
    shuffle = keys(t, [(4.55, 0.0), (5.05, 1.0)])
    lift = 0.05 * math.sin(math.pi * shuffle) if 0.0 < shuffle < 1.0 else 0.0
    return turkey_pose(
        shift=0.012 * (1 - body / FEEDING) if body < FEEDING else 0.0, drop=0.07 * body - 0.01,
        pitch=-30 * body + 4, head=head, neck=neck, head_angle=-2 - 66 * tilt,
        feet=((0.03, 0.0), (0.05 * shuffle, lift)), tail=0.03 * body)


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
# fps: the deer are drawn on twos; the birds on ones (FPS_FAST), because a bird's head and wings move quickly.
CLIPS = {
    "doe": {"pose": doe, "seconds": DOE_SECONDS, "box": (-0.72, -0.04, 1.14, 1.56)},
    "buck": {"pose": buck, "seconds": BUCK_SECONDS, "box": (-0.72, -0.04, 1.24, 2.10)},
    "turkeyWalk": {"pose": turkey_walk, "seconds": TURKEY_WALK_SECONDS, "box": (-0.66, -0.03, 0.52, 1.07),
                   "stride": TURKEY_STRIDE, "fps": FPS_FAST},
    "turkeyFeed": {"pose": turkey_feed, "seconds": TURKEY_FEED_SECONDS, "box": (-0.66, -0.03, 0.52, 1.07),
                   "fps": FPS_FAST, "twos": 0.04},
    "crow": {"pose": crow, "seconds": CROW_SECONDS, "box": (-0.72, -0.60, 0.72, 0.60), "camera": (24.0, -10.0),
             "fps": FPS_FAST},
}


def fps(name: str) -> int:
    return CLIPS[name].get("fps", FPS)


def frames(name: str) -> int:
    return round(CLIPS[name]["seconds"] * fps(name))


def _points(pose: list) -> list:
    pts = []
    for prim in pose:
        if prim[0] == "ell":
            pts.append(prim[1:3])
        elif prim[0] == "limb":
            pts += [prim[1:3], prim[3:5]]
        else:
            pts.append(prim[1][::2])
    return pts


def frame_pose(name: str, f: int) -> list:
    """The pose of frame f. A clip with "twos" is drawn on ones, but where it moves slowly (no point travels
    "twos" metres over two frames) its odd frames repeat the even ones, as hand animators mix ones and twos:
    quick moves keep every frame, slow ones cost half the bytes and look the same."""
    clip, rate = CLIPS[name], fps(name)
    pose = clip["pose"](f / rate)
    if "twos" not in clip or f % 2 == 0:
        return pose
    before, after = clip["pose"]((f - 1) / rate), clip["pose"]((f + 1) / rate)
    travel = max(math.dist(p, q) for p, q in zip(_points(before), _points(after)))
    return before if travel < clip["twos"] else pose
