# Renders front, side and back views of an imported model (for checking a new model).
import bpy, sys, glob, math, addon_utils
src, out = sys.argv[-2], sys.argv[-1]
bpy.ops.wm.read_factory_settings(use_empty=True); addon_utils.enable('cycles', default_set=True)
bpy.ops.import_scene.gltf(filepath=src)
S = bpy.context.scene; S.render.engine = 'CYCLES'; S.cycles.samples = 16; S.cycles.device = 'CPU'
S.render.resolution_x, S.render.resolution_y = 400, 600; S.render.film_transparent = False
w = bpy.data.worlds.new('w'); S.world = w; w.use_nodes = True; w.node_tree.nodes['Background'].inputs[0].default_value = (.5, .52, .55, 1); w.node_tree.nodes['Background'].inputs[1].default_value = 1.5
cd = bpy.data.cameras.new('c'); cd.type = 'ORTHO'; cd.ortho_scale = 2.2; cam = bpy.data.objects.new('c', cd); S.collection.objects.link(cam); S.camera = cam
for name, ang in (('front', 0), ('side', 90), ('back', 180)):
    a = math.radians(ang); cam.location = (5 * math.sin(a), -5 * math.cos(a), .95); cam.rotation_euler = (math.radians(90), 0, a)
    S.render.filepath = f'{out}_{name}.png'; bpy.ops.render.render(write_still=True)
