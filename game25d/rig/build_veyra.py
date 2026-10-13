# Builds a stand-in 3D Veyra, rigs and animates her, simulates the poncho as cloth, and renders side-on frames:
# an albedo pass (colour, soft occlusion, ink outlines) and a normal pass (so the game can light her).
# Run: <blender-python> build_veyra.py <out_dir>
# Units are metres; she faces +X; the camera looks along +Y from -Y.
import bpy, bmesh, math, sys, os, addon_utils
from mathutils import Vector

OUT = sys.argv[-1] if len(sys.argv) > 1 and not sys.argv[-1].endswith('.py') else '/tmp/veyra'
os.makedirs(OUT, exist_ok=True)
addon_utils.enable('cycles', default_set=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
addon_utils.enable('cycles', default_set=True)
S = bpy.context.scene
S.render.fps, S.render.fps_base = 100, 3          # 33.3 fps: one run cycle (two footsteps, 0.36 s) = 12 frames
S.frame_start, S.frame_end = 1, 230

HERE = os.path.dirname(os.path.abspath(__file__))

# ---------------- materials ----------------
def mat(name, rgb, rough=.8, image=None, noise=0.0):
    m = bpy.data.materials.new(name); m.use_nodes = True; nt = m.node_tree; nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial'); em = nt.nodes.new('ShaderNodeEmission')
    ao = nt.nodes.new('ShaderNodeAmbientOcclusion'); ao.inputs['Distance'].default_value = .18; ao.samples = 8
    ramp = nt.nodes.new('ShaderNodeMapRange'); ramp.inputs['To Min'].default_value = .5; ramp.inputs['To Max'].default_value = 1.0
    mul = nt.nodes.new('ShaderNodeMix'); mul.data_type = 'RGBA'; mul.blend_type = 'MULTIPLY'; mul.inputs['Factor'].default_value = 1.0
    if image:
        tex = nt.nodes.new('ShaderNodeTexImage'); tex.image = bpy.data.images.load(image); src = tex.outputs['Color']
    else:
        rgbn = nt.nodes.new('ShaderNodeRGB'); rgbn.outputs[0].default_value = (*rgb, 1); src = rgbn.outputs[0]
    if noise:
        nz = nt.nodes.new('ShaderNodeTexNoise'); nz.inputs['Scale'].default_value = 60; nz.inputs['Detail'].default_value = 6
        mr = nt.nodes.new('ShaderNodeMapRange'); mr.inputs['To Min'].default_value = 1 - noise; mr.inputs['To Max'].default_value = 1 + noise
        nt.links.new(nz.outputs['Fac'], mr.inputs['Value'])
        m2 = nt.nodes.new('ShaderNodeMix'); m2.data_type = 'RGBA'; m2.blend_type = 'MULTIPLY'; m2.inputs['Factor'].default_value = 1
        nt.links.new(src, m2.inputs['A']); nt.links.new(mr.outputs['Result'], m2.inputs['B']); src = m2.outputs['Result']
    nt.links.new(src, mul.inputs['A']); nt.links.new(ao.outputs['AO'], ramp.inputs['Value']); nt.links.new(ramp.outputs['Result'], mul.inputs['B'])
    nt.links.new(mul.outputs['Result'], em.inputs['Color']); nt.links.new(em.outputs[0], out.inputs['Surface'])
    return m

def srgb(h): h = h.lstrip('#'); c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]; return tuple(((x + .055) / 1.055) ** 2.4 if x > .04045 else x / 12.92 for x in c)

M = {
    'skin': mat('skin', srgb('#c49a7c')), 'hair': mat('hair', srgb('#0e0d0e')), 'pants': mat('pants', srgb('#2b2927'), noise=.15),
    'boot': mat('boot', srgb('#231c17')), 'cuff': mat('cuff', srgb('#7a4a22')), 'wrap': mat('wrap', srgb('#e6ddcd'), noise=.12),
    'eye': mat('eye', srgb('#050505')),
    'band': mat('band', srgb('#b5652a')),
}

# The poncho cloth: dark woven brown-grey with an amber geometric hem (as on the reference sheets).
def poncho_texture(path):
    W, H = 1024, 512; px = [0.0] * (W * H * 4)
    hx = lambda h: tuple(int(h[i:i + 2], 16) / 255 for i in (1, 3, 5))
    base, amber = hx('#4a4440'), hx('#c8732e')   # stored as sRGB; the image is read as sRGB
    def put(x, y, c):
        i = (y * W + x) * 4; px[i:i + 4] = [c[0], c[1], c[2], 1]
    for y in range(H):
        v = y / H                                   # v = 1 at the hem
        for x in range(W):
            u = x / W; c = base
            in1 = .885 < v < .9 or .965 < v < .978
            tri = abs((u * 64) % 1 - .5) * 2        # zigzag between the two lines
            zz = .9 + .065 * tri; in2 = abs(v - zz) < .006
            if in1 or in2: c = amber
            put(x, y, c)
    img = bpy.data.images.new('poncho_tex', W, H); img.pixels = px; img.filepath_raw = path; img.file_format = 'PNG'; img.save()
