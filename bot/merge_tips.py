# -*- coding: utf-8 -*-
"""Merge per-batch tip files into data/tips.json and report coverage."""
import json, os, glob

BASE = os.path.dirname(__file__)
SCRATCH = r"C:\Users\3am\AppData\Local\Temp\claude\C--Users-3am-Documents----------------\0ee175a9-39dd-4db1-9372-c94536d946ac\scratchpad"
OUT_DIR = os.path.join(SCRATCH, 'tips_out')
QUESTIONS = os.path.join(BASE, '..', 'data', 'questions.json')
DEST = os.path.join(BASE, '..', 'data', 'tips.json')

tips = {}
files = sorted(glob.glob(os.path.join(OUT_DIR, 'tips_*.json')))
for fn in files:
    try:
        data = json.load(open(fn, encoding='utf-8'))
        cnt = 0
        for k, v in data.items():
            if isinstance(v, str) and v.strip():
                tips[k] = v.strip(); cnt += 1
        print(f'  {os.path.basename(fn)}: {cnt}')
    except Exception as e:
        print(f'  !! {os.path.basename(fn)}: {e}')

qs = json.load(open(QUESTIONS, encoding='utf-8'))
ids = [q['id'] for q in qs]
have = [i for i in ids if i in tips]
missing = [i for i in ids if i not in tips]

json.dump(tips, open(DEST, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
print(f'\nMerged {len(tips)} tips from {len(files)} files -> {DEST}')
print(f'Coverage: {len(have)}/{len(ids)} questions  |  missing: {len(missing)}')
if missing:
    print('Missing ids sample:', missing[:15])
    json.dump(missing, open(os.path.join(SCRATCH, 'missing_ids.json'), 'w', encoding='utf-8'), ensure_ascii=False)
