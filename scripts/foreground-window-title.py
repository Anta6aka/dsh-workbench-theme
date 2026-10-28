import ctypes
import json
import sys
from ctypes import wintypes

title = ''
try:
    user32 = ctypes.windll.user32
    hwnd = user32.GetForegroundWindow()
    buffer = ctypes.create_unicode_buffer(512)
    if hwnd and user32.GetWindowTextW(hwnd, buffer, 512):
        title = buffer.value
except Exception:
    title = ''

sys.stdout.write(json.dumps({'title': title}, ensure_ascii=True))
