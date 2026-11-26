"""Hunt Club Mesh background loop: builds the dawn hardwood scene in Blender (headless bpy, Cycles, CPU) and renders it.

    $BPY design/background/scene.py fetch                       # download + verify the CC0 assets (once)
    $BPY design/background/scene.py render --quality draft      # all frames -> $HCM_BG_WORK/<quality>/f_0000.png ...
    $BPY design/background/scene.py render --quality draft --frames 120        # one frame
    $BPY design/background/scene.py render --quality draft --frames 0-239 --step 2

$BPY is a Python with the `bpy` wheel (about 1 GB, so it lives in a scratch venv, never in the repo):
    python3.13 -m venv $SCRATCH/bpyenv && $SCRATCH/bpyenv/bin/pip install bpy     # bpy 5.3.0 tested 2026-11-26

How the shot works (docs/BACKGROUND_LOOP.md has the full design):
- The camera never moves and stands where the HDRI photographer stood, so the photographed forest is a correct
  backdrop and anything placed on the ground plane lands on the photographed ground.
- The light is the same HDRI, so the animals and the fog are lit by the real sky and sun of the photograph.
- Every motion is periodic over the loop, or enters and leaves out of frame inside it. Walking turkeys use a
  conveyor: N copies of one long walk, spaced one loop apart, so the last frame hands each bird to the next one.

The animals, birds, leaves and mist are built here from primitives (self-made, no third-party models).
The scene setup follows the owner's hunting-appeal renderer (huntkit/viz3d: Cycles settings, HDRI world, asset
manifest with SHA-256); the code here is written for this scene, nothing is imported from that repo.
"""
from __future__ import annotations

import argparse
import hashlib
import math
import subprocess
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import config as C  # noqa: E402

T = float(C.LOOP_SECONDS)
TAU = 2 * math.pi
rad = math.radians

# ---------------------------------------------------------------- shot constants (metres, camera at x=0, y=0)
CAM_HEIGHT = 1.5           # ASSUMPTION: the HDRI tripod height (Poly Haven shoots at about eye level)
CAM_PITCH_DEG = 5.0        # tilt up: horizon sits about 40% up the frame, animals stay in the lower part
LENS_MM = 35.0             # 54 degrees wide on a 36 mm sensor
HDRI_YAW_DEG = 258.0       # turns the photograph so the low sun stands just outside the right edge of frame
EXPOSURE = -0.6
DOE_AT = (3.2, 21.0)       # right of centre: desktop text sits left, the mobile crop is taken here
BUCK_AT = (-1.5, 31.0)
TURKEY_COPIES = 4          # conveyor: one 4-loop walk shown as 4 birds
TURKEY_SPEED = 0.6         # m/s when walking
TURKEY_STOPS = ((7.0, 9.5), (18.0, 21.0), (30.0, 32.5))   # master-time windows where a bird stops and pecks
TURKEY_PATH_Y = 15.0


# ================================================================ assets
def _sha256(p: Path) -> str:
    h = hashlib.sha256()
    with open(p, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def asset_path(asset_id: str) -> Path:
    a = {a["id"]: a for a in C.manifest()}[asset_id]
    return C.asset_dir() / a["dir"] / a["file"]


def fetch_assets() -> list:
    """Download every manifest asset into the cache and verify its SHA-256. Downloads are data, never executed."""
    got = []
    for a in C.manifest():
        f = C.asset_dir() / a["dir"] / a["file"]
        f.parent.mkdir(parents=True, exist_ok=True)
        if not f.exists() or _sha256(f) != a["sha256"]:
            subprocess.run(["curl", "-sS", "-L", "--fail", "-m", "1800", "-A", "asset-fetch", "-o", str(f), a["url"]],
                           check=True)
        sha = _sha256(f)
        if sha != a["sha256"]:
            raise RuntimeError(f"{a['id']}: sha256 {sha} != manifest {a['sha256']}")
        got.append(str(f))
    return got


# ================================================================ small helpers
def smooth(a: float, b: float, x: float) -> float:
    u = min(1.0, max(0.0, (x - a) / (b - a)))
    return u * u * (3 - 2 * u)


def pulse(x: float, centre: float, width: float) -> float:
    return math.exp(-((x - centre) / width) ** 2)


def lerp(a, b, u):
    return a + (b - a) * u


def _bpy():
    import bpy  # noqa: PLC0415
    return bpy


def _link(ob):
    _bpy().context.scene.collection.objects.link(ob)
    return ob


_MESH = {}


def _sphere_mesh():
    import bmesh  # noqa: PLC0415
    if "sphere" not in _MESH:
        me = _bpy().data.meshes.new("unit_sphere")
        bm = bmesh.new()
        bmesh.ops.create_uvsphere(bm, u_segments=24, v_segments=12, radius=1.0)
        bm.to_mesh(me)
        bm.free()
        me.polygons.foreach_set("use_smooth", [True] * len(me.polygons))
        me.materials.append(None)                       # one slot; each object fills it (see Rig.ell)
        _MESH["sphere"] = me
    return _MESH["sphere"]


def _frustum_mesh(length, r1, r2):
    """Tapered limb along +Z from the origin, with rounded ends left to the neighbouring ellipsoids."""
    import bmesh  # noqa: PLC0415
    from mathutils import Matrix  # noqa: PLC0415
    me = _bpy().data.meshes.new("limb")
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=16, radius1=r1, radius2=r2, depth=length,
                          matrix=Matrix.Translation((0, 0, length / 2)))
    bm.to_mesh(me)
    bm.free()
    me.polygons.foreach_set("use_smooth", [len(p.vertices) == 4 for p in me.polygons])
    return me


