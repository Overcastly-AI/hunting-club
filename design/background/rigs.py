"""Build the animal rigs in Blender (headless bpy) and render every distinct pose as a flat silhouette.

    $BPY design/background/rigs.py                 # all clips -> $HCM_BG_WORK/masks/<clip>/<n>.png + index.json

$BPY is a Python with the `bpy` wheel (about 1 GB, so it lives in a scratch venv, never in the repo):
    python3.13 -m venv $SCRATCH/bpyenv && $SCRATCH/bpyenv/bin/pip install bpy     # bpy 5.3.0 tested 2026-11-26

The solids and their motion come from poses.py. Here they become mesh objects, lit by nothing: a white emission
material on a black world, seen by an orthographic camera, so each frame is a pure mask. trace.py turns the masks
into SVG paths. Poses that repeat (holds, cycles) are rendered once; index.json maps every frame to its mask.

The headless setup (bpy in a scratch venv, Cycles on CPU, fixed threads) follows the owner's hunting-appeal renderer
(huntkit/viz3d/cycles_render.py). No third-party model, texture or image is used: every shape is built here.
"""
from __future__ import annotations

import argparse
import json
import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import config as C  # noqa: E402
import poses as P  # noqa: E402


def _bpy():
    import bpy  # noqa: PLC0415
    return bpy


def setup(width: int, height: int):
    bpy = _bpy()
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.render.engine = "CYCLES"
    sc.cycles.device = "CPU"
    sc.cycles.samples = 8                               # only for edge anti-aliasing; there is no light to resolve
    sc.cycles.use_adaptive_sampling = False
    sc.cycles.use_denoising = False
    sc.cycles.max_bounces = 0
    sc.render.threads_mode, sc.render.threads = "FIXED", 4
    sc.render.use_persistent_data = True
    sc.render.resolution_x, sc.render.resolution_y, sc.render.resolution_percentage = width, height, 100
    sc.render.image_settings.file_format = "PNG"
    sc.render.image_settings.color_mode = "BW"
    sc.view_settings.view_transform = "Standard"
    world = bpy.data.worlds.new("black")
    sc.world = world
    world.color = (0, 0, 0)
    mat = bpy.data.materials.new("silhouette")
    try:
        mat.use_nodes = True
    except Exception:  # noqa: BLE001  (newer Blender: always node based)
        pass
    nt = mat.node_tree
    nt.nodes.clear()
    em, out = nt.nodes.new("ShaderNodeEmission"), nt.nodes.new("ShaderNodeOutputMaterial")
    em.inputs["Strength"].default_value = 1.0
    nt.links.new(em.outputs[0], out.inputs["Surface"])
    return sc, mat


def _mesh(kind: str, ra: float = 1.0, rb: float = 1.0):
    """A unit sphere, or a unit-long tapered limb along +X (its rounded ends are separate spheres)."""
    import bmesh  # noqa: PLC0415
    from mathutils import Matrix  # noqa: PLC0415
    me = _bpy().data.meshes.new(kind)
    bm = bmesh.new()
    if kind == "sphere":
        bmesh.ops.create_uvsphere(bm, u_segments=32, v_segments=16, radius=1.0)
    else:
        bmesh.ops.create_cone(bm, cap_ends=True, segments=24, radius1=ra, radius2=rb, depth=1.0,
                              matrix=Matrix.Rotation(math.pi / 2, 4, "Y") @ Matrix.Translation((0, 0, 0.5)))
    bm.to_mesh(me)
    bm.free()
    return me


