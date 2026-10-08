"""Builds the battle characters (public/assets/characters/*.glb) in Blender.

Run headless:
  blender -b --python tools/characters/build.py
  blender -b --python tools/characters/build.py -- --preview Sword_Attack 0.45

Source art (CC0, by Quaternius) is not committed; download the Standard
versions of these packs into LANES_ART (default C:/Users/chris/LanesArt):
  UBC/      Universal Base Characters      (heads, eyes, hair)
  Outfits/  Modular Character Outfits - Fantasy
  UAL/      Universal Animation Library    (animations)
Weapons, armour, hats and robes are modelled here.
"""

import math
import os
import subprocess
import sys

import bmesh
import bpy
from mathutils import Matrix, Vector

ART = os.environ.get("LANES_ART", "C:/Users/chris/LanesArt").rstrip("/") + "/"
REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(REPO, "public", "assets", "characters")
BASE = ART + "UBC/Universal Base Characters[Standard]/Base Characters/Godot - UE/"
HAIR = ART + "UBC/Universal Base Characters[Standard]/Hairstyles/Rigged to Head Bone/glTF (Godot -Unreal)/"
PARTS = ART + "Outfits/Modular Character Outfits - Fantasy[Standard]/Exports/glTF (Godot-Unreal)/Modular Parts/"
UAL = ART + "UAL/Universal Animation Library[Standard]/Unreal-Godot/UAL1_Standard.glb"
TEXTURE_SIZE = 512

# Library clips the game plays; the bow shot is authored below.
CLIPS = [
    "Idle_Loop", "Walk_Loop", "Sword_Idle", "Sword_Attack", "Punch_Cross", "Pistol_Idle_Loop",
    "Pistol_Shoot", "Spell_Simple_Shoot", "Hit_Chest", "Death01", "Crouch_Idle_Loop",
]

CLASSES = {
    "fighter": dict(
        body="Superhero_Male", hair="Hair_Buzzed", beard=True,
        parts=["Male_Ranger_Body", "Male_Ranger_Arms", "Male_Ranger_Legs", "Male_Ranger_Feet_Boots", "Male_Ranger_Acc_Pauldron"],
        extras=["helm", "sword", "shield"],
    ),
    "archer": dict(
        body="Superhero_Male", hair=None,
        parts=["Male_Ranger_Body", "Male_Ranger_Arms", "Male_Ranger_Legs", "Male_Ranger_Feet_Boots", "Male_Ranger_Head_Hood"],
        extras=["bow", "quiver", "sash"],
    ),
    "lancer": dict(
        body="Superhero_Female", hair="Hair_Buns",
        parts=["Female_Ranger_Body", "Female_Ranger_Arms", "Female_Ranger_Legs", "Female_Ranger_Feet", "Female_Ranger_Acc_Pauldrons"],
        extras=["sash", "lance", "circlet"], texture=("T_Ranger_BaseColor", "Ranger/T_Ranger_3_BaseColor.png"),
    ),
    "gunner": dict(
        body="Superhero_Male", hair="Hair_SimpleParted", beard=True,
        parts=["Male_Peasant_Body", "Male_Peasant_Arms", "Male_Peasant_Legs", "Male_Peasant_Feet"],
        extras=["tricorn", "sash", "pistol"],
    ),
    "cleric": dict(
        body="Superhero_Female", hair="Hair_Long",
        parts=["Female_Peasant_Body", "Female_Peasant_Arms", "Female_Peasant_Legs", "Female_Peasant_Feet"],
        extras=["robe_white", "sash", "staff", "halo"],
    ),
    "witch": dict(
        body="Superhero_Female", hair="Hair_Long",
        parts=["Female_Peasant_Body", "Female_Peasant_Arms", "Female_Peasant_Legs", "Female_Peasant_Feet"],
        extras=["robe_dark", "witch_hat", "orb"], texture=("T_Peasant_BaseColor", "Peasant/T_Peasant_2_BaseColor.png"),
    ),
}


# ---------------------------------------------------------------------------
# Helpers


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def imp(path):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    return [o for o in bpy.data.objects if o not in before]


def junk(o):
    return o.type == "MESH" and o.name.startswith("Icosphere")


_materials = {}