class Rig:
    """A jointed figure made of ellipsoids and tapered limbs. Joints are empties; a pose is their rotations."""

    def __init__(self, name):
        self.name = name
        self.j = {}
        self.root = self.joint("root", None, (0, 0, 0))

    def joint(self, key, parent, loc):
        ob = _link(_bpy().data.objects.new(f"{self.name}_{key}", None))
        ob.parent = parent
        ob.location = loc
        self.j[key] = ob
        return ob

    def ell(self, parent, radii, loc, mat, rot=(0, 0, 0)):
        ob = _link(_bpy().data.objects.new(f"{self.name}_ell", _sphere_mesh()))
        ob.parent, ob.location, ob.scale, ob.rotation_euler = parent, loc, radii, rot
        ob.material_slots[0].link = "OBJECT"            # shared mesh, so the material goes on the object's slot
        ob.material_slots[0].material = mat
        return ob

    def seg(self, key, parent, loc, length, r1, r2, axis, mat):
        """A limb hanging from a new joint at `loc`. axis '+X' (necks) or '-Z' (legs). Returns (joint, end point)."""
        j = self.joint(key, parent, loc)
        ob = _link(_bpy().data.objects.new(f"{self.name}_{key}_m", _frustum_mesh(length, r1, r2)))
        ob.parent = j
        ob.rotation_euler = (0, rad(90), 0) if axis == "+X" else (rad(180), 0, 0)
        ob.data.materials.append(mat)
        return j, ((length, 0, 0) if axis == "+X" else (0, 0, -length))


# ================================================================ materials
def _nodes(owner):
    try:
        owner.use_nodes = True
    except Exception:  # noqa: BLE001  (newer Blender: always node based)
        pass
    nt = owner.node_tree
    nt.nodes.clear()
    return nt


def _math(nt, op, a, b=None, clamp=False):
    n = nt.nodes.new("ShaderNodeMath")
    n.operation, n.use_clamp = op, clamp
    for i, v in enumerate((a, b)):
        if v is None:
            continue
        if isinstance(v, (int, float)):
            n.inputs[i].default_value = v
        else:
            nt.links.new(v, n.inputs[i])
    return n.outputs[0]


def matte(name, colour, rough=0.9, bump=0.0, bump_scale=60.0):
    """Short-coat or feather stand-in: a rough dark surface with a little noise so it does not read as plastic."""
    bpy = _bpy()
    m = bpy.data.materials.new(name)
    nt = _nodes(m)
    b = nt.nodes.new("ShaderNodeBsdfPrincipled")
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    b.inputs["Base Color"].default_value = (*colour, 1)
    b.inputs["Roughness"].default_value = rough
    nt.links.new(b.outputs[0], out.inputs["Surface"])
    if bump:
        tc = nt.nodes.new("ShaderNodeTexCoord")
        nz = nt.nodes.new("ShaderNodeTexNoise")
        nz.inputs["Scale"].default_value = bump_scale
        nz.inputs["Detail"].default_value = 5.0
        bp = nt.nodes.new("ShaderNodeBump")
        bp.inputs["Strength"].default_value = bump
        nt.links.new(tc.outputs["Object"], nz.inputs["Vector"])
        nt.links.new(nz.outputs[0], bp.inputs["Height"])
        nt.links.new(bp.outputs[0], b.inputs["Normal"])
    return m


