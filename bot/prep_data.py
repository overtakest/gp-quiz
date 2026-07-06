# -*- coding: utf-8 -*-
"""Cleans the raw quiz export into a compact questions.json used by the Mini App."""
import json, re, os

SRC = os.path.join(os.path.dirname(__file__), '..', '..', 'quiz-db-2026-06-02-10-10.json')
OUT = os.path.join(os.path.dirname(__file__), '..', 'data', 'questions.json')

def clean_text(t):
    if not t:
        return ''
    MARK = ''  # temp marker so blanks are inserted once, without re-processing
    # long underscore runs -> blank
    t = re.sub(r'_{3,}', MARK, t)
    # the export uses a quoted word "Ответ" as a fill-in blank placeholder
    t = re.sub(r'"\s*Отве[тл]\s*"', MARK, t)
    t = t.replace('\r', ' ')
    t = re.sub(r'\s*\n\s*', ' ', t)
    t = re.sub(r'[ \t]{2,}', ' ', t)
    t = t.replace(MARK, '«_____»')
    t = re.sub(r'«{2,}', '«', t)
    t = re.sub(r'»{2,}', '»', t)
    return t.strip()

def norm(s):
    return re.sub(r'\s+', ' ', (s or '')).strip().lower()

def main():
    db = json.load(open(SRC, encoding='utf-8'))
    qs = db['questions']
    out = []
    idx = 0
    for key, v in qs.items():
        qtext = clean_text(v.get('question', ''))
        if not qtext:
            continue  # drop the single empty entry
        t = v.get('type')
        item = {'id': f'q{idx:04d}', 'type': t, 'q': qtext}

        if t in ('multichoice', 'truefalse'):
            opts = [o.strip() for o in v.get('options', []) if o and o.strip()]
            try:
                ans = json.loads(v['answer'])
                correct = [c.strip() for c in ans.get('texts', [])]
            except Exception:
                correct = [v.get('answerText', '').strip()]
            correct = [c for c in correct if c]
            if not opts or not correct:
                continue
            item['options'] = opts
            item['correct'] = correct
            item['multi'] = t == 'multichoice' and len(correct) > 1
        elif t == 'match':
            try:
                pairs = json.loads(v['answer']).get('pairs', {})
            except Exception:
                pairs = {}
            pairs = {clean_text(k): str(val).strip() for k, val in pairs.items() if k}
            if len(pairs) < 2:
                continue
            item['pairs'] = pairs
        elif t in ('numerical', 'shortanswer'):
            ans = str(v.get('answerText', '')).strip() or str(v.get('answer', '')).strip()
            if not ans:
                continue
            item['answer'] = ans
        else:
            continue

        item['answerText'] = clean_text(v.get('answerText', ''))
        out.append(item)
        idx += 1

    json.dump(out, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    from collections import Counter
    c = Counter(o['type'] for o in out)
    print('written', len(out), 'questions ->', OUT)
    print('by type:', dict(c))

if __name__ == '__main__':
    main()
