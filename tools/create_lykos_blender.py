import bpy
import math
import os

# Run: blender --background --python tools/create_lykos_blender.py
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUTPUT = os.path.join(ROOT, "prototypes", "pixi3d-companion", "public", "assets", "lykos.glb")
os.makedirs(os.path.dirname(OUTPUT), exist_ok=True)

bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)

def mat(name, color, roughness=0.75, metallic=0.0):
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*color, 1)
    m.use_nodes = True
    shader = m.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = (*color, 1)
    shader.inputs["Roughness"].default_value = roughness
    shader.inputs["Metallic"].default_value = metallic
    return m

amber = mat("Amber fur", (0.82, 0.25, 0.055))
cream = mat("Cream fur", (0.96, 0.83, 0.62))
inner = mat("Ear accents", (0.30, 0.10, 0.08))
blue = mat("Blue eyes", (0.035, 0.42, 0.82), 0.2)
black = mat("Nose and pupils", (0.015, 0.02, 0.03), 0.25)
green = mat("Travel satchel", (0.12, 0.31, 0.19))
leather = mat("Leather", (0.28, 0.13, 0.065))
gold = mat("Brass", (0.83, 0.56, 0.17), 0.3, 0.5)

arm_data = bpy.data.armatures.new("LykosRig")
rig = bpy.data.objects.new("LykosRig", arm_data)
bpy.context.collection.objects.link(rig)
bpy.context.view_layer.objects.active = rig
rig.select_set(True)
bpy.ops.object.mode_set(mode="EDIT")

bones = {
    "Root": ((0, 0, 0.1), (0, 0, 0.6), None),
    "Body": ((0, 0, 0.6), (0, 0, 1.2), "Root"),
    "Head": ((0, 0, 1.15), (0, 0, 1.65), "Body"),
    "Tail": ((0, 0.3, 0.8), (0, 0.9, 0.95), "Body"),
    "Front_L": ((-0.22, -0.3, 0.78), (-0.22, -0.3, 0.15), "Body"),
    "Front_R": ((0.22, -0.3, 0.78), (0.22, -0.3, 0.15), "Body"),
    "Back_L": ((-0.22, 0.32, 0.72), (-0.22, 0.32, 0.15), "Body"),
    "Back_R": ((0.22, 0.32, 0.72), (0.22, 0.32, 0.15), "Body"),
}
edit = {}
for name, (head, tail, parent) in bones.items():
    b = arm_data.edit_bones.new(name)
    b.head, b.tail = head, tail
    if parent:
        b.parent = edit[parent]
    edit[name] = b
bpy.ops.object.mode_set(mode="OBJECT")
rig.select_set(False)

def attach(obj, bone):
    group = obj.vertex_groups.new(name=bone)
    group.add([v.index for v in obj.data.vertices], 1.0, "REPLACE")
    mod = obj.modifiers.new("Lykos skin", "ARMATURE")
    mod.object = rig
    return obj

def sphere(name, pos, scale, material, bone, segments=16):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=12, location=pos)
    o = bpy.context.object
    o.name = name
    o.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    o.data.materials.append(material)
    for p in o.data.polygons:
        p.use_smooth = True
    return attach(o, bone)

def cone(name, pos, radius, depth, material, bone, rotation=(0, 0, 0)):
    bpy.ops.mesh.primitive_cone_add(vertices=12, radius1=radius, radius2=0.015, depth=depth, location=pos, rotation=rotation)
    o = bpy.context.object
    o.name = name
    o.data.materials.append(material)
    bevel = o.modifiers.new("Soft edges", "BEVEL")
    bevel.width = 0.025
    bevel.segments = 2
    o.modifiers.new("Normals", "WEIGHTED_NORMAL")
    return attach(o, bone)

# Torso and chest
sphere("Body amber", (0, 0, 0.92), (0.43, 0.67, 0.40), amber, "Body", 24)
sphere("Cream chest", (0, -0.43, 0.91), (0.30, 0.22, 0.34), cream, "Body")
sphere("Cream belly", (0, -0.02, 0.68), (0.30, 0.48, 0.19), cream, "Body")

# Head and face
sphere("Head", (0, -0.52, 1.46), (0.39, 0.34, 0.36), amber, "Head", 24)
sphere("Muzzle", (0, -0.83, 1.34), (0.23, 0.18, 0.14), cream, "Head")
sphere("Nose", (0, -0.99, 1.38), (0.075, 0.05, 0.05), black, "Head")
for side, label in [(-1, "L"), (1, "R")]:
    x = side * 0.25
    cone("Ear " + label, (x, -0.48, 1.81), 0.16, 0.46, amber, "Head", (0, side * -0.12, 0))
    sphere("Ear inset " + label, (x, -0.54, 1.79), (0.075, 0.035, 0.17), inner, "Head")
    sphere("Eye white " + label, (side * 0.16, -0.81, 1.51), (0.105, 0.05, 0.125), cream, "Head")
    sphere("Iris " + label, (side * 0.16, -0.86, 1.51), (0.065, 0.025, 0.08), blue, "Head")
    sphere("Pupil " + label, (side * 0.16, -0.885, 1.51), (0.03, 0.015, 0.05), black, "Head")