def mist_material(name, colour, strength, base, amount, scale):
    """Ground mist card: emission through transparency. Alpha = (base + noise) x fade with height x soft side edges.
    Returns (material, mapping node); animating the mapping location round a circle makes the drift loop."""
    bpy = _bpy()
    m = bpy.data.materials.new(name)
    nt = _nodes(m)
    tc = nt.nodes.new("ShaderNodeTexCoord")
    mp = nt.nodes.new("ShaderNodeMapping")
    nz = nt.nodes.new("ShaderNodeTexNoise")
    nz.inputs["Scale"].default_value = scale
    nz.inputs["Detail"].default_value = 3.0
    nz.inputs["Roughness"].default_value = 0.45
    nt.links.new(tc.outputs["Object"], mp.inputs["Vector"])
    nt.links.new(mp.outputs[0], nz.inputs["Vector"])
    uv = nt.nodes.new("ShaderNodeSeparateXYZ")
    nt.links.new(tc.outputs["UV"], uv.inputs[0])
    u, v = uv.outputs[0], uv.outputs[1]
    cloud = _math(nt, "ADD", base, _math(nt, "MULTIPLY", amount, _math(nt, "SUBTRACT", nz.outputs[0], 0.35)), True)
    lo = nt.nodes.new("ShaderNodeTexNoise")                                # slow billows: the top edge is ragged
    lo.inputs["Scale"].default_value = scale * 0.3
    lo.inputs["Detail"].default_value = 1.0
    nt.links.new(mp.outputs[0], lo.inputs["Vector"])
    reach = _math(nt, "ADD", 0.25, _math(nt, "MULTIPLY", 1.3, lo.outputs[0]))
    fall = _math(nt, "POWER", _math(nt, "SUBTRACT", 1.0, _math(nt, "DIVIDE", v, reach), True), 1.8)
    foot = _math(nt, "MULTIPLY", v, 5.0, True)                 # thins out again at the ground: no hard line there
    side = _math(nt, "MULTIPLY", _math(nt, "MULTIPLY", u, _math(nt, "SUBTRACT", 1.0, u)), 16.0, True)
    alpha = _math(nt, "MULTIPLY", _math(nt, "MULTIPLY", cloud, fall), _math(nt, "MULTIPLY", foot, side), True)
    em = nt.nodes.new("ShaderNodeEmission")
    em.inputs["Color"].default_value = (*colour, 1)
    em.inputs["Strength"].default_value = strength
    tr = nt.nodes.new("ShaderNodeBsdfTransparent")
    mix = nt.nodes.new("ShaderNodeMixShader")
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    nt.links.new(alpha, mix.inputs[0])
    nt.links.new(tr.outputs[0], mix.inputs[1])
    nt.links.new(em.outputs[0], mix.inputs[2])
    nt.links.new(mix.outputs[0], out.inputs["Surface"])
    return m, mp


# ================================================================ scene
def setup_scene(quality: str, threads: int, yaw: float = HDRI_YAW_DEG):
    bpy = _bpy()
    bpy.ops.wm.read_factory_settings(use_empty=True)
    w, h, samples = C.QUALITY[quality]
    sc = bpy.context.scene
    sc.render.engine = "CYCLES"
    cy = sc.cycles
    cy.device = "CPU"
    cy.samples = samples
    cy.use_adaptive_sampling = True
    cy.adaptive_threshold = 0.03
    cy.use_denoising = True
    try:
        cy.denoiser = "OPENIMAGEDENOISE"
    except Exception:  # noqa: BLE001
        cy.use_denoising = False
    cy.max_bounces, cy.diffuse_bounces, cy.glossy_bounces = 6, 2, 2
    cy.volume_bounces = 0                               # single scattering is enough for thin fog
    cy.transparent_max_bounces = 12                     # mist cards and leaves stack up
    cy.caustics_reflective = cy.caustics_refractive = False
    sc.render.threads_mode = "FIXED"
    sc.render.threads = threads
    sc.render.use_persistent_data = True                # keep the 8k HDRI loaded between frames
    sc.render.resolution_x, sc.render.resolution_y, sc.render.resolution_percentage = w, h, 100
    sc.render.film_transparent = False
    sc.render.image_settings.file_format = "PNG"
    sc.render.image_settings.color_mode = "RGB"
    sc.view_settings.view_transform = "AgX"
    sc.view_settings.look = "None"
    sc.view_settings.exposure = EXPOSURE

    # world: the photograph is both backdrop and light
    wd = bpy.data.worlds.new("forest")
    sc.world = wd
    nt = _nodes(wd)
    tc, mp = nt.nodes.new("ShaderNodeTexCoord"), nt.nodes.new("ShaderNodeMapping")
    env = nt.nodes.new("ShaderNodeTexEnvironment")
    env.image = bpy.data.images.load(str(asset_path("ph_hdri")), check_existing=True)
    bg, out = nt.nodes.new("ShaderNodeBackground"), nt.nodes.new("ShaderNodeOutputWorld")
    mp.inputs["Rotation"].default_value = (0, 0, rad(yaw))
    nt.links.new(tc.outputs["Generated"], mp.inputs["Vector"])
    nt.links.new(mp.outputs[0], env.inputs["Vector"])
    nt.links.new(env.outputs[0], bg.inputs["Color"])
    nt.links.new(bg.outputs[0], out.inputs["Surface"])

    cam = bpy.data.cameras.new("cam")
    cam.lens, cam.sensor_width = LENS_MM, 36.0
    cam.dof.use_dof, cam.dof.focus_distance, cam.dof.aperture_fstop = True, DOE_AT[1], 1.4
    cam.clip_end = 500
    co = _link(bpy.data.objects.new("cam", cam))
    co.location = (0, 0, CAM_HEIGHT)
    co.rotation_euler = (rad(90 + CAM_PITCH_DEG), 0, 0)   # looks along +Y
    sc.camera = co

    return sc