class Rig:
    """Mesh objects for one animal. Built from its first pose; every later pose only moves them."""

    def __init__(self, pose: list, mat):
        bpy = _bpy()
        sphere = _mesh("sphere")
        sphere.materials.append(mat)
        self.parts = []
        for prim in pose:
            if prim[0] == "limb":
                cone = _mesh("limb", prim[5], prim[6])
                cone.materials.append(mat)
                obs = [bpy.data.objects.new("limb", cone), bpy.data.objects.new("a", sphere),
                       bpy.data.objects.new("b", sphere)]
            else:
                obs = [bpy.data.objects.new(prim[0], sphere)]
            for ob in obs:
                bpy.context.scene.collection.objects.link(ob)
            self.parts.append(obs)

    def pose(self, pose: list):
        for prim, obs in zip(pose, self.parts):
            if prim[0] == "ell":
                _, cx, cz, rx, rz, a = prim
                obs[0].location, obs[0].scale = (cx, 0, cz), (rx, min(rx, rz), rz)
                obs[0].rotation_euler = (0, -a, 0)      # the picture plane's counter-clockwise is -Y in Blender
            elif prim[0] == "limb":
                _, ax, az, bx, bz, ra, rb = prim
                obs[0].location, obs[0].scale = (ax, 0, az), (math.hypot(bx - ax, bz - az), 1, 1)
                obs[0].rotation_euler = (0, -math.atan2(bz - az, bx - ax), 0)
                obs[1].location, obs[1].scale = (ax, 0, az), (ra, ra, ra)
                obs[2].location, obs[2].scale = (bx, 0, bz), (rb, rb, rb)
            else:
                _, loc, radii, euler = prim
                obs[0].location, obs[0].scale, obs[0].rotation_euler = loc, radii, euler


def camera(box, view=None):
    """Orthographic, square on to the side-view plane, or from (azimuth, elevation) degrees for the crow."""
    from mathutils import Vector  # noqa: PLC0415
    bpy = _bpy()
    x0, z0, x1, z1 = box
    cam = bpy.data.cameras.new("cam")
    cam.type, cam.ortho_scale = "ORTHO", max(x1 - x0, z1 - z0)
    ob = bpy.data.objects.new("cam", cam)
    bpy.context.scene.collection.objects.link(ob)
    centre = Vector(((x0 + x1) / 2, 0, (z0 + z1) / 2))
    az, el = (math.radians(v) for v in (view or (90.0, 0.0)))   # azimuth from the animal's nose round to its side
    away = Vector((math.cos(el) * math.cos(az), -math.cos(el) * math.sin(az), math.sin(el)))
    ob.location = centre + 20 * away
    ob.rotation_euler = (-away).to_track_quat("-Z", "Y").to_euler()
    bpy.context.scene.camera = ob


def key(pose: list) -> str:
    def r(v):
        return tuple(r(x) for x in v) if isinstance(v, tuple) else (round(v, 4) if isinstance(v, float) else v)
    return repr([r(tuple(p)) for p in pose])


def render_clip(name: str, out: Path) -> dict:
    bpy = _bpy()
    clip = P.CLIPS[name]
    x0, z0, x1, z1 = clip["box"]
    w, h = round((x1 - x0) * C.MASK_PX_PER_M), round((z1 - z0) * C.MASK_PX_PER_M)
    sc, mat = setup(w, h)
    camera(clip["box"], clip.get("camera"))
    rig = Rig(clip["pose"](0.0), mat)
    out.mkdir(parents=True, exist_ok=True)
    for old in out.glob("*.png"):
        old.unlink()
    seen, order = {}, []
    for f in range(P.frames(name)):
        pose = P.frame_pose(name, f)
        k = key(pose)
        if k not in seen:
            seen[k] = len(seen)
            rig.pose(pose)
            sc.render.filepath = str(out / f"{seen[k]:04d}.png")
            bpy.ops.render.render(write_still=True)
        order.append(seen[k])
    info = {"size": [w, h], "frames": order, "unique": len(seen)}
    (out / "index.json").write_text(json.dumps(info))
    return info


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--clips", default=",".join(P.CLIPS))
    a = ap.parse_args(argv)
    for name in a.clips.split(","):
        info = render_clip(name, C.work_dir() / "masks" / name)
        print(f"{name}: {len(info['frames'])} frames, {info['unique']} rendered, {info['size'][0]} x {info['size'][1]}",
              flush=True)


if __name__ == "__main__":
    main()