def material(name, color, metallic=0.0, roughness=0.65, emission=0.0):
    if name in _materials and _materials[name].name in bpy.data.materials:
        return _materials[name]
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (*color, 1)
    bsdf.inputs["Metallic"].default_value = metallic
    bsdf.inputs["Roughness"].default_value = roughness
    if emission:
        bsdf.inputs["Emission Color"].default_value = (*color, 1)
        bsdf.inputs["Emission Strength"].default_value = emission
    _materials[name] = m
    return m


def team():
    # Recoloured per side by the game: blue for the player, red for the enemy.
    return material("Team", (0.8, 0.8, 0.8), roughness=0.55)


def hex_color(value):
    return tuple(((value >> s) & 255) / 255.0 for s in (16, 8, 0))


def finish(obj, mat, smooth=True):
    obj.data.materials.clear()
    obj.data.materials.append(mat)
    if smooth:
        for p in obj.data.polygons:
            p.use_smooth = True
    return obj


def prim(kind, mat, location=(0, 0, 0), rotation=(0, 0, 0), scale=(1, 1, 1), **kw):
    """A primitive in the current local frame (degrees for rotation)."""
    rot = tuple(math.radians(r) for r in rotation)
    getattr(bpy.ops.mesh, f"primitive_{kind}_add")(location=location, rotation=rot, **kw)
    o = bpy.context.active_object
    o.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return finish(o, mat, smooth=kind not in ("cube",))


def join(objs, name):
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    for o in objs:
        bpy.context.view_layer.objects.active = o
        bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    bpy.context.view_layer.objects.active = objs[0]
    for o in objs:
        o.select_set(True)
    bpy.ops.object.join()
    objs[0].name = name
    return objs[0]


def bone_frame(rig, bone):
    return rig.matrix_world @ rig.data.bones[bone].matrix_local


def attach_rigid(obj, rig, bone, local=Matrix()):
    """Place obj (modelled in the bone's frame) on the bone and parent it there."""
    obj.matrix_world = bone_frame(rig, bone) @ local @ obj.matrix_world
    world = obj.matrix_world.copy()
    obj.parent = rig
    obj.parent_type = "BONE"
    obj.parent_bone = bone
    obj.matrix_world = world


def skin(obj, rig, weights):
    """Skin obj to the rig; weights(world_position) -> {bone: weight}."""
    groups = {}
    for v in obj.data.vertices:
        for bone, w in weights(obj.matrix_world @ v.co).items():
            if bone not in groups:
                groups[bone] = obj.vertex_groups.new(name=bone)
            groups[bone].add([v.index], w, "REPLACE")
    mod = obj.modifiers.new("Armature", "ARMATURE")
    mod.object = rig
    world = obj.matrix_world.copy()
    obj.parent = rig
    obj.matrix_world = world


def bone_head(rig, name):
    return rig.matrix_world @ rig.data.bones[name].head_local


# ---------------------------------------------------------------------------
# Modelled pieces. Blender is Z up; characters face -Y; +X is their left.


def skirt_weights(rig, top_z, length):
    pelvis_z = bone_head(rig, "pelvis").z

    def weights(p):
        t = max(0.0, min(1.0, (pelvis_z - p.z) / (length * 0.9)))
        leg = "thigh_l" if p.x > 0 else "thigh_r"
        side = min(1.0, abs(p.x) / 0.12)
        follow = t * 0.35 * side
        return {"pelvis": 1 - follow, leg: follow} if follow > 0.01 else {"pelvis": 1.0}

    return weights


def robe(rig, color, trim):
    pelvis = bone_head(rig, "pelvis")
    top = pelvis.z + 0.06
    length = top - 0.04
    cloth = material(f"Robe_{color}", hex_color(color), roughness=0.8)
    o = prim("cone", cloth, location=(0, pelvis.y, top - length / 2), vertices=24, radius1=0.3, radius2=0.17, depth=length)
    bm = bmesh.new()
    bm.from_mesh(o.data)
    bmesh.ops.delete(bm, geom=[f for f in bm.faces if abs(f.normal.z) > 0.9], context="FACES")
    bmesh.ops.subdivide_edges(bm, edges=[e for e in bm.edges if abs(e.verts[0].co.z - e.verts[1].co.z) > 0.01], cuts=6)
    bm.to_mesh(o.data)
    bm.free()
    solid = o.modifiers.new("Solidify", "SOLIDIFY")
    solid.thickness = 0.012
    hem = prim("torus", team() if trim else material("Gold", hex_color(0xD9B24A), 0.8, 0.35),
               location=(0, pelvis.y, 0.06), major_radius=0.297, minor_radius=0.016, major_segments=32, minor_segments=6)
    sash = prim("torus", material("Gold", hex_color(0xD9B24A), 0.8, 0.35), location=(0, pelvis.y, top),
                major_radius=0.17, minor_radius=0.02, major_segments=24, minor_segments=6)
    piece = join([o, hem, sash], "Robe")
    skin(piece, rig, skirt_weights(rig, top, length))


