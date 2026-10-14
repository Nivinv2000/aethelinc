import numpy as np, json
from PIL import Image, ImageFilter
from scipy import ndimage as ndi

OUT='/Users/nivinv/Documents/Nivin/aethelinc/assets/scene/'
meta={}

def load(n):
    im=Image.open(f'{n}-src.webp').convert('RGBA'); return np.asarray(im).astype(np.float32)

def key_white(a):
    """background = near-white pixels connected to the border; soft edge"""
    rgb=a[...,:3]; mn=rgb.min(axis=2)
    near=mn>=236
    lab,nl=ndi.label(near)
    border=set(np.unique(np.concatenate([lab[0],lab[-1],lab[:,0],lab[:,-1]])))-{0}
    bg=np.isin(lab,list(border))
    alpha=(~bg).astype(np.float32)
    alpha=ndi.binary_opening(alpha>0.5,iterations=1).astype(np.float32)
    alpha=ndi.gaussian_filter(alpha,0.8)
    alpha=np.clip((alpha-0.25)/0.5,0,1)
    return alpha

def crop(rgb,alpha,pad=4):
    ys,xs=np.where(alpha>0.05)
    y0,y1,x0,x1=max(ys.min()-pad,0),min(ys.max()+pad,alpha.shape[0]-1),max(xs.min()-pad,0),min(xs.max()+pad,alpha.shape[1]-1)
    return rgb[y0:y1+1,x0:x1+1],alpha[y0:y1+1,x0:x1+1],(x0,y0)

def relight(rgb,alpha,rim_dir='right',haze_from=0.62,rim_strength=1.0,sym=False,tone=0.78):
    h,w=alpha.shape
    lum=(0.299*rgb[...,0]+0.587*rgb[...,1]+0.114*rgb[...,2])/255.0
    lum=ndi.gaussian_filter(lum,0.6)
    navy=np.array([9,13,21],np.float32); slate=np.array([46,58,74],np.float32)
    t=np.clip((lum-0.04)/0.5,0,1)[...,None]**1.1
    base=navy+(slate-navy)*t*tone
    # lights: bright warm/white small spots -> pale white; red stays red; flame -> whitened
    r,g,b=rgb[...,0],rgb[...,1],rgb[...,2]
    bright=(lum>0.72)&(alpha>0.9)
    red=(r>150)&(g<100)&(b<100)
    flame=(r>200)&(g>100)&(g<215)&(b<110)
    warm=(r>190)&(g>150)&(b<150)&(lum>0.6)
    lights=(warm|bright)&~red&~flame
    # keep only compact bright spots (not large white surfaces)
    lab,nl=ndi.label(lights); sizes=ndi.sum(lights,lab,range(1,nl+1)) if nl else []
    small=np.isin(lab,[i+1 for i,s in enumerate(sizes) if s<90])
    base[small]=np.array([225,232,240],np.float32)*0.9
    base[red&(alpha>0.5)]=np.array([255,70,60],np.float32)
    # flame: bright near-white with a hint of warmth
    fl=ndi.binary_dilation(flame&(alpha>0.5),iterations=1)
    base[fl]=np.array([255,246,232],np.float32)
    # rim light on edges facing the glow: up, plus toward the light side
    def shift(a_,dx,dy):
        return ndi.shift(a_,(dy,dx),order=1,mode='constant',cval=0)
    k=max(2,int(round(w/380)))
    up=np.clip(alpha-shift(alpha,0,k),0,1)            # pixel exists, the pixel k above... (shift moves content down)
    up=np.clip(alpha-shift(alpha,0,-k),0,1) if False else np.clip(alpha-ndi.shift(alpha,(k,0),order=1,mode='constant'),0,1)
    side=np.clip(alpha-ndi.shift(alpha,(0,k if rim_dir=='right' else -k),order=1,mode='constant'),0,1)
    if sym:
        side=np.maximum(side,np.clip(alpha-ndi.shift(alpha,(0,-k if rim_dir=='right' else k),order=1,mode='constant'),0,1))
    rim=np.maximum(up*0.85,side*0.75)
    rim=ndi.gaussian_filter(rim,0.7)
    yy=(np.arange(h)/h)[:,None]
    rim*= (0.30+0.70*yy)
    rimcol=np.array([214,224,236],np.float32)
    out=base+(rimcol-base)*np.clip(rim*rim_strength,0,0.95)[...,None]
    # atmospheric haze toward the bottom (object sits in the glow)
    hz=np.clip((yy-haze_from)/max(1e-6,1-haze_from),0,1)**1.4*0.55 if haze_from<1 else np.zeros_like(yy)
    haze=np.array([128,140,154],np.float32)
    out=out*(1-hz[...,None])+haze*hz[...,None]
    return np.dstack([np.clip(out,0,255),alpha*255]).astype(np.uint8)

def save(arr,name,maxw=1400):
    im=Image.fromarray(arr,'RGBA')
    if im.width>maxw: im=im.resize((maxw,round(im.height*maxw/im.width)),Image.LANCZOS)
    im.save(OUT+name,optimize=True); return im.size