# ---------------------------------------------------------------- contact shadows
SHADOW_OFFSET = (-0.25, -0.75)     # the low sun is behind and to the right, so shadows fall towards the camera


def build_shadow(name, length):
    """A soft dark patch on the photographed ground under an animal. (A Cycles shadow catcher would be the exact
    answer, but it drops most of the fog in front of the ground, which leaves a hard line at the horizon.)"""
    bpy = _bpy()
    if "shadow" not in _MESH:
        me = bpy.data.meshes.new("shadow")
        me.from_pydata([(-1, -1, 0), (1, -1, 0), (1, 1, 0), (-1, 1, 0)], [], [(0, 1, 2, 3)])
        m = bpy.data.materials.new("shadow")
        nt = _nodes(m)
        tc, ln = nt.nodes.new("ShaderNodeTexCoord"), nt.nodes.new("ShaderNodeVectorMath")
        ln.operation = "LENGTH"
        nt.links.new(tc.outputs["Object"], ln.inputs[0])
        a = _math(nt, "MULTIPLY", 0.6, _math(nt, "POWER", _math(nt, "SUBTRACT", 1.0, ln.outputs["Value"], True), 1.5))
        tr, df = nt.nodes.new("ShaderNodeBsdfTransparent"), nt.nodes.new("ShaderNodeBsdfDiffuse")
        df.inputs["Color"].default_value = (0.004, 0.004, 0.005, 1)
        mix, out = nt.nodes.new("ShaderNodeMixShader"), nt.nodes.new("ShaderNodeOutputMaterial")
        nt.links.new(a, mix.inputs[0])
        nt.links.new(tr.outputs[0], mix.inputs[1])
        nt.links.new(df.outputs[0], mix.inputs[2])
        nt.links.new(mix.outputs[0], out.inputs["Surface"])
        me.materials.append(m)
        _MESH["shadow"] = me
    ob = _link(bpy.data.objects.new(f"{name}_shadow", _MESH["shadow"]))
    ob.scale = (0.55 * length, 1.1 * length, 1)
    ob.rotation_euler = (0, 0, math.atan2(-SHADOW_OFFSET[0], SHADOW_OFFSET[1]) + math.pi)
    return ob


def place_shadow(ob, x, y, length):
    ob.location = (x + SHADOW_OFFSET[0] * length, y + SHADOW_OFFSET[1] * length, 0.02)


# ---------------------------------------------------------------- deer
def build_deer(name, mats, buck=False):
    R = Rig(name)
    fur, pale, dark = mats["deer"], mats["deer_pale"], mats["dark"]
    k = 1.25 if buck else 1.0                           # a buck's neck is much thicker in the rut
    body = R.joint("body", R.root, (0, 0, 0.90))
    R.ell(body, (0.50, 0.19, 0.22), (0, 0, 0), fur)
    R.ell(body, (0.27, 0.18, 0.25), (0.28, 0, -0.03), fur)
    R.ell(body, (0.28, 0.19, 0.24), (-0.30, 0, 0.02), fur)
    R.ell(body, (0.30, 0.15, 0.10), (-0.05, 0, -0.16), pale)                      # belly line
    neck, end = R.seg("neck", body, (0.40, 0, 0.10), 0.58, 0.14 * k, 0.07 * k, "+X", fur)
    R.ell(neck, (0.16, 0.13 * k, 0.15 * k), (0.03, 0, -0.01), fur)                # blends neck into chest
    head = R.joint("head", neck, end)
    R.ell(head, (0.13, 0.068, 0.078), (0.08, 0, 0), fur)
    R.ell(head, (0.10, 0.042, 0.046), (0.20, 0, -0.018), fur)
    R.ell(head, (0.022, 0.03, 0.026), (0.295, 0, -0.02), dark)                    # nose
    for s, side in ((1, "l"), (-1, "r")):
        ear = R.joint(f"ear_{side}", head, (-0.01, s * 0.05, 0.055))
        R.ell(ear, (0.016, 0.042, 0.088), (0, s * 0.045, 0.07), fur, rot=(rad(-38 * s), 0, 0))
        fu, e = R.seg(f"fu_{side}", body, (0.30, s * 0.10, -0.10), 0.40, 0.065, 0.036, "-Z", fur)
        fl, e2 = R.seg(f"fl_{side}", fu, e, 0.40, 0.033, 0.023, "-Z", fur)
        R.ell(fl, (0.035, 0.024, 0.03), (0.008, 0, e2[2] + 0.02), dark)
        hu, e = R.seg(f"hu_{side}", body, (-0.36, s * 0.10, -0.065), 0.42, 0.10, 0.044, "-Z", fur)
        hu.rotation_euler = (0, rad(25), 0)
        hl, e2 = R.seg(f"hl_{side}", hu, e, 0.46, 0.04, 0.023, "-Z", fur)
        hl.rotation_euler = (0, rad(-35), 0)
        R.ell(hl, (0.035, 0.024, 0.03), (0.008, 0, e2[2] + 0.02), dark)
        if buck:
            _antler(R, head, s, mats["antler"])
    tail = R.joint("tail", body, (-0.52, 0, 0.12))
    R.ell(tail, (0.026, 0.046, 0.11), (-0.03, 0, -0.09), fur)
    R.ell(tail, (0.02, 0.052, 0.105), (-0.046, 0, -0.095), mats["white"])         # the flag shows when it flicks
    if buck:
        R.root.scale = (1.12, 1.12, 1.12)
    return R