def tabard(rig):
    chest = bone_head(rig, "spine_03")
    pelvis = bone_head(rig, "pelvis")
    o = prim("cube", team(), location=(0, chest.y - 0.15, (chest.z + pelvis.z) / 2 - 0.12), scale=(0.17, 0.012, 0.36))
    trim = prim("cube", material("Gold", hex_color(0xD9B24A), 0.8, 0.35), location=(0, chest.y - 0.163, (chest.z + pelvis.z) / 2 - 0.12), scale=(0.03, 0.004, 0.33))
    piece = join([o, trim], "Tabard")
    pz = pelvis.z

    def weights(p):
        if p.z > pz + 0.08:
            return {"spine_03": 1.0}
        if p.z > pz - 0.05:
            return {"pelvis": 1.0}
        leg = "thigh_l" if p.x > 0 else "thigh_r"
        return {"pelvis": 0.6, leg: 0.4}

    skin(piece, rig, weights)


def cape(rig):
    neck = bone_head(rig, "neck_01")
    o = prim("plane", team(), location=(0, neck.y + 0.13, neck.z - 0.42), rotation=(90, 0, 0), size=1, scale=(0.34, 0.8, 1))
    bm = bmesh.new()
    bm.from_mesh(o.data)
    bmesh.ops.subdivide_edges(bm, edges=bm.edges[:], cuts=8)
    for v in bm.verts:
        # Drape: hang slightly away from the back, wider at the hem.
        drop = (neck.z - 0.02 - (v.co.z + o.location.z)) / 0.8
        v.co.y += 0.06 * drop * drop
        v.co.x *= 0.75 + 0.45 * max(0.0, drop)
    bm.to_mesh(o.data)
    bm.free()
    o.modifiers.new("Solidify", "SOLIDIFY").thickness = 0.01
    o.name = "Cape"
    nz = neck.z

    def weights(p):
        t = max(0.0, min(1.0, (nz - p.z) / 0.5))
        return {"spine_03": 1 - t * 0.6, "pelvis": t * 0.6} if t > 0 else {"spine_03": 1.0}

    skin(o, rig, weights)


def helm(rig):
    steel = material("Steel", hex_color(0xC4CCD8), 0.85, 0.3)
    head = bone_head(rig, "Head")
    c = Vector((0, head.y - 0.005, head.z + 0.09))
    dome = prim("uv_sphere", steel, location=c, segments=24, ring_count=12, radius=0.135, scale=(1.0, 1.08, 0.82))
    rim = prim("torus", steel, location=(c.x, c.y, c.z - 0.02), major_radius=0.15, minor_radius=0.016, major_segments=28, minor_segments=6, scale=(1, 1.08, 1))
    plume = prim("uv_sphere", team(), location=(c.x, c.y + 0.07, c.z + 0.13), rotation=(-35, 0, 0), segments=12, ring_count=8, radius=1, scale=(0.03, 0.05, 0.13))
    piece = join([dome, rim, plume], "Helm")
    attach_rigid(piece, rig, "Head", bone_frame(rig, "Head").inverted())


def circlet(rig):
    head = bone_head(rig, "Head")
    o = prim("torus", material("Gold", hex_color(0xD9B24A), 0.8, 0.35), location=(0, head.y - 0.01, head.z + 0.1),
             rotation=(-12, 0, 0), major_radius=0.105, minor_radius=0.009, major_segments=28, minor_segments=6)
    gem = prim("uv_sphere", team(), location=(0, head.y - 0.115, head.z + 0.115), radius=0.016, segments=12, ring_count=8)
    piece = join([o, gem], "Circlet")
    attach_rigid(piece, rig, "Head", bone_frame(rig, "Head").inverted())


