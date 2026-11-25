# Maya's animation layers

These scripts made the WebP layers in `web/` from Maya's three source portraits
(neutral, speaking, eyes closed). They are kept for reference; the app only needs the WebP files.

1. `cut_out_person.py` separates Maya from the room (rembg, `u2net_human_seg`).
2. `build_layers.py` makes the empty room, the body layer and the head layer, so the head can move without moving the room.
3. `build_mouth_and_eyes.py` makes the mouth frames (resting smile → lips together → fully open, by moving the lower lip of the speaking photo) and the blink frames (the closed eyelid slides down over the open eye).

Requirements: `pip install opencv-python pillow numpy "rembg[cpu]"`. Rename outputs with a content hash before adding them to `web/`.
