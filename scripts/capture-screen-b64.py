from PIL import ImageGrab
import base64
import ctypes
import io
import json
import sys
from ctypes import wintypes

# Prefer the foreground window: the all-screens image makes a local vision model
# pick arbitrary windows instead of the task the user is actually looking at.
bbox = None
title = ''
try:
    user32 = ctypes.windll.user32
    hwnd = user32.GetForegroundWindow()
    title_buffer = ctypes.create_unicode_buffer(512)
    if hwnd and user32.GetWindowTextW(hwnd, title_buffer, 512):
        title = title_buffer.value
    rect = wintypes.RECT()
    if hwnd and user32.GetWindowRect(hwnd, ctypes.byref(rect)):
        width = rect.right - rect.left
        height = rect.bottom - rect.top
        if width >= 320 and height >= 240:
            bbox = (rect.left, rect.top, rect.right, rect.bottom)
except Exception:
    bbox = None

if bbox:
    img = ImageGrab.grab(bbox=bbox, all_screens=True)
else:
    img = ImageGrab.grab(all_screens=True)

max_side = 1600
if max(img.size) > max_side:
    ratio = max_side / max(img.size)
    img = img.resize((int(img.width * ratio), int(img.height * ratio)))
buf = io.BytesIO()
img.convert('RGB').save(buf, format='JPEG', quality=72)
sys.stdout.write(json.dumps({
    'image': base64.b64encode(buf.getvalue()).decode('ascii'),
    'title': title,
}, ensure_ascii=True))