def witch_hat(rig):
    felt = material("HatFelt", hex_color(0x2A1F4D), roughness=0.85)
    head = bone_head(rig, "Head")
    base = Vector((0, head.y, head.z + 0.135))
    brim = prim("cylinder", felt, location=base, vertices=32, radius=0.27, depth=0.016)
    cone = prim("cone", felt, location=base + Vector((0, 0.015, 0.17)), vertices=24, radius1=0.13, radius2=0.03, depth=0.34)
    tip = prim("cone", felt, location=base + Vector((0, 0.07, 0.38)), rotation=(-50, 0, 0), vertices=16, radius1=0.035, radius2=0.0, depth=0.16)
    band = prim("cylinder", team(), location=base + Vector((0, 0.002, 0.03)), vertices=24, radius=0.133, depth=0.04)
    piece = join([brim, cone, tip, band], "WitchHat")
    attach_rigid(piece, rig, "Head", bone_frame(rig, "Head").inverted())


def tricorn(rig):
    felt = material("Tricorn", hex_color(0x1F2230), roughness=0.85)
    head = bone_head(rig, "Head")
    base = Vector((0, head.y, head.z + 0.135))
    brim = prim("cylinder", felt, location=base, rotation=(0, 0, 90), vertices=3, radius=0.25, depth=0.035)
    brim.modifiers.new("Bevel", "BEVEL").width = 0.03
    crown = prim("cylinder", felt, location=base + Vector((0, 0, 0.06)), vertices=16, radius=0.12, depth=0.11)
    trim = prim("cylinder", team(), location=base + Vector((0, 0, 0.012)), vertices=16, radius=0.123, depth=0.022)
    piece = join([brim, crown, trim], "Tricorn")
    attach_rigid(piece, rig, "Head", bone_frame(rig, "Head").inverted())


def halo(rig):
    gold = material("HaloGlow", hex_color(0xFFE27A), emission=3.0)
    head = bone_head(rig, "Head")
    o = prim("torus", gold, location=(0, head.y + 0.01, head.z + 0.26), rotation=(-10, 0, 0), major_radius=0.11, minor_radius=0.01, major_segments=32, minor_segments=6)
    o.name = "Halo"
    attach_rigid(o, rig, "Head", bone_frame(rig, "Head").inverted())


def stole(rig):
    chest = bone_head(rig, "spine_03")
    pieces = [prim("cube", team(), location=(x, chest.y - 0.14, chest.z - 0.15), rotation=(-8, 0, 0), scale=(0.035, 0.01, 0.3)) for x in (0.07, -0.07)]
    piece = join(pieces, "Stole")
    skin(piece, rig, lambda p: {"spine_03": 1.0} if p.z > bone_head(rig, "pelvis").z + 0.1 else {"pelvis": 1.0})


def sash(rig):
    chest = bone_head(rig, "spine_03")
    o = prim("torus", team(), location=(0, chest.y, chest.z - 0.06), rotation=(0, 35, 0), major_radius=0.2, minor_radius=0.022, major_segments=28, minor_segments=6, scale=(1, 0.72, 1))
    o.name = "Sash"
    skin(o, rig, lambda p: {"spine_03": 1.0})


def quiver(rig):
    leather = material("Leather", hex_color(0x6B4423), roughness=0.75)
    chest = bone_head(rig, "spine_03")
    body = prim("cylinder", leather, location=(0.08, chest.y + 0.15, chest.z - 0.05), rotation=(12, -20, 0), vertices=12, radius=0.05, depth=0.42)
    shafts = [prim("cylinder", material("Fletch", hex_color(0xE8E2D0)), location=(0.08 + dx, chest.y + 0.17, chest.z + 0.2), rotation=(12, -20, 0), vertices=6, radius=0.006, depth=0.12) for dx in (-0.02, 0.0, 0.02)]
    piece = join([body] + shafts, "Quiver")
    skin(piece, rig, lambda p: {"spine_03": 1.0})


# Weapons are modelled in the hand bone's frame: +Z is the fist channel
# (forward in the T-pose), +Y runs along the arm, +X is up.
GRIP = Matrix.Translation((0, 0.085, 0))