poncho_texture(os.path.join(OUT, 'poncho_tex.png'))
M['poncho'] = mat('poncho2', None, image=os.path.join(OUT, 'poncho_tex.png'), noise=.18)

# ---------------- rig: a hierarchy of joints (empties) rotating in the side plane ----------------
def joint(name, loc, parent=None):
    e = bpy.data.objects.new(name, None); e.empty_display_size = .03; S.collection.objects.link(e)
    if parent: e.parent = parent; e.location = Vector(loc) - parent.matrix_world.translation
    else: e.location = loc
    bpy.context.view_layer.update(); return e

def part(kind, name, parent, m, **kw):
    if kind == 'cyl':
        bpy.ops.mesh.primitive_cylinder_add(vertices=16, radius=kw['r'], depth=kw['len'], location=(0, 0, 0))
        o = bpy.context.object; o.data.transform(__import__('mathutils').Matrix.Translation((0, 0, -kw['len'] / 2)))
        if 'r2' in kw:   # taper
            for v in o.data.vertices:
                k = -v.co.z / kw['len']; s = (kw['r'] + (kw['r2'] - kw['r']) * k) / kw['r']; v.co.x *= s; v.co.y *= s
    elif kind == 'sph':
        bpy.ops.mesh.primitive_uv_sphere_add(segments=20, ring_count=12, radius=kw['r'], location=(0, 0, 0)); o = bpy.context.object
    o.name = name; o.data.materials.append(m)
    if 'scale' in kw: o.scale = kw['scale']
    o.parent = parent; o.location = kw.get('off', (0, 0, 0)); o.rotation_euler = kw.get('rot', (0, 0, 0))
    bpy.ops.object.shade_smooth(); return o

root = joint('root', (0, 0, .95))
hips = joint('hips', (0, 0, .95), root)
chest = joint('chest', (0, 0, 1.22), hips)
neck = joint('neck', (0, 0, 1.44), chest)
head = joint('head', (0, 0, 1.50), neck)
J = {}
for side, sy in (('L', 1), ('R', -1)):
    J['sh' + side] = joint('shoulder' + side, (0, .17 * sy, 1.38), chest)
    J['el' + side] = joint('elbow' + side, (0, .19 * sy, 1.12), J['sh' + side])
    J['wr' + side] = joint('wrist' + side, (0, .19 * sy, .9), J['el' + side])
    J['hp' + side] = joint('hip' + side, (0, .085 * sy, .92), hips)
    J['kn' + side] = joint('knee' + side, (0, .085 * sy, .5), J['hp' + side])
    J['an' + side] = joint('ankle' + side, (0, .085 * sy, .08), J['kn' + side])

