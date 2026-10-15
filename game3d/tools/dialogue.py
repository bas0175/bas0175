# The game's words, out to one editable script and back.
#   python3 tools/dialogue.py export   -> ../docs/dialogue.md (+ ../docs/dialogue-map.json, the originals)
#   python3 tools/dialogue.py apply    -> writes the edited lines from ../docs/dialogue.md back into pilgrimage.html
# Every line carries a marker: [D012] dialogue (text boxes), [C004] captions, [P007] prompts (the bottom line),
# [S002] status (top right).
# A line used in more than one place has one marker; editing it changes every use.
import json, re, sys
HTML, MD, MAP = 'pilgrimage.html', '../docs/dialogue.md', '../docs/dialogue-map.json'
S = r"'((?:[^'\\]|\\.)*)'"
unq = lambda s: re.sub(r"\\(.)", r"\1", s)
q = lambda s: s.replace('\\', '\\\\').replace("'", "\\'")
LABEL = {
  'sendOff': 'The outpost: her father sends her off (cycle 1 / cycle 2 / cycle 3)',
  'torvenLines': 'The Assembly gate: Torven (on the way home / cycle 1 / cycle 2)',
  'arriveFromWest': 'Cycle 3: arriving at the Assembly by the deep ways',
  'update': 'The road and the outpost: the cave-in (cycle 3), her father gives the map, bringing the light home (cycle 2 / with stores / cycle 1)',
  'updateGrove': 'The deep ways: the glowing chamber',
  'DINNER': "Dinner at Torven's house (parked: not in the game until DINNER_ON is set)",
}
def func_at(src, pos):
    m = None
    for m2 in re.finditer(r"\nfunction (\w+)\(|\nconst (DINNER)=", src[:pos]): m = m2
    return (m.group(1) or m.group(2)) if m else '?'
def scan(src):
    out = []
    for m in re.finditer(r"\{who:" + S + r",text:" + S + r"\}", src): out.append(('D', m.start(), unq(m.group(1)), unq(m.group(2))))
    for m in re.finditer(r"caption\(" + S, src): out.append(('C', m.start(), '', unq(m.group(1))))
    h0 = src.index('function setHint('); h1 = src.index('\n}', h0)
    for m in re.finditer(S, src[h0:h1]):
        t = unq(m.group(1))
        if ' ' in t.strip() and len(t) > 6 and not t.endswith(' ') and not t.startswith('rgba'): out.append(('S' if h0 + m.start() > src.index('const pl=', h0) else 'P', h0 + m.start(), '', t))
    d0 = src.index("const DINNER={"); d1 = src.index("\n};", d0)
    for m in re.finditer(r"\?" + S + r":", src[src.index('function updateDinner'):src.index('function dinnerSing')]):
        out.append(('P', src.index('function updateDinner') + m.start(), '', unq(m.group(1))))
    return sorted(out, key=lambda e: e[1])
def export():
    src = open(HTML).read(); ids, mp, lines, last, n = {}, {}, [], None, {'D': 0, 'C': 0, 'P': 0, 'S': 0}
    sections = {'D': [], 'C': [], 'P': [], 'S': []}
    prev_pos = None
    for kind, pos, who, text in scan(src):
        key = (kind, who, text)
        if key not in ids: n[kind] += 1; ids[key] = f'{kind}{n[kind]:03d}'; mp[ids[key]] = {'kind': kind, 'who': who, 'text': text}
        sections[kind].append((pos, ids[key], who, text))
    md = ['# Obsidian Cycle III: Pilgrimage — dialogue and on-screen text', '',
          'Edit the words after each marker, then send the file back (or commit it as docs/dialogue.md).',
          'Keep the markers ([D012] and so on) as they are; you can change the speaker before the colon.',
          'To add, remove or move a line, write a note next to it in [square brackets] and I will do it.', '']
    md += ['## Dialogue (text boxes)', '']
    seen, cur, prev = set(), None, None
    for pos, i, who, text in sections['D']:
        f = func_at(src, pos)
        if f != cur: md += ['', f'### {LABEL.get(f, f)}', '']; cur = f
        elif prev is not None and ']' in src[prev:pos]: md.append('')
        md.append(f'[{i}] {who or "(no speaker)"}: {text}' + ('   (same line as above, used again)' if i in seen else '')); seen.add(i); prev = pos
    md += ['', '## Captions (the line under the screen at story moments)', '']
    for pos, i, _, text in sections['C']:
        if i in seen: continue
        seen.add(i); md.append(f'[{i}] {text}')
    for k, title in (('P', 'Prompts (the bottom line while playing)'), ('S', 'Status (top right of the screen)')):
        md += ['', f'## {title}', '']
        for pos, i, _, text in sections[k]:
            if i in seen: continue
            seen.add(i); md.append(f'[{i}] {text}')
    open(MD, 'w').write('\n'.join(md) + '\n'); json.dump(mp, open(MAP, 'w'), indent=1, ensure_ascii=False)
    print('exported', {k: v for k, v in n.items()}, '->', MD)
def apply():
    src = open(HTML).read(); mp = json.load(open(MAP)); changed = 0
    for line in open(MD):
        m = re.match(r'\[([DCPS]\d{3})\]\s*(.*?)\s*(\(same line as above, used again\))?\s*$', line.rstrip('\n'))
        if not m or m.group(1) not in mp: continue
        i, body, o = m.group(1), m.group(2), mp[m.group(1)]
        if o['kind'] == 'D':
            who, _, text = body.partition(':'); who, text = who.strip(), text.strip(); who = '' if who == '(no speaker)' else who
            if (who, text) == (o['who'], o['text']): continue
            old = "{who:'%s',text:'%s'}" % (q(o['who']), q(o['text'])); new = "{who:'%s',text:'%s'}" % (q(who), q(text))
        else:
            text = body.strip()
            if text == o['text']: continue
            old, new = "'%s'" % q(o['text']), "'%s'" % q(text)
        k = src.count(old)
        if not k: print('not found, skipped:', i); continue
        src = src.replace(old, new); changed += 1; print(f'{i}: changed in {k} place(s)')
    open(HTML, 'w').write(src); print(changed, 'lines changed; run export again to refresh the markers')
{'export': export, 'apply': apply}[sys.argv[1]]()