def sword(rig):
    steel = material("Blade", hex_color(0xE6EDF7), 0.9, 0.25)
    gold = material("Gold", hex_color(0xD9B24A), 0.8, 0.35)
    grip = prim("cylinder", material("Leather", hex_color(0x6B4423)), location=(0, 0, 0), vertices=8, radius=0.017, depth=0.14)
    guard = prim("cube", gold, location=(0, 0, 0.08), scale=(0.1, 0.018, 0.018))
    blade = prim("cube", steel, location=(0, 0, 0.47), scale=(0.028, 0.008, 0.38))
    tip = prim("cone", steel, location=(0, 0, 0.9), vertices=4, radius1=0.04, radius2=0.0, depth=0.1, scale=(1, 0.28, 1))
    pommel = prim("uv_sphere", gold, location=(0, 0, -0.085), radius=0.025, segments=12, ring_count=8)
    piece = join([grip, guard, blade, tip, pommel], "Sword")
    attach_rigid(piece, rig, "hand_r", GRIP)


def shield(rig):
    o = prim("uv_sphere", team(), location=(0, 0, 0), segments=24, ring_count=12, radius=1, scale=(0.03, 0.2, 0.27))
    rim = prim("uv_sphere", material("Steel", hex_color(0xC4CCD8), 0.85, 0.3), location=(0.006, 0, 0), segments=24, ring_count=12, radius=1, scale=(0.026, 0.215, 0.285))
    boss = prim("uv_sphere", material("Gold", hex_color(0xD9B24A), 0.8, 0.35), location=(-0.03, 0, 0), radius=0.04, segments=12, ring_count=8)
    piece = join([o, rim, boss], "Shield")
    # Strapped to the outside of the left forearm.
    attach_rigid(piece, rig, "lowerarm_l", Matrix.Translation((-0.07, 0.12, 0)))


def lance(rig):
    wood = material("Wood", hex_color(0x7A4A22), roughness=0.7)
    shaft = prim("cylinder", wood, location=(0, 0, 0.5), vertices=8, radius=0.02, depth=2.2)
    head = prim("cone", material("Blade", hex_color(0xE6EDF7), 0.9, 0.25), location=(0, 0, 1.75), vertices=4, radius1=0.055, radius2=0.0, depth=0.32)
    collar = prim("cylinder", material("Gold", hex_color(0xD9B24A), 0.8, 0.35), location=(0, 0, 1.57), vertices=8, radius=0.04, depth=0.05)
    flag = prim("cube", team(), location=(0, -0.13, 1.42), scale=(0.006, 0.12, 0.09))
    piece = join([shaft, head, collar, flag], "Lance")
    attach_rigid(piece, rig, "hand_r", GRIP)


def staff(rig):
    wood = material("Wood", hex_color(0x7A4A22), roughness=0.7)
    pole = prim("cylinder", wood, location=(0, 0, 0.3), vertices=8, radius=0.02, depth=1.6)
    ring = prim("torus", material("Gold", hex_color(0xD9B24A), 0.8, 0.35), location=(0, 0, 1.16), rotation=(0, 90, 0), major_radius=0.08, minor_radius=0.014, major_segments=24, minor_segments=6)
    gem = prim("uv_sphere", material("GemGlow", hex_color(0x8FE6FF), emission=4.0), location=(0, 0, 1.16), radius=0.04, segments=12, ring_count=8)
    piece = join([pole, ring, gem], "Staff")
    attach_rigid(piece, rig, "hand_r", GRIP)


def orb(rig):
    o = prim("uv_sphere", material("OrbGlow", hex_color(0xC08CFF), emission=5.0), location=(0.09, 0.02, 0.0), radius=0.075, segments=16, ring_count=10)
    o.name = "Orb"
    attach_rigid(o, rig, "hand_r", GRIP)


def bow(rig):
    wood = material("Wood", hex_color(0x7A4A22), roughness=0.7)
    curve = bpy.data.curves.new("BowCurve", "CURVE")
    curve.dimensions = "3D"
    spline = curve.splines.new("BEZIER")
    # Limbs curve back toward the archer; the string sits on the archer's side.
    points = [(0, -0.1, -0.55), (0, 0.04, 0), (0, -0.1, 0.55)]
    spline.bezier_points.add(len(points) - 1)
    for bp, co in zip(spline.bezier_points, points):
        bp.co = co
        bp.handle_left_type = bp.handle_right_type = "AUTO"
    curve.bevel_depth = 0.017
    curve.bevel_resolution = 2
    obj = bpy.data.objects.new("BowLimbs", curve)
    bpy.context.collection.objects.link(obj)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.ops.object.convert(target="MESH")
    finish(obj, wood)
    string = prim("cylinder", material("String", hex_color(0xE8E2D0)), location=(0, -0.1, 0), vertices=4, radius=0.003, depth=1.1)
    piece = join([obj, string], "Bow")
    attach_rigid(piece, rig, "hand_l", GRIP)