def _antler(R, head, s, mat):
    bpy = _bpy()
    beam = [(-0.02, 0.05, 0.07), (-0.07, 0.13, 0.21), (0.0, 0.23, 0.34), (0.13, 0.22, 0.42), (0.25, 0.15, 0.41)]
    tines = [[(-0.02, 0.055, 0.09), (0.05, 0.05, 0.21)], [(-0.035, 0.18, 0.28), (-0.06, 0.19, 0.50)],
             [(0.07, 0.23, 0.39), (0.08, 0.25, 0.55)], [(0.19, 0.19, 0.42), (0.21, 0.19, 0.52)]]
    cu = bpy.data.curves.new("antler", "CURVE")
    cu.dimensions, cu.bevel_depth, cu.bevel_resolution = "3D", 0.011, 2
    for pts in [beam, *tines]:
        sp = cu.splines.new("NURBS" if len(pts) > 2 else "POLY")
        sp.points.add(len(pts) - 1)
        for p, (x, y, z) in zip(sp.points, pts):
            p.co = (x, s * y, z, 1)
        sp.use_endpoint_u = True
    ob = _link(bpy.data.objects.new(f"{R.name}_antler", cu))
    ob.parent = head
    ob.data.materials.append(mat)


def pose_deer(R, neck, head, yaw=0.0, ears=(0.0, 0.0), tail_up=0.0, tail_wag=0.0, lean=0.0):
    """Angles in degrees. neck: above horizontal. head: relative to the neck (negative = nose down)."""
    R.j["body"].rotation_euler = (0, rad(lean), 0)
    R.j["neck"].rotation_euler = (0, rad(-(neck + lean)), 0)
    R.j["head"].rotation_euler = (0, rad(-head), rad(yaw))
    R.j["ear_l"].rotation_euler = (rad(ears[0]), 0, rad(ears[0] * 0.6))
    R.j["ear_r"].rotation_euler = (rad(-ears[1]), 0, rad(-ears[1] * 0.6))
    R.j["tail"].rotation_euler = (rad(tail_wag), rad(tail_up), 0)


def animate_doe(R, t):
    up = smooth(3.0, 4.2, t) - smooth(6.6, 8.0, t)                 # 0 grazing, 1 head up
    nibble = (1 - up) * 3.0 * math.sin(TAU * t)                    # 10 whole cycles in the loop
    flick = pulse(t, 5.0, 0.12) - 0.7 * pulse(t, 5.3, 0.1)
    tail = pulse(t, 6.0, 0.35)
    pose_deer(R, neck=lerp(-66, 48, up) + nibble, head=lerp(-14, -68, up), yaw=-42 * up,
              ears=(28 * flick, 18 * pulse(t, 5.15, 0.1)), tail_up=-70 * tail,
              tail_wag=30 * tail * math.sin(TAU * 5 * t), lean=lerp(4, 0, up))


def animate_buck(R, t):
    pose_deer(R, neck=44 + 2 * math.sin(TAU * t / T), head=-62, yaw=24 * math.sin(TAU * t / T + 0.6),
              ears=(26 * pulse(t, 2.0, 0.12), 22 * pulse(t, 2.3, 0.1)), tail_up=-50 * pulse(t, 8.2, 0.3),
              tail_wag=25 * pulse(t, 8.2, 0.3) * math.sin(TAU * 5 * t))


