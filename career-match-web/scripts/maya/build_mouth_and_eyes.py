import cv2, numpy as np
from PIL import Image
O=cv2.imread("interviewer-bf80c53f7c.png"); S=cv2.imread("maya-speaking-a6a2e4d45f.png"); C=cv2.imread("maya-blink-bb1ea41801.png")
H,W=O.shape[:2]
def smooth(a,k=9): return cv2.GaussianBlur(a.astype(np.float32),(0,0),k)
def ss(e0,e1,x): t=np.clip((x-e0)/(e1-e0),0,1); return t*t*(3-2*t)

# ---------- MOUTH: hand-measured opening in the speaking photo (top = upper teeth edge, bottom = lower lip top) ----------
px=[589,620,651,700,728]; ptop=[546,540,535,530,528]; pbot=[546,556,560,555,529]
xs=np.arange(W,dtype=np.float32)
ytop=np.interp(xs,px,ptop).astype(np.float32); ybot=np.interp(xs,px,pbot).astype(np.float32)
inside=(xs>=px[0])&(xs<=px[-1])
gap=np.where(inside,ybot-ytop,0).astype(np.float32)
gap=np.convolve(gap,np.ones(7)/7,mode="same").astype(np.float32)
gap=gap+np.where(gap>0.5,1.0,0)
yy,xx=np.mgrid[0:H,0:W].astype(np.float32)
def mouth_frame(t):
    # pull lower lip and chin up by (1-t)*gap, fading out toward the chin
    lift=(1-t)*gap[None,:]*np.ones((H,1),np.float32)
    below=ss(ytop[None,:]-2,ytop[None,:]+1,yy)
    fall=1-ss(ybot[None,:]+20,ybot[None,:]+80,yy)
    dy=(lift*fall*below).astype(np.float32)
    dy=cv2.GaussianBlur(dy,(0,0),1.5)
    return cv2.remap(S,xx,yy+dy,cv2.INTER_CUBIC,borderMode=cv2.BORDER_REFLECT)
speech=[mouth_frame(t) for t in (0,.22,.42,.62,.82,1.0)]
# rest -> speaking-closed morph (both closed, so optical flow works)
def flow_morph(A,B,box,ts):
    X0,Y0,X1,Y1=box; a=A[Y0:Y1,X0:X1]; b=B[Y0:Y1,X0:X1]
    dis=cv2.DISOpticalFlow_create(cv2.DISOPTICAL_FLOW_PRESET_MEDIUM)
    ga,gb=[cv2.cvtColor(v,cv2.COLOR_BGR2GRAY) for v in (a,b)]
    fab=dis.calc(ga,gb,None); fba=dis.calc(gb,ga,None)
    h,w=ga.shape; gx,gy=np.meshgrid(np.arange(w,dtype=np.float32),np.arange(h,dtype=np.float32))
    out=[]
    for t in ts:
        wa=cv2.remap(a,gx+t*fba[...,0]*-1*-1,gy+t*fba[...,1],cv2.INTER_LINEAR,borderMode=cv2.BORDER_REFLECT)
        wb=cv2.remap(b,gx+(1-t)*fab[...,0],gy+(1-t)*fab[...,1],cv2.INTER_LINEAR,borderMode=cv2.BORDER_REFLECT)
        f=A.copy(); f[Y0:Y1,X0:X1]=(wa*(1-t)+wb*t).astype(np.uint8); out.append(f)
    return out
mbox=(520,480,800,640)
rest_to_speech=flow_morph(O,speech[0],mbox,[.33,.66])
mouth_frames=[O]+rest_to_speech+speech      # 0 rest smile, 1-2 transition, 3 speech closed ... 8 fully open
# ---------- EYES: slide the upper lid down, then the real closed-eye photo ----------
EYES=[dict(x=[505,553,592],yu=[369,355,372],yc=[386,379,372]),   # viewer-left eye: open upper lash line, closed lash line
      dict(x=[675,715,765],yu=[357,343,350],yc=[358,366,355])]
def eye_frame(s):
    out=O.astype(np.float32).copy(); Cf=C.astype(np.float32)
    for e in EYES:
        X0,X1=e["x"][0]-6,e["x"][-1]+6
        for x in range(X0,X1):
            yu=np.interp(x,e["x"],e["yu"]); yc=np.interp(x,e["x"],e["yc"]); d=max(yc-yu,0)
            edge=yu+s*d
            # fade in at the eye corners
            k=min(1,(x-X0)/8,(X1-x)/8)
            for y in range(int(yu-16),int(edge)+7):
                wc=ss(yu-15,yu-5,y)*k*np.clip((edge+5.5-y)/2,0,1)
                sy=y+(1-s)*d; y0=int(np.floor(sy)); f=sy-y0
                src=Cf[y0,x]*(1-f)+Cf[y0+1,x]*f
                out[y,x]=out[y,x]*(1-wc)+src*wc
    return np.clip(out,0,255).astype(np.uint8)
eye_frames=[O,eye_frame(.4),eye_frame(.75),C]

# ---------- SPRITES: crop + feathered alpha ----------
def sprite(frames,box,feather,name):
    X0,Y0,X1,Y1=box; h,w=Y1-Y0,X1-X0
    yy2,xx2=np.mgrid[0:h,0:w].astype(np.float32)
    r=np.sqrt(((xx2-w/2)/(w/2))**2+((yy2-h/2)/(h/2))**2)
    alpha=(1-ss(1-feather,1.0,r))
    strip=[]
    for f in frames:
        rgba=cv2.cvtColor(f[Y0:Y1,X0:X1],cv2.COLOR_BGR2BGRA); rgba[...,3]=(alpha*255).astype(np.uint8); strip.append(rgba)
    img=np.vstack(strip)
    Image.fromarray(cv2.cvtColor(img,cv2.COLOR_BGRA2RGBA)).save(name,"WEBP",quality=90,method=6)
    return [X0/W,Y0/H,w/W,h/H]
mouth_box=(548,488,768,628); eye_box=(498,318,782,400)
mb=sprite(mouth_frames,mouth_box,.42,"maya-mouth.webp"); eb=sprite(eye_frames,eye_box,.38,"maya-eyes.webp")
print("mouth box %",[round(v*100,3) for v in mb],"frames",len(mouth_frames)); print("eye box %",[round(v*100,3) for v in eb],"frames",len(eye_frames))
import pickle; pickle.dump(dict(mouth=mouth_frames,eyes=eye_frames,mb=mb,eb=eb),open("anim.pkl","wb"))
# previews
def crop(f,b): return f[b[1]:b[3],b[0]:b[2]]
cv2.imwrite("prev_mouth.png",np.hstack([cv2.resize(crop(f,mouth_box),None,fx=.9,fy=.9) for f in mouth_frames]))
cv2.imwrite("prev_eyes.png",np.hstack([cv2.resize(crop(f,eye_box),None,fx=.75,fy=.75) for f in eye_frames]))