def pistol(rig):
    metal = material("Gunmetal", hex_color(0x6F7885), 0.8, 0.35)
    wood = material("Wood", hex_color(0x7A4A22), roughness=0.7)
    handle = prim("cube", wood, location=(0, 0, -0.03), rotation=(15, 0, 0), scale=(0.02, 0.022, 0.06))
    barrel = prim("cylinder", metal, location=(0.05, 0.16, 0.0), rotation=(90, 0, 0), vertices=10, radius=0.016, depth=0.34)
    stock = prim("cube", wood, location=(0.045, 0.02, 0.0), scale=(0.022, 0.06, 0.03))
    muzzle = prim("cylinder", material("Gold", hex_color(0xD9B24A), 0.8, 0.35), location=(0.05, 0.33, 0.0), rotation=(90, 0, 0), vertices=10, radius=0.022, depth=0.03)
    piece = join([handle, barrel, stock, muzzle], "Pistol")
    attach_rigid(piece, rig, "hand_r", GRIP)


EXTRAS = {
    "helm": helm, "tabard": tabard, "sword": sword, "shield": shield, "bow": bow, "quiver": quiver,
    "sash": sash, "cape": cape, "lance": lance, "circlet": circlet, "tricorn": tricorn,
    "pistol": pistol, "robe_white": lambda r: robe(r, 0xF0EDE4, False), "stole": stole,
    "staff": staff, "halo": halo, "robe_dark": lambda r: robe(r, 0x2B2670, True), "witch_hat": witch_hat,
    "orb": orb,
}

# The empty projectiles leave from, in the bone frame of the weapon hand.
MUZZLES = {
    "fighter": ("hand_r", (0, 0.085, 0.6)), "archer": ("hand_l", (0, 0.085, 0)),
    "lancer": ("hand_r", (0, 0.085, 1.8)), "gunner": ("hand_r", (0.05, 0.42, 0)),
    "cleric": ("hand_r", (0, 0.085, 1.16)), "witch": ("hand_r", (0.09, 0.105, 0)),
}


# ---------------------------------------------------------------------------
# Assembly


def keep_head(body):
    keep = {"Head", "neck_01"}
    groups = {g.index: g.name for g in body.vertex_groups}
    bm = bmesh.new()
    bm.from_mesh(body.data)
    layer = bm.verts.layers.deform.active
    drop = []
    for v in bm.verts:
        w = v[layer]
        best = max(w.items(), key=lambda kv: kv[1])[0] if w else None
        if groups.get(best) not in keep:
            drop.append(v)
    bmesh.ops.delete(bm, geom=drop, context="VERTS")
    bm.to_mesh(body.data)
    bm.free()


def add_parts(paths, rig):
    for path in paths:
        objs = imp(path)
        for o in objs:
            if o.type == "MESH" and not junk(o):
                for m in o.modifiers:
                    if m.type == "ARMATURE":
                        m.object = rig
                world = o.matrix_world.copy()
                o.parent = rig
                o.matrix_world = world
        for o in objs:
            if o.type == "ARMATURE" or junk(o):
                bpy.data.objects.remove(o)


def simplify_materials():
    """Colour map only, downscaled: small files and a flat, painterly read."""
    for m in bpy.data.materials:
        if not m.use_nodes:
            continue
        nodes = m.node_tree.nodes
        bsdf = next((n for n in nodes if n.type == "BSDF_PRINCIPLED"), None)
        if not bsdf:
            continue
        for name in ("Normal", "Roughness", "Metallic"):
            for link in list(bsdf.inputs[name].links):
                m.node_tree.links.remove(link)
        if bsdf.inputs["Metallic"].default_value < 0.5:
            bsdf.inputs["Roughness"].default_value = max(bsdf.inputs["Roughness"].default_value, 0.6)
    for img in bpy.data.images:
        if img.size[0] > TEXTURE_SIZE:
            img.scale(TEXTURE_SIZE, TEXTURE_SIZE)