# ---------- platform (has real alpha) ----------
a=load('platform'); alpha=a[...,3]/255.0
alpha=np.clip(ndi.gaussian_filter(alpha,0.5),0,1).astype(np.float32)
rgb,al,off=crop(a[...,:3],alpha)
# flame position (before relight)
r,g,b=rgb[...,0],rgb[...,1],rgb[...,2]
fm=(r>200)&(g>100)&(g<215)&(b<110)&(al>0.5)
reg=np.zeros_like(fm); reg[:int(fm.shape[0]*0.3),int(fm.shape[1]*0.9):]=True; fm=fm&reg
ys,xs=np.where(fm); fx,fy=float(xs.mean()),float(ys.min()+(ys.max()-ys.min())*0.35)
res=relight(rgb,al,'left',haze_from=0.66)   # platform sits left of the light, so the rim faces right... see below
res2=relight(rgb,al,'right',haze_from=0.66)
sz=save(res2,'platform.png',1500)
sc=sz[0]/res2.shape[1]
meta['platform']={'w':sz[0],'h':sz[1],'flare':[fx*sc,fy*sc]}

# ---------- vessel ----------
a=load('vessel'); alpha=key_white(a)
rgb,al,off=crop(a[...,:3],alpha)
# trim the very bottom (keel/boot-topping) a touch
res=relight(rgb,al,'left',haze_from=0.7)
sz=save(res,'vessel.png',1200); meta['vessel']={'w':sz[0],'h':sz[1]}

# ---------- turbine: tower + hub, and one blade ----------
a=load('turbine'); alpha=key_white(a)
H,W=alpha.shape
hub=np.array([905,272],np.float32)   # x,y in source
# blade directions (from hub): (tip x,y)
tips={'ur':(1105,12),'left':(392,372),'lr':(1165,742)}
yy,xx=np.mgrid[0:H,0:W].astype(np.float32)
def blade_mask(tip,halfw0=34,halfw1=10,rstart=40):
    d=np.array(tip,np.float32)-hub; L=np.linalg.norm(d); u=d/L; n=np.array([-u[1],u[0]])
    px=xx-hub[0]; py=yy-hub[1]
    along=px*u[0]+py*u[1]; perp=np.abs(px*n[0]+py*n[1])
    hw=halfw0+(halfw1-halfw0)*np.clip(along/L,0,1)
    return (along>rstart)&(along<L+20)&(perp<hw+6),L,u
bm_all=np.zeros_like(alpha,bool); info={}
for k,t in tips.items():
    m,L,u=blade_mask(t); bm_all|=m; info[k]=(m,L,u)
# tower alpha: remove blades
tower_alpha=alpha*(~ndi.binary_dilation(bm_all,iterations=2))
tower_alpha=ndi.gaussian_filter(tower_alpha.astype(np.float32),0.5)
# keep only the largest connected component (tower+nacelle)
lab,nl=ndi.label(tower_alpha>0.3); sizes=ndi.sum(tower_alpha>0.3,lab,range(1,nl+1)); keep=lab==(1+int(np.argmax(sizes)))
tower_alpha=tower_alpha*keep
rgb_t,al_t,off_t=crop(a[...,:3],tower_alpha)
res=relight(rgb_t,al_t,'right',haze_from=0.72)
sz=save(res,'tower.png',700)
sc=sz[0]/rgb_t.shape[1]
meta['tower']={'w':sz[0],'h':sz[1],'hub':[float((hub[0]-off_t[0])*sc),float((hub[1]-off_t[1])*sc)]}
# blade sprite from the longest blade (left): rotate so it points along +x
m,L,u=info['left']
angle=np.degrees(np.arctan2(u[1],u[0]))
blade_alpha=alpha*ndi.binary_dilation(m,iterations=3)
blade_rgba=np.dstack([a[...,:3],blade_alpha*255]).astype(np.uint8)
im=Image.fromarray(blade_rgba,'RGBA')
# rotate around the hub so blade points to +x (PIL rotates counter-clockwise by angle degrees; image y is down)
big=im.rotate(angle,center=(float(hub[0]),float(hub[1])),resample=Image.BICUBIC,expand=False)
ba=np.asarray(big).astype(np.float32)
# crop: from hub outward
x0=int(hub[0]-60); x1=int(hub[0]+L+16); y0=int(hub[1]-60); y1=int(hub[1]+60)
bc=ba[max(y0,0):y1,max(x0,0):x1]
bal=bc[...,3]/255.0
rgbb=bc[...,:3]
res=relight(rgbb,bal,'right',haze_from=1.0,rim_strength=0.55,sym=True,tone=0.3)
sz2=save(res,'blade.png',900)
sc2=sz2[0]/bc.shape[1]
meta['blade']={'w':sz2[0],'h':sz2[1],'hub':[float((hub[0]-max(x0,0))*sc2),float((hub[1]-max(y0,0))*sc2)],'len':float(L*sc2)}
json.dump(meta,open(OUT+'meta.json','w'),indent=1)
print(json.dumps(meta,indent=1))
