# Rigs and animates a Meshy model of Veyra (A-pose, facing -Y, centred on the origin as Meshy exports it),
# then renders the same frames as build_veyra.py: colour (with soft occlusion and ink lines) and normals.
# Run: <blender-python> build_meshy.py <model.glb> <out_dir>
import bpy, math, sys, os, json, addon_utils
import numpy as np
from mathutils import Vector, Quaternion, Matrix

SRC, OUT = sys.argv[-2], sys.argv[-1]
os.makedirs(OUT, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True); addon_utils.enable('cycles', default_set=True)
S = bpy.context.scene; S.render.fps, S.render.fps_base = 100, 3; S.frame_start, S.frame_end = 1, 230
bpy.ops.import_scene.gltf(filepath=SRC)
body = [o for o in bpy.data.objects if o.type == 'MESH'][0]
for o in list(bpy.data.objects):
    if o is not body and o.type != 'MESH': o.select_set(False)

# ---------- normalise: 1.75 m tall, feet on z = 0, facing +X ----------
co = np.empty(len(body.data.vertices) * 3); body.data.vertices.foreach_get('co', co); co = co.reshape(-1, 3)
mn, mx = co.min(0), co.max(0); SC = 1.75 / (mx[2] - mn[2])
def T(p):   # model coordinates (x width, y depth with the face toward -y, z up) to scene coordinates
    x, y, z = p; return Vector((-y * SC, x * SC, (z - mn[2]) * SC))
M = Matrix.Translation((0, 0, -mn[2] * SC)) @ Matrix.Rotation(math.radians(90), 4, 'Z') @ Matrix.Scale(SC, 4)
body.data.transform(M); body.matrix_world = Matrix.Identity(4); body.data.update()

# ---------- fewer polygons (the texture carries the detail at this size) ----------
dec = body.modifiers.new('dec', 'DECIMATE'); dec.ratio = 90000 / max(1, len(body.data.polygons))
bpy.context.view_layer.objects.active = body; body.select_set(True); bpy.ops.object.modifier_apply(modifier='dec')
print('faces', len(body.data.polygons))

# ---------- skeleton (landmarks measured from the model, in model coordinates) ----------
SK = {   # name: (head, tail, parent)
    'hips': ((0, 0, -.06), (0, 0, .28), None),
    'chest': ((0, 0, .28), (0, 0, .6), 'hips'),
    'neck': ((0, 0, .6), (0, 0, .68), 'chest'),
    'head': ((0, 0, .68), (0, 0, .95), 'neck'),
}
for s, sx in (('L', 1), ('R', -1)):
    SK.update({
        'upper' + s: ((.17 * sx, 0, .5), (.33 * sx, 0, .26), 'chest'),
        'fore' + s: ((.33 * sx, 0, .26), (.46 * sx, 0, .06), 'upper' + s),
        'hand' + s: ((.46 * sx, 0, .06), (.51 * sx, 0, -.05), 'fore' + s),
        'thigh' + s: ((.1 * sx, 0, -.06), (.15 * sx, -.01, -.47), 'hips'),
        'shin' + s: ((.15 * sx, -.01, -.47), (.17 * sx, 0, -.86), 'thigh' + s),
        'foot' + s: ((.17 * sx, 0, -.86), (.18 * sx, -.15, -.93), 'shin' + s),
    })
# the poncho's skirt, hanging from the chest: front, back and each side, so it can trail and lift
SKIRT = {'skirtF': (0, -1), 'skirtB': (0, 1), 'skirtL': (1, 0), 'skirtR': (-1, 0)}
for n, (dx, dy) in SKIRT.items(): SK[n] = ((dx * .12, dy * .1, .45), (dx * .34, dy * .26, -.35), 'chest')

arm_d = bpy.data.armatures.new('rig'); arm = bpy.data.objects.new('rig', arm_d); S.collection.objects.link(arm)
bpy.context.view_layer.objects.active = arm; bpy.ops.object.mode_set(mode='EDIT')
for n, (h, t, par) in SK.items():
    b = arm_d.edit_bones.new(n); b.head = T(h); b.tail = T(t); b.roll = 0
    if par: b.parent = arm_d.edit_bones[par]
bpy.ops.object.mode_set(mode='OBJECT')