# ---------------------------------------------------------------- turkeys
def build_turkey(name, mats):
    R = Rig(name)
    f, dark = mats["turkey"], mats["dark"]
    body = R.joint("body", R.root, (0, 0, 0.50))
    R.ell(body, (0.27, 0.17, 0.21), (0, 0, 0), f)
    R.ell(body, (0.15, 0.15, 0.19), (0.16, 0, -0.03), f)
    R.ell(body, (0.25, 0.12, 0.05), (-0.38, 0, 0.0), mats["turkey_tail"], rot=(0, rad(-14), 0))
    for s in (1, -1):
        R.ell(body, (0.21, 0.025, 0.12), (-0.03, s * 0.15, 0.02), mats["turkey_tail"], rot=(0, rad(8), 0))
    n1, e = R.seg("neck1", body, (0.22, 0, 0.09), 0.17, 0.06, 0.032, "+X", f)
    n2, e = R.seg("neck2", n1, e, 0.15, 0.03, 0.022, "+X", mats["turkey_head"])
    head = R.joint("head", n2, e)
    R.ell(head, (0.045, 0.028, 0.032), (0.03, 0, 0), mats["turkey_head"])
    R.ell(head, (0.03, 0.01, 0.01), (0.085, 0, -0.005), mats["antler"])
    for s, side in ((1, "l"), (-1, "r")):
        up, e = R.seg(f"up_{side}", R.root, (0.0, s * 0.07, 0.40), 0.19, 0.035, 0.015, "-Z", f)
        lo, e2 = R.seg(f"lo_{side}", up, e, 0.21, 0.012, 0.009, "-Z", dark)
        R.ell(lo, (0.05, 0.025, 0.008), (0.03, 0, e2[2] + 0.005), dark)
    R.j["shadow"] = build_shadow(name, 0.7)
    return R


def _turkey_tables():
    """Distance walked and how hard the bird is pecking, tabulated over the whole master walk (N loops)."""
    n = TURKEY_COPIES * C.FRAMES
    dist, peck, d = [], [], 0.0
    for i in range(n + 1):
        s = i / C.FPS
        stop = max(smooth(a - 0.8, a, s) - smooth(b, b + 0.8, s) for a, b in TURKEY_STOPS)
        dist.append(d)
        peck.append(stop)
        d += TURKEY_SPEED * (1 - 0.92 * stop) / C.FPS
    return dist, peck


def animate_turkey(R, k, frame, tables):
    dist, peck = tables
    i = frame + k * C.FRAMES                           # this copy's place in the master walk
    s, d, stop = i / C.FPS, dist[i], peck[i]
    half = dist[-1] / 2

    def path(dd):
        return dd - half, TURKEY_PATH_Y + 1.1 * math.sin(dd / 2.7)
    (x, y), (x2, y2) = path(d), path(d + 0.05)
    R.root.location = (x, y, 0)
    R.root.rotation_euler = (0, 0, math.atan2(y2 - y, x2 - x))
    place_shadow(R.j["shadow"], x, y, 0.7)
    ph = TAU * d / 0.5                                 # two steps of 0.25 m per cycle
    gait = 1 - stop
    down = stop * (0.5 - 0.5 * math.cos(TAU * 1.3 * s))            # pecks while stopped
    pitch = lerp(-15, 12, down)                        # rig convention: negative = breast up
    R.j["body"].rotation_euler = (0, rad(pitch), 0)
    R.j["neck1"].rotation_euler = (0, rad(-(lerp(60, -50, down) + pitch) - 7 * gait * math.sin(2 * ph)), 0)
    R.j["neck2"].rotation_euler = (0, rad(-lerp(38, -25, down)), 0)
    R.j["head"].rotation_euler = (0, rad(lerp(96, -5, down)), 0)
    for sgn, side in ((1, "l"), (-1, "r")):
        p = ph + (0 if sgn > 0 else math.pi)
        R.j[f"up_{side}"].rotation_euler = (0, rad(26 * gait * math.sin(p)), 0)
        R.j[f"lo_{side}"].rotation_euler = (0, rad(38 * gait * max(0.0, math.cos(p))), 0)


# ---------------------------------------------------------------- birds, leaves, mist
BIRDS = ((1.0, 0.0), (1.3, 1.6), (1.8, -1.2))          # (start second, sideways offset m)
BIRD_FROM, BIRD_TO, BIRD_SECONDS = (31.0, 55.0, 15.0), (3.0, 76.0, 31.5), 4.6


def build_bird(name, mats):
    R = Rig(name)
    R.ell(R.root, (0.2, 0.05, 0.05), (0, 0, 0), mats["dark"])
    for s, side in ((1, "l"), (-1, "r")):
        w = R.joint(f"wing_{side}", R.root, (0.02, s * 0.03, 0.01))
        R.ell(w, (0.1, 0.3, 0.008), (-0.01, s * 0.3, 0), mats["dark"])
    return R


def animate_bird(R, t, start, offset):
    u = (t - start) / BIRD_SECONDS
    on = 0.0 <= u <= 1.0
    for ob in [R.root, *R.root.children_recursive]:
        ob.hide_render = not on
    if not on:
        return
    a, b = BIRD_FROM, BIRD_TO
    R.root.location = (lerp(a[0], b[0], u) + offset, lerp(a[1], b[1], u) + 2 * offset, lerp(a[2], b[2], u) + 0.6 * offset)
    R.root.rotation_euler = (0, 0, math.atan2(b[1] - a[1], b[0] - a[0]))
    flap = rad(8 + 36 * math.sin(TAU * 3.4 * (t - start) + offset))
    R.j["wing_l"].rotation_euler = (flap, 0, 0)
    R.j["wing_r"].rotation_euler = (-flap, 0, 0)


