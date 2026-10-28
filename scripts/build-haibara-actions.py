"""Rebuild Haibara's pet animation set from the project-local sticker pack.

Canonical names only: no internal aliases such as 点击-摸头 / 余额-满 / 碎碎念-冒泡.
Run after replacing GIFs in assets/haibara-stickers/:

    python scripts/build-haibara-actions.py
"""
import json
import os
import subprocess

PROJECT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(PROJECT, 'assets', 'haibara-stickers')
ANIM = os.path.join(PROJECT, 'pet-data', 'haibara-animation')
CONFIG = os.path.join(PROJECT, 'pet-data', 'haibara-config.json')
FFMPEG = os.environ.get('FFMPEG_PATH', 'ffmpeg')
os.makedirs(ANIM, exist_ok=True)
VF = 'scale=-1:320:flags=lanczos,format=rgba,pad=640:360:x=(ow-iw)/2:y=oh-ih-18:color=black@0,format=yuva420p'

JOBS = [
    ('哀_加载（茶_咖啡杯）_2026-09-22-16-45-30.gif', '喝茶', False),
    ('哀_茶 3_2026-09-22-16-48-41.gif', '品茶', False),
    ('哀_吃(爆米花)_2026-09-22-16-43-31.gif', '吃爆米花', False),
    ('哀_工作(小睡)_2026-09-22-16-49-22.gif', '工作小睡', False),
    ('哀_睡觉(普通)_2026-09-22-16-47-43.gif', '睡觉', False),
    ('哀_电风扇 1_2026-09-22-16-43-38.gif', '吹风扇', False),
    ('哀_摸头_2026-09-22-16-51-25.gif', '摸头', False),
    ('哀_笑(指)_2026-09-22-16-45-09.gif', '笑', False),
    ('哀_碰鼻子_2026-09-22-16-39-11.gif', '碰鼻', False),
    ('哀_庆祝_2026-09-22-16-42-34.gif', '庆祝', False),
    ('哀_玫瑰_2026-09-22-16-51-14.gif', '玫瑰', False),
    ('哀_红包 2_2026-09-22-16-46-58.gif', '收红包', False),
    ('哀_蛋糕_2026-09-22-16-42-10.gif', '蛋糕', False),
    ('哀_问号_2026-09-22-16-46-45.gif', '问号', False),
    ('哀_音乐 2_2026-09-24-05-13-24.gif', '听音乐', False),
    ('哀_点头_2026-09-22-16-44-50.gif', '点头', False),
    ('哀_一切都好 1_2026-09-22-16-48-52.gif', '一切都好', False),
    ('猫耳哀_碰鼻子_2026-09-25-00-27-06.gif', '猫耳碰鼻', False),
    ('哀_冒泡 2_2026-09-22-16-45-59.gif', '探头-右', False),
    ('哀_冒泡 2_2026-09-22-16-45-59.gif', '探头-左', True),
]

def convert(src_name, out_name, mirror=False, loop=0):
    src = os.path.join(SRC, src_name)
    if not os.path.exists(src):
        print('MISSING', src_name)
        return
    out = os.path.join(ANIM, out_name if out_name.endswith('.webm') else out_name + '.webm')
    vf = ('hflip,' + VF) if mirror else VF
    cmd = [FFMPEG, '-hide_banner', '-loglevel', 'error', '-y']
    if loop:
        cmd += ['-stream_loop', str(loop)]
    cmd += ['-i', src, '-vf', vf, '-c:v', 'libvpx-vp9', '-pix_fmt', 'yuva420p',
            '-auto-alt-ref', '0', '-b:v', '0', '-crf', '30', '-an', '-row-mt', '1', out]
    result = subprocess.run(cmd, capture_output=True, text=True)
    print(out_name, 'ok' if result.returncode == 0 else 'FAIL')
    if result.returncode != 0:
        print((result.stderr or '')[-300:])

for src_name, out_name, mirror in JOBS:
    convert(src_name, out_name, mirror)
# Drag animation intentionally covers a long drag (~4.7s).
convert('哀_点头_2026-09-22-16-44-50.gif', '被拎起.webm', loop=5)
convert('哀_点头_2026-09-22-16-44-50.gif', '待机.webm')

# Drop legacy aliases so the folder only contains canonical names.
config = json.load(open(CONFIG, encoding='utf-8'))
keep = {'待机', '被拎起', '冒泡', '探头-左', '探头-右'}
keep.update(config['animations']['clicks'])
for category in config['animations']['categories']:
    keep.update(category['actions'])
for group in config['animations']['events'].values():
    keep.update(group)
for name in os.listdir(ANIM):
    if name.endswith('.webm') and name[:-5] not in keep:
        os.remove(os.path.join(ANIM, name))
print('done, kept', len([n for n in os.listdir(ANIM) if n.endswith('.webm')]), 'animations')