# body
torso = part('cyl', 'torso', hips, M['pants'], r=.13, len=.32, off=(0, 0, .3), scale=(1, 1.25, 1))
chestM = part('cyl', 'chestM', chest, M['pants'], r=.15, len=.3, off=(0, 0, .2), scale=(.85, 1.2, 1))
part('cyl', 'neckM', neck, M['skin'], r=.045, len=.1, off=(0, 0, .08))
skull = part('sph', 'skull', head, M['skin'], r=.105, off=(0.0, 0, .1), scale=(1.05, .9, 1.12))
part('sph', 'jaw', head, M['skin'], r=.07, off=(.04, 0, .04), scale=(1, .85, .9))
part('sph', 'nose', head, M['skin'], r=.018, off=(.112, 0, .1), scale=(1.2, .8, 1.3))
part('sph', 'eyeL', head, M['eye'], r=.012, off=(.098, .04, .125), scale=(.5, 1, .55))
part('sph', 'eyeR', head, M['eye'], r=.012, off=(.098, -.04, .125), scale=(.5, 1, .55))
part('sph', 'hairCap', head, M['hair'], r=.112, off=(-.04, 0, .13), scale=(1.0, .95, 1.02))
part('sph', 'bun', head, M['hair'], r=.055, off=(-.04, 0, .245), scale=(1, 1, .85))
part('cyl', 'strand1', head, M['hair'], r=.008, r2=.003, len=.16, off=(.06, .07, .17), rot=(.25, -.2, 0))
part('cyl', 'strand2', head, M['hair'], r=.008, r2=.003, len=.14, off=(.05, -.07, .17), rot=(-.25, -.15, 0))
part('cyl', 'pin', head, M['band'], r=.006, len=.16, off=(-.1, 0, .27), rot=(0, -1.0, 0))
for side in 'LR':
    upper = part('cyl', 'upper' + side, J['sh' + side], M['pants'], r=.048, r2=.04, len=.26)
    part('sph', 'shBall' + side, J['sh' + side], M['pants'], r=.055)
    part('cyl', 'fore' + side, J['el' + side], M['wrap'], r=.04, r2=.032, len=.22)
    part('sph', 'elBall' + side, J['el' + side], M['wrap'], r=.042)
    part('sph', 'hand' + side, J['wr' + side], M['wrap'], r=.04, off=(0, 0, -.05), scale=(1, .7, 1.25))
    part('cyl', 'thigh' + side, J['hp' + side], M['pants'], r=.085, r2=.065, len=.43)
    part('sph', 'knBall' + side, J['kn' + side], M['pants'], r=.064)
    part('cyl', 'shin' + side, J['kn' + side], M['pants'], r=.06, r2=.045, len=.32)
    part('cyl', 'bootTop' + side, J['kn' + side], M['cuff'], r=.068, r2=.062, len=.08, off=(0, 0, -.24))
    part('cyl', 'boot' + side, J['an' + side], M['boot'], r=.052, len=.18, off=(0, 0, .1))
    part('sph', 'foot' + side, J['an' + side], M['boot'], r=.06, off=(.05, 0, -.035), scale=(2.0, .9, .65))

# collision for the cloth
for n in ['torso', 'chestM', 'upperL', 'upperR', 'thighL', 'thighR', 'shBallL', 'shBallR', 'skull']:
    o = bpy.data.objects[n]; c = o.modifiers.new('col', 'COLLISION'); o.collision.thickness_outer = .012; o.collision.cloth_friction = 5

# ---------------- the poncho (cloth, pinned at the collar) ----------------
def make_poncho():
    me = bpy.data.meshes.new('poncho'); bm = bmesh.new(); uvl = bm.loops.layers.uv.new()
    NT, NR = 72, 26
    def L(th):   # a square cloth turned so its corners hang front, back and to each side
        t = th - math.pi / 4; return .56 / max(abs(math.cos(t)), abs(math.sin(t)))
    verts = []
    for j in range(NR + 1):
        row = []
        for i in range(NT):
            th = 2 * math.pi * i / NT; rho = L(th) * j / NR
            r = .1 + rho * .62; z = 1.47 - rho * .78
            v = bm.verts.new((math.cos(th) * r * 1.0, math.sin(th) * r * 1.25, z)); row.append((v, th, j / NR))
        verts.append(row)
    bm.verts.ensure_lookup_table()
    for j in range(NR):
        for i in range(NT):
            a, b = verts[j][i], verts[j][(i + 1) % NT]; c, d = verts[j + 1][(i + 1) % NT], verts[j + 1][i]
            f = bm.faces.new((a[0], b[0], c[0], d[0]))
            for loop, (vv, th, v) in zip(f.loops, (a, b, c, d)):
                u = (i + (1 if vv is b[0] or vv is c[0] else 0)) / NT
                loop[uvl].uv = (u, v)
    bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new('poncho', me); S.collection.objects.link(o); o.data.materials.append(M['poncho'])
    o.parent = chest; o.location = -chest.matrix_world.translation
    vg = o.vertex_groups.new(name='pin'); vg.add([k for k in range(NT * 2)], 1.0, 'REPLACE')
    cl = o.modifiers.new('cloth', 'CLOTH'); st = cl.settings
    st.quality = 10; st.mass = .45; st.air_damping = 3.5; st.tension_stiffness = 18; st.compression_stiffness = 18; st.shear_stiffness = 6; st.bending_stiffness = .6
    st.vertex_group_mass = 'pin'; st.pin_stiffness = 1
    cl.collision_settings.distance_min = .012; cl.collision_settings.collision_quality = 4
    cl.point_cache.frame_start, cl.point_cache.frame_end = 1, 230
    so = o.modifiers.new('solid', 'SOLIDIFY'); so.thickness = .008
    sub = o.modifiers.new('sub', 'SUBSURF'); sub.levels = 1; sub.render_levels = 1
    for p in o.data.polygons: p.use_smooth = True
    # the cowl at the neck
    bpy.ops.mesh.primitive_torus_add(major_radius=.1, minor_radius=.045, location=(0, 0, 0)); cw = bpy.context.object; cw.name = 'cowl'
    cw.data.materials.append(M['poncho']); cw.parent = chest; cw.location = (0, 0, .25); cw.scale = (1, 1.15, 1.2); bpy.ops.object.shade_smooth()
    return o
