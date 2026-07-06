# -*- coding: utf-8 -*-
"""Split questions into batches for parallel tip generation."""
import json, os, math

BASE = os.path.dirname(__file__)
SCRATCH = r"C:\Users\3am\AppData\Local\Temp\claude\C--Users-3am-Documents----------------\0ee175a9-39dd-4db1-9372-c94536d946ac\scratchpad"
BATCH_DIR = os.path.join(SCRATCH, 'batches')
OUT_DIR = os.path.join(SCRATCH, 'tips_out')
os.makedirs(BATCH_DIR, exist_ok=True)
os.makedirs(OUT_DIR, exist_ok=True)

qs = json.load(open(os.path.join(BASE, '..', 'data', 'questions.json'), encoding='utf-8'))

def ans_of(q):
    if q.get('answerText'):
        return q['answerText']
    if q['type'] == 'match':
        return '  |  '.join(f"{k} → {v}" for k, v in q.get('pairs', {}).items())
    if q['type'] in ('multichoice', 'truefalse'):
        return ', '.join(q.get('correct', []))
    return q.get('answer', '')

items = [{'id': q['id'], 'type': q['type'], 'q': q['q'], 'answer': ans_of(q)} for q in qs]

BATCH = 55
n = math.ceil(len(items) / BATCH)
for i in range(n):
    chunk = items[i*BATCH:(i+1)*BATCH]
    fn = os.path.join(BATCH_DIR, f'batch_{i:02d}.json')
    json.dump(chunk, open(fn, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)

print(f'{len(items)} questions -> {n} batches of {BATCH}')
print('BATCH_DIR:', BATCH_DIR)
print('OUT_DIR:', OUT_DIR)