LEAF_FALL_M = 9.0                                       # one loop = one fall, so every leaf wraps out of frame


def build_leaves(mats, count=70, seed=11):
    import random  # noqa: PLC0415
    bpy = _bpy()
    rng = random.Random(seed)
    me = bpy.data.meshes.new("leaf")
    me.from_pydata([(-0.035, 0, 0), (-0.012, 0.022, 0.004), (0.02, 0.018, 0), (0.04, 0, 0.003), (0.02, -0.018, 0),
                    (-0.012, -0.022, 0.004)], [], [(0, 1, 2, 3, 4, 5)])
    me.materials.append(None)
    leaves = []
    for i in range(count):
        ob = _link(bpy.data.objects.new(f"leaf_{i}", me))
        ob.material_slots[0].link = "OBJECT"
        ob.material_slots[0].material = mats[f"leaf_{i % 3}"]
        y = rng.uniform(2.5, 17.0)
        leaves.append({"ob": ob, "x": rng.uniform(-0.6, 0.6) * y, "y": y, "z0": rng.random(), "sway": rng.uniform(0.1, 0.35),
                       "n": [rng.randint(1, 3) for _ in range(4)], "ph": [rng.uniform(0, TAU) for _ in range(4)]})
    return leaves


def animate_leaves(leaves, t):
    u = t / T
    for L in leaves:
        n, ph = L["n"], L["ph"]
        fall = (L["z0"] + u) % 1.0
        L["ob"].location = (L["x"] + L["sway"] * math.sin(TAU * n[0] * u + ph[0]), L["y"], LEAF_FALL_M * (1 - fall))
        L["ob"].rotation_euler = tuple(TAU * n[i] * u * (1 if i != 2 else -1) + ph[i] for i in (1, 2, 3))


MIST = (  # (distance m, base, amount, emission strength)
    (9.0, 0.0, 0.35, 0.5), (17.0, 0.0, 0.5, 0.5), (27.0, 0.0, 0.6, 0.5))


FOG_TOP_M, FOG_BOTTOM_M, FOG_REACH_M, FOG_DENSITY = 6.0, -1.5, 90.0, 0.008


def build_fog():
    """Ground fog as one even slab of scattering air round the camera. Rays near the horizon travel far inside it
    and rays looking up or down leave it quickly, so it is thickest at the horizon and has no edge anywhere. It is
    lit by the HDRI, so it glows towards the sun. The slab reaches below the ground on purpose: there is no ground
    object to stop the rays (the ground is in the photograph), and a slab ending at z = 0 thins so fast just under
    the horizon that it reads as a hard line."""
    import bmesh  # noqa: PLC0415
    from mathutils import Matrix  # noqa: PLC0415
    bpy = _bpy()
    me = bpy.data.meshes.new("fog")
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0, matrix=Matrix.Diagonal((2 * FOG_REACH_M, 2 * FOG_REACH_M, FOG_TOP_M - FOG_BOTTOM_M, 1)))
    bm.to_mesh(me)
    bm.free()
    m = bpy.data.materials.new("fog")
    nt = _nodes(m)
    vs, out = nt.nodes.new("ShaderNodeVolumeScatter"), nt.nodes.new("ShaderNodeOutputMaterial")
    vs.inputs["Density"].default_value = FOG_DENSITY
    vs.inputs["Anisotropy"].default_value = 0.55
    nt.links.new(vs.outputs[0], out.inputs["Volume"])
    me.materials.append(m)
    ob = _link(bpy.data.objects.new("fog", me))
    ob.location = (0, 0, (FOG_TOP_M + FOG_BOTTOM_M) / 2)
    return ob


def build_mist():
    """Drifting wisps on top of the even fog: the only part of the mist that moves."""
    bpy = _bpy()
    cards = []
    for i, (y, base, amount, strength) in enumerate(MIST):
        w, h = 2.4 * y + 8, 3.5 + 0.16 * y
        me = bpy.data.meshes.new("mist")
        me.from_pydata([(-w / 2, 0, 0), (w / 2, 0, 0), (w / 2, 0, h), (-w / 2, 0, h)], [], [(0, 1, 2, 3)])
        uv = me.uv_layers.new(name="uv")
        for loop, co in zip(uv.data, ((0, 0), (1, 0), (1, 1), (0, 1))):
            loop.uv = co
        m, mp = mist_material(f"mist_{i}", (1.0, 0.86, 0.70), strength, base, amount, 0.9 / (1 + 0.04 * y))
        me.materials.append(m)
        ob = _link(bpy.data.objects.new(f"mist_{i}", me))
        ob.location = (0, y, 0)
        ob.visible_shadow = False
        ob.visible_diffuse = ob.visible_glossy = False
        cards.append((mp, i))
    return cards


def animate_mist(cards, t):
    a = TAU * t / T
    for mp, i in cards:                                # a circle in noise space: drifts, and frame N equals frame 0
        r = 0.45 + 0.12 * i
        mp.inputs["Location"].default_value = (r * math.cos(a + i), 13.0 * i, 0.5 * r * math.sin(a + i))