poncho = make_poncho()

# ---------------- animation ----------------
D = math.radians
def key(obj, f, ry=None, loc=None):
    if ry is not None: obj.rotation_euler = (0, D(ry), 0); obj.keyframe_insert('rotation_euler', frame=f)
    if loc is not None: obj.location = loc; obj.keyframe_insert('location', frame=f)

RUN_P = 12; SPEED = 4.6 / 33.333     # metres per frame
X = {'x': 0.0}
def pose(f, hipL, kneeL, hipR, kneeR, shL, elL, shR, elR, lean=0, nod=0, bob=0, dz=0):
    # positive rotation about Y swings a limb backward (its lower end toward -X)
    for side, hp, kn, sh, el in (('L', hipL, kneeL, shL, elL), ('R', hipR, kneeR, shR, elR)):
        key(J['hp' + side], f, -hp); key(J['kn' + side], f, kn); key(J['an' + side], f, -kn * .35 + hp * .2)
        key(J['sh' + side], f, -sh); key(J['el' + side], f, -el)
    key(chest, f, lean); key(hips, f, lean * .4); key(head, f, -lean * .25 + nod)
    key(root, f, loc=(X['x'], 0, .95 + bob + dz))

# 1-60 stand and let the poncho settle, with breathing
for f in range(1, 61, 2):
    b = math.sin(f / 60 * 2 * math.pi * 1.5)
    pose(f, 2, 4, -2, 4, -4 + b, 12, 4 - b, 12, lean=1.5 + b * .8, nod=b * .6, bob=-.004 + b * .004)
# 61-70 start running (ease into the cycle)
# 70-178 run
for f in range(61, 181):
    ph = 2 * math.pi * (f - 70) / RUN_P; k = min(1, max(0, (f - 61) / 9))
    X['x'] += SPEED * k
    s = math.sin(ph)
    hipL, hipR = 38 * s, -38 * s
    kneeL = 12 + 78 * max(0, math.sin(ph - .9)) ** 1.2; kneeR = 12 + 78 * max(0, math.sin(ph + math.pi - .9)) ** 1.2
    pose(f, hipL * k + 2, kneeL * k + 4 * (1 - k), hipR * k - 2, kneeR * k + 4 * (1 - k), -30 * s * k, 55 * k + 12, 30 * s * k, 55 * k + 12,
         lean=10 * k, bob=(.035 * math.cos(2 * ph) - .02) * k)
# 181-206 jump: crouch, rise, apex, fall, land
JUMP = [(181, 'crouch'), (184, 'rise'), (190, 'rise2'), (195, 'apex'), (200, 'fall'), (205, 'fall2'), (209, 'land'), (213, 'recover')]
Y = {'crouch': 0, 'rise': .25, 'rise2': .75, 'apex': .95, 'fall': .75, 'fall2': .25, 'land': 0, 'recover': 0}
P = {'crouch': (20, 60, -5, 55, -20, 60, 30, 50, 16, 0, -.1), 'rise': (35, 20, -25, 70, -50, 40, 40, 30, 8, 0, 0), 'rise2': (45, 70, -20, 40, -60, 30, 50, 30, 6, 0, 0),
     'apex': (40, 90, 10, 80, -40, 40, 40, 40, 10, 0, 0), 'fall': (20, 40, -10, 30, -70, 20, 70, 20, 4, 0, 0), 'fall2': (10, 20, -15, 25, -80, 15, 80, 15, 0, 0, 0),
     'land': (25, 70, 5, 70, -10, 60, 20, 60, 22, 0, -.14), 'recover': (8, 20, -4, 20, -6, 30, 10, 30, 8, 0, -.03)}
for f in range(181, 231):
    X['x'] += SPEED * (.85 if f < 211 else .6 * max(0, 1 - (f - 211) / 10))
    # interpolate between named poses
    prev = max([p for p in JUMP if p[0] <= f], key=lambda p: p[0]); nxt = min([p for p in JUMP if p[0] > f] or [JUMP[-1]], key=lambda p: p[0])
    t = 0 if nxt[0] == prev[0] else (f - prev[0]) / (nxt[0] - prev[0]); t = t * t * (3 - 2 * t)
    a, b = P[prev[1]], P[nxt[1]]; v = [a[i] + (b[i] - a[i]) * t for i in range(11)]
    y = Y[prev[1]] + (Y[nxt[1]] - Y[prev[1]]) * t
    pose(f, *v[:8], lean=v[8], bob=v[10], dz=y * .42)

