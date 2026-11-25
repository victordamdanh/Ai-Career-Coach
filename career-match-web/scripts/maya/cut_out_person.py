import cv2, numpy as np
from PIL import Image
from rembg import remove, new_session
O=cv2.imread("interviewer-bf80c53f7c.png"); H,W=O.shape[:2]
sess=new_session("u2net_human_seg")
rgba=np.array(remove(Image.open("interviewer-bf80c53f7c.png").convert("RGB"),session=sess,alpha_matting=True,alpha_matting_foreground_threshold=235,alpha_matting_background_threshold=15,alpha_matting_erode_size=8))
alpha=rgba[...,3].astype(np.float32)/255
np.save("alpha.npy",alpha)
cv2.imwrite("alpha.png",(alpha*255).astype(np.uint8))
print("person coverage",alpha.mean().round(3), "bbox", cv2.boundingRect((alpha>0.5).astype(np.uint8)))