# ---------- weights: nearest bones, with the poncho shell kept off the limbs ----------
V = np.empty(len(body.data.vertices) * 3); body.data.vertices.foreach_get('co', V); V = V.reshape(-1, 3)
segs = {n: (np.array(T(h)), np.array(T(t))) for n, (h, t, _) in SK.items() if not n.startswith('skirt')}
def segdist(P, a, b):
    ab = b - a; t = np.clip(((P - a) @ ab) / (ab @ ab), 0, 1); return np.linalg.norm(P - (a + t[:, None] * ab), axis=1)
names = list(segs); D = np.stack([segdist(V, *segs[n]) for n in names], 1)
# poncho shell: between the knees and the shoulders, away from every limb's axis
limb = [i for i, n in enumerate(names) if n.startswith(('thigh', 'shin', 'upper', 'fore'))]
z = V[:, 2]; shell = (z > .5) & (z < 1.36) & (D[:, limb].min(1) > .085 * SC / .921) & (np.abs(V[:, 1]) < .38 * SC / .921 + .05)
W = 1 / (D + .01) ** 6; W[shell] = 0
idx = {n: i for i, n in enumerate(names)}
# shell: chest at the top, the skirt bones lower down, blended around the body by direction
ang = np.arctan2(V[:, 1], V[:, 0])   # 0 = front (+X), +pi/2 = left (+Y)
low = np.clip((1.3 - z) / .7, 0, 1)
dirw = {'skirtF': np.maximum(0, np.cos(ang)) ** 2, 'skirtB': np.maximum(0, -np.cos(ang)) ** 2, 'skirtL': np.maximum(0, np.sin(ang)) ** 2, 'skirtR': np.maximum(0, -np.sin(ang)) ** 2}
for n in names: body.vertex_groups.new(name=n)
for n in SKIRT: body.vertex_groups.new(name=n)
top = np.argsort(-W, 1)[:, :3]
for vi in range(len(V)):
    if shell[vi]:
        k = low[vi]; body.vertex_groups['chest'].add([vi], 1 - k, 'REPLACE')
        tot = sum(dirw[n][vi] for n in SKIRT) or 1
        for n in SKIRT:
            w = k * dirw[n][vi] / tot
            if w > .01: body.vertex_groups[n].add([vi], w, 'REPLACE')
    else:
        ws = W[vi, top[vi]]; ws = ws / ws.sum()
        for j, w in zip(top[vi], ws):
            if w > .02: body.vertex_groups[names[j]].add([vi], float(w), 'REPLACE')
print('shell verts', int(shell.sum()), 'of', len(V))
mod = body.modifiers.new('arm', 'ARMATURE'); mod.object = arm; body.parent = arm

# ---------- posing: every rotation is about the side axis (world Y), relative to the parent ----------
PB = arm.pose.bones
REST = {b.name: arm_d.bones[b.name].matrix_local.to_quaternion() for b in PB}
for b in PB: b.rotation_mode = 'QUATERNION'
def rot(name, deg, f, axis=(0, 1, 0)):
    qw = Quaternion(Vector(axis), math.radians(deg)); B = REST[name]
    PB[name].rotation_quaternion = B.inverted() @ qw @ B; PB[name].keyframe_insert('rotation_quaternion', frame=f)
X = {'x': 0.0}
def pose(f, hipL, kneeL, hipR, kneeR, shL, elL, shR, elR, lean=0, nod=0, bob=0, dz=0, skirt=(0, 0, 0)):
    # positive values swing a limb forward and bend joints the natural way
    for s, hp, kn, sh, el in (('L', hipL, kneeL, shL, elL), ('R', hipR, kneeR, shR, elR)):
        rot('thigh' + s, -hp, f); rot('shin' + s, kn, f); rot('foot' + s, -kn * .3 + hp * .15, f)
        rot('upper' + s, -sh, f); rot('fore' + s, -el, f); rot('hand' + s, 0, f)
    rot('hips', lean * .4, f); rot('chest', lean * .6, f); rot('neck', -lean * .3, f); rot('head', nod - lean * .2, f)
    trail, lift, flutter = skirt
    rot('skirtB', -trail - lift, f); rot('skirtF', trail * .4 + lift * .6 + flutter, f)
    rot('skirtL', lift * .8 + flutter, f, (1, 0, 0)); rot('skirtR', -lift * .8 - flutter, f, (1, 0, 0))
    arm.location = (X['x'], 0, bob + dz); arm.keyframe_insert('location', frame=f)