def strip_attributes(rig):
    """The pack carries vertex colours and spare UV sets the game never reads."""
    for o in rig.children:
        if o.type != "MESH":
            continue
        for attr in list(o.data.color_attributes):
            o.data.color_attributes.remove(attr)
        while len(o.data.uv_layers) > 1:
            o.data.uv_layers.remove(o.data.uv_layers[-1])


def decimate(rig, budget=9000, keep=400):
    """Fit the whole character in a triangle budget: eight are skinned every frame."""
    meshes = [o for o in rig.children_recursive if o.type == "MESH" and len(o.data.polygons) > keep]
    total = sum(len(o.data.polygons) for o in rig.children_recursive if o.type == "MESH")
    if total <= budget:
        return
    small = total - sum(len(o.data.polygons) for o in meshes)
    ratio = max(0.1, (budget - small) / (total - small))
    for o in meshes:
        mod = o.modifiers.new("Decimate", "DECIMATE")
        mod.ratio = max(ratio, keep / len(o.data.polygons))


def assemble(name, spec):
    reset()
    _materials.clear()
    base = imp(BASE + spec["body"] + "_FullBody.gltf")
    rig = next(o for o in base if o.type == "ARMATURE")
    for o in base:
        if junk(o):
            bpy.data.objects.remove(o)
    body = next(o for o in rig.children if o.type == "MESH" and o.name.lower().startswith("superhero"))
    keep_head(body)
    hair = [spec["hair"]] if spec.get("hair") else []
    if spec.get("beard"):
        hair.append("Hair_Beard")
    add_parts([PARTS + p + ".gltf" for p in spec["parts"]] + [HAIR + h + ".gltf" for h in hair], rig)
    for extra in spec["extras"]:
        EXTRAS[extra](rig)
    bone, at = MUZZLES[name]
    muzzle = bpy.data.objects.new("Muzzle", None)
    bpy.context.collection.objects.link(muzzle)
    attach_rigid(muzzle, rig, bone, Matrix.Translation(at))
    if spec.get("texture"):
        # Alternate outfit colours shipped with the pack keep classes apart.
        old, new = spec["texture"]
        swap = bpy.data.images.load(ART + "Outfits/Modular Character Outfits - Fantasy[Standard]/Textures/" + new)
        swap.pack()
        for m in bpy.data.materials:
            for node in m.node_tree.nodes if m.use_nodes else []:
                if node.type == "TEX_IMAGE" and node.image and node.image.name.startswith(old):
                    node.image = swap
    decimate(rig)
    strip_attributes(rig)
    simplify_materials()
    return rig


def export_character(name, rig):
    bpy.ops.object.select_all(action="DESELECT")
    rig.select_set(True)
    for o in rig.children_recursive:
        o.select_set(True)
    os.makedirs(OUT, exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=os.path.join(OUT, f"{name}.glb"), export_format="GLB", use_selection=True,
        export_animations=False, export_apply=True, export_image_format="JPEG",
        export_jpeg_quality=82, export_yup=True,
    )
    compress(os.path.join(OUT, f"{name}.glb"))


def compress(path):
    """Quantise and meshopt-compress in place; the game loads it with MeshoptDecoder."""
    subprocess.run(
        f'npx -y @gltf-transform/cli@4.2.1 meshopt "{path}" "{path}"', shell=True, check=True,
        stdout=subprocess.DEVNULL,
    )


# ---------------------------------------------------------------------------
# Animations


def author_bow(rig):
    """Adds Bow_Shoot: the idle stance for every bone, with the bow poses on top.

    Every bone is keyed so the clip fully replaces whatever played before it.
    """
    from mathutils import Euler

    scene = bpy.context.scene
    rig.animation_data_create()
    idle = bpy.data.actions["Idle_Loop"]
    rig.animation_data.action = idle
    if idle.slots:
        rig.animation_data.action_slot = idle.slots[0]
    scene.frame_set(0)
    stance = {pb.name: (pb.rotation_quaternion.copy(), pb.location.copy()) for pb in rig.pose.bones}
    action = bpy.data.actions.new("Bow_Shoot")
    action.use_fake_user = True
    rig.animation_data.action = action
    for frame, pose in build_bow_poses():
        for pb in rig.pose.bones:
            pb.rotation_mode = "QUATERNION"
            q, loc = stance[pb.name]
            if pb.name in pose:
                q = Euler(tuple(math.radians(r) for r in pose[pb.name]), "XYZ").to_quaternion()
            pb.rotation_quaternion = q
            pb.location = loc
            pb.keyframe_insert("rotation_quaternion", frame=frame)
            if pb.name == "pelvis":
                pb.keyframe_insert("location", frame=frame)
    rig.animation_data.action = None
    return action