def build_materials():
    m = {
        "deer": matte("deer", (0.080, 0.062, 0.046), bump=0.25),          # grey-brown November coat
        "deer_pale": matte("deer_pale", (0.16, 0.14, 0.115)),
        "white": matte("white", (0.62, 0.60, 0.56)),
        "dark": matte("dark", (0.012, 0.011, 0.010), rough=0.7),
        "antler": matte("antler", (0.22, 0.17, 0.11), rough=0.6),
        "turkey": matte("turkey", (0.030, 0.024, 0.020), rough=0.55, bump=0.5, bump_scale=90),
        "turkey_tail": matte("turkey_tail", (0.055, 0.038, 0.026), rough=0.6, bump=0.5, bump_scale=40),
        "turkey_head": matte("turkey_head", (0.12, 0.10, 0.11), rough=0.7),
    }
    for i, c in enumerate(((0.30, 0.13, 0.035), (0.36, 0.20, 0.05), (0.20, 0.10, 0.04))):
        m[f"leaf_{i}"] = matte(f"leaf_{i}", c, rough=0.6)
    return m


def build(quality="draft", threads=4, yaw=HDRI_YAW_DEG):
    sc = setup_scene(quality, threads, yaw)
    mats = build_materials()
    doe, buck = build_deer("doe", mats), build_deer("buck", mats, buck=True)
    doe.root.location, doe.root.rotation_euler = (*DOE_AT, 0), (0, 0, rad(200))      # quartering towards the camera
    buck.root.location, buck.root.rotation_euler = (*BUCK_AT, 0), (0, 0, rad(-25))
    for R, at in ((doe, DOE_AT), (buck, BUCK_AT)):
        place_shadow(build_shadow(R.name, 1.5), *at, 1.5)
    world = {
        "scene": sc, "doe": doe, "buck": buck,
        "turkeys": [build_turkey(f"turkey_{k}", mats) for k in range(TURKEY_COPIES)],
        "turkey_tables": _turkey_tables(),
        "birds": [build_bird(f"bird_{i}", mats) for i in range(len(BIRDS))],
        "leaves": build_leaves(mats), "mist": build_mist(), "fog": build_fog(),
    }
    return world


def pose(world, frame: int):
    """Put everything where it is at `frame` (0 .. FRAMES-1). Frame FRAMES would equal frame 0."""
    t = (frame % C.FRAMES) / C.FPS
    animate_doe(world["doe"], t)
    animate_buck(world["buck"], t)
    for k, R in enumerate(world["turkeys"]):
        animate_turkey(R, k, frame % C.FRAMES, world["turkey_tables"])
    for R, (start, off) in zip(world["birds"], BIRDS):
        animate_bird(R, t, start, off)
    animate_leaves(world["leaves"], t)
    animate_mist(world["mist"], t)


def render(quality, frames, out_dir: Path, threads=4, yaw=HDRI_YAW_DEG):
    bpy = _bpy()
    out_dir.mkdir(parents=True, exist_ok=True)
    world = build(quality, threads, yaw)
    times = []
    for f in frames:
        target = out_dir / f"f_{f:04d}.png"
        if target.exists():
            continue                                   # resumable
        pose(world, f)
        world["scene"].frame_set(f)
        world["scene"].cycles.seed = f
        world["scene"].render.filepath = str(target)
        t0 = time.time()
        bpy.ops.render.render(write_still=True)
        times.append(time.time() - t0)
        print(f"frame {f}: {times[-1]:.1f} s", flush=True)
    if times:
        print(f"rendered {len(times)} frames, mean {sum(times) / len(times):.1f} s, total {sum(times) / 60:.1f} min")
    return times


def parse_frames(spec: str, step: int) -> list:
    if not spec:
        return list(range(0, C.FRAMES, step))
    out = []
    for part in spec.split(","):
        a, _, b = part.partition("-")
        out += list(range(int(a), int(b or a) + 1, step))
    return out


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("cmd", choices=["fetch", "render"])
    ap.add_argument("--quality", default="draft", choices=list(C.QUALITY))
    ap.add_argument("--frames", default="", help="e.g. 120 or 0-239 or 0,60,120 (default: the whole loop)")
    ap.add_argument("--step", type=int, default=1)
    ap.add_argument("--threads", type=int, default=4)
    ap.add_argument("--yaw", type=float, default=HDRI_YAW_DEG, help="look development: turn the HDRI")
    ap.add_argument("--out", default="", help="frame folder (default $HCM_BG_WORK/<quality>)")
    a = ap.parse_args(argv)
    if a.cmd == "fetch":
        print("\n".join(fetch_assets()))
        return
    out = Path(a.out) if a.out else C.work_dir() / a.quality
    render(a.quality, parse_frames(a.frames, a.step), out, a.threads, a.yaw)


if __name__ == "__main__":
    main()