for o in bpy.data.objects:
    if o.animation_data and o.animation_data.action:
        for fc in o.animation_data.action.fcurves if hasattr(o.animation_data.action, 'fcurves') else []:
            for kp in fc.keyframe_points: kp.interpolation = 'BEZIER'

# ---------------- camera follows her (x always; height only during the jump, so the feet anchor stays fixed) ----------------
cam_data = bpy.data.cameras.new('cam'); cam_data.type = 'ORTHO'; cam_data.ortho_scale = 2.6
cam = bpy.data.objects.new('cam', cam_data); S.collection.objects.link(cam); S.camera = cam
cam.rotation_euler = (D(90), 0, 0)
for f in range(1, 231):
    S.frame_set(f); rz = root.matrix_world.translation.z
    jz = 0 if f < 184 or f > 208 else max(0, rz - .95)
    cam.location = (root.matrix_world.translation.x, -10, 1.0 + jz); cam.keyframe_insert('location', frame=f)

# ---------------- render settings ----------------
R = S.render; R.engine = 'CYCLES'; S.cycles.device = 'CPU'; S.cycles.samples = 12; S.cycles.use_denoising = False
R.resolution_x, R.resolution_y = 300, 360; R.film_transparent = True; R.image_settings.file_format = 'PNG'; R.image_settings.color_mode = 'RGBA'
S.cycles.max_bounces = 0; S.cycles.pixel_filter_type = 'BLACKMAN_HARRIS'
R.use_freestyle = True; R.line_thickness_mode = 'ABSOLUTE'; R.line_thickness = 1.3
vl = S.view_layers[0]; vl.use_freestyle = True
ls = vl.freestyle_settings.linesets[0] if vl.freestyle_settings.linesets else vl.freestyle_settings.linesets.new('ink')
ls.select_by_visibility = True; ls.select_silhouette = True; ls.select_border = True; ls.select_crease = True
ls.linestyle = ls.linestyle or bpy.data.linestyles.new('ink'); ls.linestyle.color = (.02, .02, .025); ls.linestyle.thickness = 1.3

# normals in camera space, encoded 0..1
nm = bpy.data.materials.new('normals'); nm.use_nodes = True; nt = nm.node_tree; nt.nodes.clear()
geo = nt.nodes.new('ShaderNodeNewGeometry'); vt = nt.nodes.new('ShaderNodeVectorTransform'); vt.vector_type = 'NORMAL'; vt.convert_from = 'WORLD'; vt.convert_to = 'CAMERA'
mm = nt.nodes.new('ShaderNodeVectorMath'); mm.operation = 'MULTIPLY_ADD'; mm.inputs[1].default_value = (.5, .5, -.5); mm.inputs[2].default_value = (.5, .5, .5)
em = nt.nodes.new('ShaderNodeEmission'); out = nt.nodes.new('ShaderNodeOutputMaterial')
nt.links.new(geo.outputs['Normal'], vt.inputs[0]); nt.links.new(vt.outputs[0], mm.inputs[0]); nt.links.new(mm.outputs[0], em.inputs['Color']); nt.links.new(em.outputs[0], out.inputs['Surface'])

# bake the cloth
print('baking cloth...');
with bpy.context.temp_override(scene=S, active_object=poncho, point_cache=poncho.modifiers['cloth'].point_cache):
    bpy.ops.ptcache.bake(bake=True)
print('baked')

FRAMES = {'idle': list(range(36, 60, 2)), 'run': list(range(118, 130)), 'jump': [184, 188, 192, 195, 199, 203, 207], 'land': [210, 212, 215]}
import json; json.dump(FRAMES, open(os.path.join(OUT, 'frames.json'), 'w'))
only = os.environ.get('ONLY')
for pass_ in ('albedo', 'normal'):
    if pass_ == 'albedo': S.view_settings.view_transform = 'Standard'; vl.material_override = None; R.use_freestyle = True
    else: S.view_settings.view_transform = 'Raw'; vl.material_override = nm; R.use_freestyle = False; S.cycles.samples = 4
    for name, fl in FRAMES.items():
        if only and name not in only.split(','): continue
        for i, f in enumerate(fl):
            S.frame_set(f); R.filepath = os.path.join(OUT, f'{pass_}_{name}_{i:02d}.png'); bpy.ops.render.render(write_still=True)
print('done')
