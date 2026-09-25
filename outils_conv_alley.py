import os, glob, subprocess
from PIL import Image
Image.MAX_IMAGE_PIXELS = None
SRC='hidden_alley/textures'; PH='assets_back/03_textures/polyhaven'
def f(b):
    g=sorted(glob.glob(os.path.join(SRC,b+'.*'))+glob.glob(os.path.join(SRC,b+'_[0-9]k.*')))
    return g[0] if g else None
def conv(src,dst,t):
    os.makedirs(os.path.dirname(dst),exist_ok=True)
    if src.lower().endswith('.exr'):
        subprocess.run(['convert',src,'-colorspace','sRGB','-resize','%dx%d'%(t,t),'-quality','82',dst],check=True)
    else:
        im=Image.open(src)
        if im.mode not in ('RGB','RGBA','L'): im=im.convert('RGB')
        if max(im.size)>t: im=im.resize((t,int(im.size[1]*t/im.size[0])),Image.LANCZOS)
        im.save(dst,'WEBP',quality=82,method=4)
    return os.path.getsize(dst)
# Seuls les matériaux compatibles avec un décor du XVIIe : enduit, chaux craquelée,
# gravier, brique. Tout le reste du pack est urbain contemporain.
for slug,pref,t in [('enduit_gris','grey_plaster',2048),('chaux_craquelee','cracked_concrete_wall',2048),
                    ('gravier','gravel_stones',2048),('brique_rouge_06','brick_wall_006',2048)]:
    for cle,suf in (('couleur','_diff'),('normale','_nor_gl'),('rugosite','_rough')):
        dst=os.path.join(PH,slug,cle+'.webp')
        if os.path.exists(dst) and os.path.getsize(dst)>1000: continue
        src=f(pref+suf)
        if not src: print('  absent',pref+suf); continue
        try: print('  %-26s %6.0f Ko'%(slug+'/'+cle, conv(src,dst,t)/1024))
        except Exception as e: print('  ECHEC',slug,cle,e)
