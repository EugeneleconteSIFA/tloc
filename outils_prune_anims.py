# -*- coding: utf-8 -*-
"""Extrait d'un GLB Quaternius une banque d'animations legere :
   - supprime maillages, peaux, materiaux, images
   - ne garde que les pistes de rotation + translation de root/pelvis
   - supprime les pistes constantes (une seule valeur repetee)
"""
import json, struct, sys, os
import numpy as np

SRC, DST = sys.argv[1], sys.argv[2]
GARDE_TRANS = {'root', 'pelvis'}

raw = open(SRC,'rb').read()
off = 12; js = None; bin_ = b''
while off < len(raw):
    ln, ty = struct.unpack_from('<II', raw, off); off += 8
    chunk = raw[off:off+ln]
    if ty == 0x4E4F534A: js = json.loads(chunk)
    else: bin_ = chunk
    off += ln
g = js

COMP = {5120:('b',1),5121:('B',1),5122:('h',2),5123:('H',2),5125:('I',4),5126:('f',4)}
NUM  = {'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT4':16}
DT   = {5120:np.int8,5121:np.uint8,5122:np.int16,5123:np.uint16,5125:np.uint32,5126:np.float32}

def lire(idx):
    a = g['accessors'][idx]
    bv = g['bufferViews'][a['bufferView']]
    n = NUM[a['type']]; dt = DT[a['componentType']]
    base = bv.get('byteOffset',0) + a.get('byteOffset',0)
    stride = bv.get('byteStride') or (np.dtype(dt).itemsize * n)
    cnt = a['count']
    out = np.empty((cnt, n), dt)
    for i in range(cnt):
        o = base + i*stride
        out[i] = np.frombuffer(bin_, dt, n, o)
    return out

noms = {i: nd.get('name') for i, nd in enumerate(g['nodes'])}

blob = bytearray(); bviews = []; accs = []
def pousser(arr, typ):
    global blob
    arr = np.ascontiguousarray(arr.astype(np.float32))
    while len(blob) % 4: blob.append(0)
    o = len(blob); blob += arr.tobytes()
    bviews.append({'buffer':0,'byteOffset':o,'byteLength':arr.nbytes})
    a = {'bufferView':len(bviews)-1,'componentType':5126,'count':arr.shape[0],
         'type':typ}
    if typ=='SCALAR':
        a['min']=[float(arr.min())]; a['max']=[float(arr.max())]
    accs.append(a); return len(accs)-1

anims = []; stats = []
for a in g['animations']:
    ech = {}   # (accessor temps) -> nouvel index
    chans = []; samps = []
    for ch in a['channels']:
        path = ch['target']['path']
        nom  = noms.get(ch['target']['node'])
        if path == 'scale': continue
        if path == 'translation' and nom not in GARDE_TRANS: continue
        s = a['samplers'][ch['sampler']]
        val = lire(s['output']).astype(np.float32)
        # Une piste constante n'est supprimable QUE si sa valeur est celle du repos :
        # sinon le clip tient une pose (bras croises, garde haute) et la supprimer
        # renverrait l'os en croix. C'est exactement ce qui cassait Idle_FoldArms.
        if np.allclose(val, val[0], atol=1e-5):
            nd = g['nodes'][ch['target']['node']]
            repos = {'rotation': nd.get('rotation', [0, 0, 0, 1]),
                     'translation': nd.get('translation', [0, 0, 0]),
                     'scale': nd.get('scale', [1, 1, 1])}[path]
            if np.allclose(val[0], np.array(repos, np.float32), atol=1e-4):
                continue
            val = val[:1]                      # une seule image suffit pour tenir la pose
        t = lire(s['input']).astype(np.float32)[:len(val)]
        cle = (s['input'], len(val))
        if cle not in ech: ech[cle] = pousser(t, 'SCALAR')
        io = pousser(val, 'VEC4' if path=='rotation' else 'VEC3')
        samps.append({'input':ech[cle],'output':io,
                      'interpolation':s.get('interpolation','LINEAR')})
        chans.append({'sampler':len(samps)-1,
                      'target':{'node':ch['target']['node'],'path':path}})
    if chans:
        anims.append({'name':a['name'],'channels':chans,'samplers':samps})
        stats.append((a['name'], len(chans)))

out = {
  'asset': {'version':'2.0','generator':'prune_anims.py (Legend of Camille)'},
  'scenes':[{'nodes':[i for i,nd in enumerate(g['nodes'])
                      if not any(i in n.get('children',[]) for n in g['nodes'])]}],
  'scene':0,
  'nodes':[{k:v for k,v in nd.items() if k in ('name','translation','rotation','scale','children')}
           for nd in g['nodes']],
  'animations':anims,
  'accessors':accs,
  'bufferViews':bviews,
  'buffers':[{'byteLength':len(blob)}],
}
jsb = json.dumps(out, separators=(',',':')).encode()
while len(jsb) % 4: jsb += b' '
while len(blob) % 4: blob.append(0)
glb = b'glTF' + struct.pack('<II', 2, 12+8+len(jsb)+8+len(blob))
glb += struct.pack('<II', len(jsb), 0x4E4F534A) + jsb
glb += struct.pack('<II', len(blob), 0x004E4942) + bytes(blob)
open(DST,'wb').write(glb)
print('%d clips, %.2f Mo -> %.2f Mo' % (len(anims), os.path.getsize(SRC)/1e6, len(glb)/1e6))
for n,c in stats: print('  %-28s %3d pistes' % (n,c))