D2 = math.radians
for f in range(1, 61, 2):
    b = math.sin(f / 60 * 2 * math.pi * 1.5)
    pose(f, 2, 3, -2, 3, 2 + b, 8, -2 - b, 8, lean=1 + b * .8, nod=b * .6, bob=-.003 + b * .003, skirt=(0, 0, b * 1.5))
RUN_P = 12; SPEED = 4.6 / 33.333
for f in range(61, 181):
    ph = 2 * math.pi * (f - 70) / RUN_P; k = min(1, max(0, (f - 61) / 9)); X['x'] += SPEED * k; s = math.sin(ph)
    kneeL = 12 + 75 * max(0, math.sin(ph - .9)) ** 1.2; kneeR = 12 + 75 * max(0, math.sin(ph + math.pi - .9)) ** 1.2
    pose(f, 36 * s * k + 2, kneeL * k + 3 * (1 - k), -36 * s * k - 2, kneeR * k + 3 * (1 - k), 30 * s * k, 45 * k + 8, -30 * s * k, 45 * k + 8,
         lean=11 * k, bob=(.03 * math.cos(2 * ph) - .015) * k, skirt=(18 * k + 4 * math.sin(2 * ph + 1), 0, 5 * math.sin(2 * ph) * k))
JUMP = [(181, 'crouch'), (184, 'rise'), (190, 'rise2'), (195, 'apex'), (200, 'fall'), (205, 'fall2'), (209, 'land'), (213, 'recover')]
Y = {'crouch': 0, 'rise': .25, 'rise2': .75, 'apex': .95, 'fall': .75, 'fall2': .25, 'land': 0, 'recover': 0}
P = {  # hipL kneeL hipR kneeR shL elL shR elR lean nod bob trail lift
    'crouch': (20, 60, -5, 55, -20, 50, 30, 40, 16, 0, -.1, 10, -8), 'rise': (35, 20, -25, 70, 50, 30, -40, 25, 8, 0, 0, 14, -14),
    'rise2': (45, 70, -20, 40, 60, 25, -50, 25, 6, 0, 0, 12, -10), 'apex': (40, 90, 10, 80, 40, 35, -40, 35, 10, 0, 0, 10, 4),
    'fall': (20, 40, -10, 30, 60, 20, -60, 20, 4, 0, 0, 8, 16), 'fall2': (10, 20, -15, 25, 70, 15, -70, 15, 0, 0, 0, 6, 22),
    'land': (25, 70, 5, 70, 10, 50, -20, 50, 22, 0, -.14, 4, 6), 'recover': (8, 20, -4, 20, 6, 25, -10, 25, 8, 0, -.03, 6, 0)}
for f in range(181, 231):
    X['x'] += SPEED * (.85 if f < 211 else .6 * max(0, 1 - (f - 211) / 10))
    prev = max([p for p in JUMP if p[0] <= f], key=lambda p: p[0]); nxt = min([p for p in JUMP if p[0] > f] or [JUMP[-1]], key=lambda p: p[0])
    t = 0 if nxt[0] == prev[0] else (f - prev[0]) / (nxt[0] - prev[0]); t = t * t * (3 - 2 * t)
    a, b = P[prev[1]], P[nxt[1]]; v = [a[i] + (b[i] - a[i]) * t for i in range(13)]
    yy = Y[prev[1]] + (Y[nxt[1]] - Y[prev[1]]) * t
    pose(f, *v[:8], lean=v[8], nod=v[9], bob=v[10], dz=yy * .42, skirt=(v[11], v[12], 0))

# ---------- materials: the model's own colour texture, flat (the game lights her), with soft occlusion ----------
src_mat = body.data.materials[0]; img = None
for n in src_mat.node_tree.nodes:
    if n.type == 'BSDF_PRINCIPLED':
        l = n.inputs['Base Color'].links
        if l: img = l[0].from_node.image
