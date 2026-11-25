import cv2, numpy as np
from PIL import Image
O=cv2.imread("interviewer-bf80c53f7c.png"); H,W=O.shape[:2]; alpha=np.load("alpha.npy")
def ss(e0,e1,x): t=np.clip((x-e0)/(e1-e0),0,1); return t*t*(3-2*t)
yy,xx=np.mgrid[0:H,0:W].astype(np.float32)
# background plate: fill the area behind Maya (soft-focus room, so a smooth fill is enough at the edges)
hole=cv2.dilate((alpha>0.03).astype(np.uint8),np.ones((41,41),np.uint8))
small=cv2.resize(O,(W//4,H//4),interpolation=cv2.INTER_AREA); sh=cv2.resize(hole,(W//4,H//4),interpolation=cv2.INTER_NEAREST)
fill=cv2.inpaint(small,sh,12,cv2.INPAINT_TELEA); fill=cv2.GaussianBlur(fill,(0,0),3)
fill=cv2.resize(fill,(W,H),interpolation=cv2.INTER_CUBIC)
m=cv2.GaussianBlur(hole.astype(np.float32),(0,0),6)[...,None]
bg=(O*(1-m)+fill*m).astype(np.uint8)
# head = everything above the neck; body = everything else (no head pixels, so a moving head never leaves a ghost)
head_a=alpha*(1-ss(655,760,yy))
body_a=alpha*ss(605,700,yy)
def save_rgba(a,name,crop=False):
    rgba=np.dstack([cv2.cvtColor(O,cv2.COLOR_BGR2RGB),(a*255).astype(np.uint8)])
    box=(0,0,W,H)
    if crop:
        x,y,w,h=cv2.boundingRect((a>0.004).astype(np.uint8)); x=max(0,x-4); y=max(0,y-4); w=min(W-x,w+8); h=min(H-y,h+8); box=(x,y,x+w,y+h); rgba=rgba[y:y+h,x:x+w]
    Image.fromarray(rgba).save(name,"WEBP",quality=88,method=6)
    return box
Image.fromarray(cv2.cvtColor(bg,cv2.COLOR_BGR2RGB)).save("maya-room.webp","WEBP",quality=84,method=6)
hb=save_rgba(head_a,"maya-head.webp",crop=True); bb=save_rgba(body_a,"maya-body.webp",crop=True)
print("head box %",[round(v*100/W,3) for v in (hb[0],hb[1],hb[2]-hb[0],hb[3]-hb[1])])
print("body box %",[round(v*100/W,3) for v in (bb[0],bb[1],bb[2]-bb[0],bb[3]-bb[1])])
np.save("boxes2.npy",np.array([hb,bb]))
# test: rotate head 1.0deg about the neck + shift, composite
def comp(angle,dx,dy):
    Mh=cv2.getRotationMatrix2D((W*0.5,H*0.56),angle,1.0); Mh[:,2]+=(dx,dy)
    hrgb=cv2.warpAffine(O,Mh,(W,H),flags=cv2.INTER_LINEAR); ha=cv2.warpAffine(head_a,Mh,(W,H))[...,None]
    out=bg*(1-body_a[...,None])+O*body_a[...,None]
    out=out*(1-ha)+hrgb*ha
    return out.astype(np.uint8)
a=comp(1.0,5,-3); b=comp(-1.0,-5,2)
cv2.imwrite("layer_test.png",np.hstack([cv2.resize(a,(627,627)),cv2.resize(b,(627,627))]))
z=np.hstack([a[150:850,330:930],b[150:850,330:930]]); cv2.imwrite("layer_test_zoom.png",cv2.resize(z,None,fx=.8,fy=.8))
