# glb.py — prépare un animal de Quaternius pour le jeu.
#
# Les .gltf du pack portent leur tampon en base64 dans le JSON (3,5 Mo le cheval) et treize
# clips dont le jeu n'utilise que quelques-uns. On écrit un .glb binaire avec les seuls clips
# demandés : le cheval passe de 3,6 Mo à 1,5 Mo. Aucune dépendance : le chargement reste court.
#
#   python3 glb.py Horse.gltf cheval.glb Walk,Gallop,Idle,Eating,Death,Idle_HitReact1,Attack_Kick,Idle_Headlow
import base64, json, struct, sys
src, dst, garder = sys.argv[1], sys.argv[2], set(sys.argv[3].split(','))
j = json.load(open(src))
buf = base64.b64decode(j['buffers'][0]['uri'].split(',', 1)[1])
j['animations'] = [a for a in j.get('animations', []) if a['name'] in garder]
# accessoires encore utilisés
used = set()
def walk(o):
    if isinstance(o, dict):
        for k, v in o.items():
            if k in ('input', 'output', 'indices', 'inverseBindMatrices') and isinstance(v, int): used.add(v)
            elif k == 'attributes' or k == 'targets':
                for x in (v if isinstance(v, list) else [v]):
                    for a in x.values(): used.add(a)
            else: walk(v)
    elif isinstance(o, list):
        for x in o: walk(x)
walk({k: v for k, v in j.items() if k not in ('accessors', 'bufferViews')})
acc_map, accs = {}, []
for i, a in enumerate(j['accessors']):
    if i in used: acc_map[i] = len(accs); accs.append(a)
bv_used = sorted({a['bufferView'] for a in accs if 'bufferView' in a})
bv_map, bvs, out = {}, [], bytearray()
for i in bv_used:
    v = dict(j['bufferViews'][i]); off = v.get('byteOffset', 0)
    while len(out) % 4: out.append(0)
    data = buf[off:off + v['byteLength']]
    v['byteOffset'] = len(out); v['buffer'] = 0; out += data
    bv_map[i] = len(bvs); bvs.append(v)
for a in accs:
    if 'bufferView' in a: a['bufferView'] = bv_map[a['bufferView']]
def remap(o):
    if isinstance(o, dict):
        for k, v in list(o.items()):
            if k in ('input', 'output', 'indices', 'inverseBindMatrices') and isinstance(v, int): o[k] = acc_map[v]
            elif k in ('attributes',): o[k] = {n: acc_map[x] for n, x in v.items()}
            elif k == 'targets': o[k] = [{n: acc_map[x] for n, x in t.items()} for t in v]
            else: remap(v)
    elif isinstance(o, list):
        for x in o: remap(x)
for k in list(j.keys()):
    if k not in ('accessors', 'bufferViews', 'buffers'): remap(j[k])
j['accessors'], j['bufferViews'] = accs, bvs
while len(out) % 4: out.append(0)
j['buffers'] = [{'byteLength': len(out)}]
js = json.dumps(j, separators=(',', ':')).encode()
while len(js) % 4: js += b' '
glb = struct.pack('<III', 0x46546C67, 2, 12 + 8 + len(js) + 8 + len(out)) + struct.pack('<II', len(js), 0x4E4F534A) + js + struct.pack('<II', len(out), 0x004E4942) + bytes(out)
open(dst, 'wb').write(glb)
print(dst, len(glb), 'octets ;', [a['name'] for a in j['animations']])