m = bpy.data.materials.new('albedo'); m.use_nodes = True; nt = m.node_tree; nt.nodes.clear()
out = nt.nodes.new('ShaderNodeOutputMaterial'); em = nt.nodes.new('ShaderNodeEmission'); tex = nt.nodes.new('ShaderNodeTexImage'); tex.image = img
ao = nt.nodes.new('ShaderNodeAmbientOcclusion'); ao.inputs['Distance'].default_value = .12; ao.samples = 8
mr = nt.nodes.new('ShaderNodeMapRange'); mr.inputs['To Min'].default_value = .55; mr.inputs['To Max'].default_value = 1.0
mul = nt.nodes.new('ShaderNodeMix'); mul.data_type = 'RGBA'; mul.blend_type = 'MULTIPLY'; mul.inputs['Factor'].default_value = 1
nt.links.new(tex.outputs['Color'], mul.inputs['A']); nt.links.new(ao.outputs['AO'], mr.inputs['Value']); nt.links.new(mr.outputs['Result'], mul.inputs['B'])
nt.links.new(mul.outputs['Result'], em.inputs['Color']); nt.links.new(em.outputs[0], out.inputs['Surface'])
body.data.materials.clear(); body.data.materials.append(m)

# ---------- camera, render settings and passes (as build_veyra.py) ----------
cam_data = bpy.data.cameras.new('cam'); cam_data.type = 'ORTHO'; cam_data.ortho_scale = 2.6
cam = bpy.data.objects.new('cam', cam_data); S.collection.objects.link(cam); S.camera = cam; cam.rotation_euler = (D2(90), 0, 0)
for f in range(1, 231):
    S.frame_set(f); rz = arm.matrix_world.translation.z
    jz = 0 if f < 184 or f > 208 else max(0, rz)
    cam.location = (arm.matrix_world.translation.x, -10, 1.0 + jz); cam.keyframe_insert('location', frame=f)
R = S.render; R.engine = 'CYCLES'; S.cycles.device = 'CPU'; S.cycles.samples = 12; S.cycles.use_denoising = False; S.cycles.max_bounces = 0
R.resolution_x, R.resolution_y = 300, 360; R.film_transparent = True; R.image_settings.file_format = 'PNG'; R.image_settings.color_mode = 'RGBA'
R.use_freestyle = True; R.line_thickness_mode = 'ABSOLUTE'
vl = S.view_layers[0]; vl.use_freestyle = True
ls = vl.freestyle_settings.linesets[0] if vl.freestyle_settings.linesets else vl.freestyle_settings.linesets.new('ink')
ls.select_by_visibility = True; ls.select_silhouette = True; ls.select_border = False; ls.select_crease = False; ls.select_external_contour = True; ls.select_contour = False
ls.linestyle = ls.linestyle or bpy.data.linestyles.new('ink'); ls.linestyle.color = (.02, .02, .025); ls.linestyle.thickness = 1.1
nm = bpy.data.materials.new('normals'); nm.use_nodes = True; nt = nm.node_tree; nt.nodes.clear()
geo = nt.nodes.new('ShaderNodeNewGeometry'); vt = nt.nodes.new('ShaderNodeVectorTransform'); vt.vector_type = 'NORMAL'; vt.convert_from = 'WORLD'; vt.convert_to = 'CAMERA'
mm = nt.nodes.new('ShaderNodeVectorMath'); mm.operation = 'MULTIPLY_ADD'; mm.inputs[1].default_value = (.5, .5, -.5); mm.inputs[2].default_value = (.5, .5, .5)
em = nt.nodes.new('ShaderNodeEmission'); out = nt.nodes.new('ShaderNodeOutputMaterial')
nt.links.new(geo.outputs['Normal'], vt.inputs[0]); nt.links.new(vt.outputs[0], mm.inputs[0]); nt.links.new(mm.outputs[0], em.inputs['Color']); nt.links.new(em.outputs[0], out.inputs['Surface'])

FRAMES = {'idle': list(range(36, 60, 2)), 'run': list(range(118, 130)), 'jump': [184, 188, 192, 195, 199, 203, 207], 'land': [210, 212, 215]}
json.dump(FRAMES, open(os.path.join(OUT, 'frames.json'), 'w'))
only = os.environ.get('ONLY')
for pass_ in ('albedo', 'normal'):
    if pass_ == 'albedo': S.view_settings.view_transform = 'Standard'; vl.material_override = None; R.use_freestyle = True
    else: S.view_settings.view_transform = 'Raw'; vl.material_override = nm; R.use_freestyle = False; S.cycles.samples = 4
    for name, fl in FRAMES.items():
        if only and name not in only.split(','): continue
        for i, f in enumerate(fl):
            S.frame_set(f); R.filepath = os.path.join(OUT, f'{pass_}_{name}_{i:02d}.png'); bpy.ops.render.render(write_still=True)
print('done')