# Legs and paws
for label, x, y, bone in [
    ("Front_L", -0.22, -0.30, "Front_L"), ("Front_R", 0.22, -0.30, "Front_R"),
    ("Back_L", -0.22, 0.32, "Back_L"), ("Back_R", 0.22, 0.32, "Back_R")
]:
    sphere(label + " leg", (x, y, 0.46), (0.12, 0.15, 0.34), amber, bone)
    sphere(label + " paw", (x, y - 0.04, 0.16), (0.15, 0.19, 0.10), cream, bone)

# Fluffy tail and pale tip
sphere("Tail amber", (0, 0.70, 0.91), (0.29, 0.48, 0.28), amber, "Tail")
sphere("Tail cream tip", (0, 1.02, 1.02), (0.22, 0.24, 0.21), cream, "Tail")

# Satchel and clasp
sphere("Satchel", (0.30, 0.18, 1.02), (0.20, 0.15, 0.23), green, "Body")
sphere("Satchel flap", (0.30, 0.045, 1.15), (0.17, 0.035, 0.09), leather, "Body")
sphere("Brass clasp", (0.30, 0.005, 1.13), (0.035, 0.02, 0.04), gold, "Body", 12)

def make_action(name, frames):
    action = bpy.data.actions.new(name)
    rig.animation_data_create()
    rig.animation_data.action = action
    for frame, pose in frames:
        for bone_name, rotation in pose.items():
            pb = rig.pose.bones[bone_name]
            pb.rotation_mode = "XYZ"
            pb.rotation_euler = rotation
            pb.keyframe_insert(data_path="rotation_euler", frame=frame, group=bone_name)
    for curve in action.fcurves:
        for key in curve.keyframe_points:
            key.interpolation = "BEZIER"
    action.use_fake_user = True
    return action

idle = make_action("Idle", [
    (1, {"Body": (0, 0, 0), "Head": (0, 0, 0), "Tail": (0.05, 0, -0.12)}),
    (12, {"Body": (0.025, 0, 0), "Head": (0.02, 0, 0.035), "Tail": (-0.03, 0, 0.12)}),
    (24, {"Body": (0, 0, 0), "Head": (0, 0, 0), "Tail": (0.05, 0, -0.12)}),
])
walk = make_action("Walk", [
    (1, {"Front_L": (0.48, 0, 0), "Front_R": (-0.48, 0, 0), "Back_L": (-0.42, 0, 0), "Back_R": (0.42, 0, 0), "Body": (0.025, 0, 0)}),
    (7, {"Front_L": (-0.48, 0, 0), "Front_R": (0.48, 0, 0), "Back_L": (0.42, 0, 0), "Back_R": (-0.42, 0, 0), "Body": (-0.025, 0, 0)}),
    (13, {"Front_L": (0.48, 0, 0), "Front_R": (-0.48, 0, 0), "Back_L": (-0.42, 0, 0), "Back_R": (0.42, 0, 0), "Body": (0.025, 0, 0)}),
    (19, {"Front_L": (-0.48, 0, 0), "Front_R": (0.48, 0, 0), "Back_L": (0.42, 0, 0), "Back_R": (-0.42, 0, 0), "Body": (-0.025, 0, 0)}),
    (25, {"Front_L": (0.48, 0, 0), "Front_R": (-0.48, 0, 0), "Back_L": (-0.42, 0, 0), "Back_R": (0.42, 0, 0), "Body": (0.025, 0, 0)}),
])
run = make_action("Run", [
    (1, {"Front_L": (0.85, 0, 0), "Front_R": (-0.85, 0, 0), "Back_L": (-0.75, 0, 0), "Back_R": (0.75, 0, 0), "Body": (0.10, 0, 0)}),
    (5, {"Front_L": (-0.85, 0, 0), "Front_R": (0.85, 0, 0), "Back_L": (0.75, 0, 0), "Back_R": (-0.75, 0, 0), "Body": (-0.10, 0, 0)}),
    (9, {"Front_L": (0.85, 0, 0), "Front_R": (-0.85, 0, 0), "Back_L": (-0.75, 0, 0), "Back_R": (0.75, 0, 0), "Body": (0.10, 0, 0)}),
])

rig.animation_data.action = None
for action in (idle, walk, run):
    track = rig.animation_data.nla_tracks.new()
    track.name = action.name
    strip = track.strips.new(action.name, 1, action)
    strip.action_frame_start = action.frame_range[0]
    strip.action_frame_end = action.frame_range[1]
    strip.blend_type = "REPLACE"

bpy.context.scene.frame_set(1)
bpy.ops.object.select_all(action="DESELECT")
rig.select_set(True)
bpy.context.view_layer.objects.active = rig
bpy.ops.export_scene.gltf(
    filepath=OUTPUT,
    export_format="GLB",
    export_animations=True,
    export_nla_strips=True,
    export_skins=True,
)
print("Exported Lykos model to: " + OUTPUT)