def build_animations():
    reset()
    objs = imp(UAL)
    rig = next(o for o in objs if o.type == "ARMATURE")
    for o in objs:
        if o.type == "MESH":
            bpy.data.objects.remove(o)
    for action in list(bpy.data.actions):
        if action.name not in CLIPS:
            bpy.data.actions.remove(action)
    for action in bpy.data.actions:
        action.use_fake_user = True
    author_bow(rig)
    bpy.ops.object.select_all(action="DESELECT")
    rig.select_set(True)
    bpy.ops.export_scene.gltf(
        filepath=os.path.join(OUT, "animations.glb"), export_format="GLB", use_selection=True,
        export_animations=True, export_animation_mode="ACTIONS", export_force_sampling=True,
        export_frame_step=2, export_optimize_animation_size=True, export_yup=True,
    )
    compress(os.path.join(OUT, "animations.glb"))


def build_bow_poses():
    """Keyed in each bone's rest frame (local X is the hinge for both arms).

    Bow arm straight at the target with the hand turned so the bow stands
    upright; string hand drawn back to the chin; torso turned side-on.
    """
    rest = {b: (0, 0, 0) for b in ("spine_02", "spine_03", "Head", "upperarm_l", "lowerarm_l", "hand_l", "upperarm_r", "lowerarm_r", "hand_r")}
    raise_bow = dict(rest, upperarm_l=(80, 0, 0), hand_l=(0, -90, 0), upperarm_r=(70, 0, 0), lowerarm_r=(60, 0, 0))
    draw = dict(rest, spine_02=(0, -10, 0), spine_03=(0, -10, 0), Head=(0, 18, 0),
                upperarm_l=(90, 0, 0), hand_l=(0, -90, 0), upperarm_r=(90, 0, -8), lowerarm_r=(150, 0, 0))
    loose = dict(draw, upperarm_r=(75, 0, -15), lowerarm_r=(105, 0, 0))
    return [(0, rest), (5, raise_bow), (9, draw), (12, draw), (13, loose), (22, rest)]


# ---------------------------------------------------------------------------
# Preview renders (for tuning, not shipped)


def preview(action_name, at):
    for name, spec in CLASSES.items():
        rig = assemble(name, spec)
        anims = imp(UAL)
        src = next(o for o in anims if o.type == "ARMATURE")
        for o in anims:
            bpy.data.objects.remove(o)
        action = author_bow(rig) if action_name == "Bow_Shoot" else bpy.data.actions.get(action_name)
        rig.animation_data_create()
        rig.animation_data.action = action
        if action.slots:
            rig.animation_data.action_slot = action.slots[0]
        start, end = action.frame_range
        bpy.context.scene.frame_set(int(start + (end - start) * at))
        render(name, f"{action_name}-{at}")


def render(name, label):
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 520
    scene.render.resolution_y = 640
    world = bpy.data.worlds.new("w")
    scene.world = world
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs[1].default_value = 0.9
    cam = bpy.data.cameras.new("c")
    cam.type = "ORTHO"
    cam.ortho_scale = 2.6
    co = bpy.data.objects.new("c", cam)
    scene.collection.objects.link(co)
    scene.camera = co
    # The game's view: from the character's right, turned a little toward the front.
    co.location = (-5.0, -2.6, 1.0)
    co.rotation_euler = (math.radians(90), 0, math.radians(-62))
    sun = bpy.data.lights.new("s", "SUN")
    sun.energy = 3
    so = bpy.data.objects.new("s", sun)
    scene.collection.objects.link(so)
    so.rotation_euler = (math.radians(50), 0, math.radians(-40))
    os.makedirs(ART + "work/preview", exist_ok=True)
    scene.render.filepath = ART + f"work/preview/{label}-{name}.png"
    bpy.ops.render.render(write_still=True)


if __name__ == "__main__":
    args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    if args[:1] == ["--preview"]:
        preview(args[1], float(args[2]))
    else:
        only = args or list(CLASSES)
        for name in only:
            if name == "animations":
                continue
            export_character(name, assemble(name, CLASSES[name]))
        if not args or "animations" in args:
            build_animations()
