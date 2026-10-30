# Merges the chunk PDFs.
#   measure: reads the invisible page markers and writes out/layout.json (used for the contents pages and the Word page breaks).
#   final:   stamps headers/footers, adds bookmarks and re-checks every contents entry against the page text.
import json, sys, re, pymupdf

m = json.load(open(sys.argv[1], encoding='utf-8'))
doc = pymupdf.open()
for f in m['files']:
    doc.insert_pdf(pymupdf.open(f))
MARK = re.compile(r'@@([A-Z][\d.]*)@@')

if m['mode'] == 'measure':
    markers = {}
    for i, p in enumerate(doc):
        for key in MARK.findall(p.get_text()):
            if key in markers: sys.exit(f'duplicate page marker {key}')
            markers[key] = i  # page index; the cover is index 0, so this equals the printed page number
    json.dump({'markers': markers, 'pageCount': doc.page_count}, open('out/layout.json', 'w'))
    doc.save(m['output'])  # kept for checking where pages break
    print('measured', doc.page_count, 'pages,', len(markers), 'markers')
    sys.exit(0)

pages = m['pages']
norm = lambda s: re.sub(r'\s+', ' ', s).strip()
texts = [norm(p.get_text()) for p in doc]
leftover = [i for i, t in enumerate(texts) if '@@' in t]
if leftover: sys.exit(f'page markers left in final PDF on pages {leftover}')
errors = []
squash = lambda s: re.sub(r'\s+', '', s)
for e in m['toc']:
    want = squash(e['num'] + e['text'])[:40]
    if want not in squash(texts[pages[e['id']]]): errors.append(f"heading '{e['num']} {e['text']}' not on page {pages[e['id']]}")
for f in m['figures'] + m['tables']:
    if f['label'] + ':' not in texts[pages[f['label']]]: errors.append(f"{f['label']} not on page {pages[f['label']]}")
if errors: sys.exit('contents check failed:\n' + '\n'.join(errors))

grey = (0.48, 0.52, 0.5)
for i, p in enumerate(doc):
    if i == 0: continue
    w, h = p.rect.width, p.rect.height
    mx = 57 if w < h else 51
    p.insert_text((mx, 34), 'CivicFlow – Public Service Complaint & Resolution System', fontsize=7.5, fontname='helv', color=grey)
    t = 'ICT2232 · Group 15'; p.insert_text((w - mx - pymupdf.get_text_length(t, 'helv', 7.5), 34), t, fontsize=7.5, fontname='helv', color=grey)
    p.draw_line((mx, 39), (w - mx, 39), color=(0.85, 0.87, 0.86), width=0.6)
    p.insert_text((mx, h - 26), 'Final project report', fontsize=8, fontname='helv', color=grey)
    t = f'Page {i}'; p.insert_text((w - mx - pymupdf.get_text_length(t, 'helv', 8), h - 26), t, fontsize=8, fontname='helv', color=grey)
outline = [[1, 'Cover', 1], [1, 'Declaration', 2], [1, 'Executive summary', 3],
           [1, 'Table of contents', pages['X0'] + 1], [1, 'List of figures', pages['X1'] + 1], [1, 'List of tables', pages['X2'] + 1]]
for e in m['toc']:
    outline.append([e['level'], f"{e['num']} {e['text']}", pages[e['id']] + 1])
doc.set_toc(outline)
doc.set_metadata({'title': 'CivicFlow – Public Service Complaint & Resolution System: Final Project Report', 'author': 'Group 15 – ICT2232 Software Engineering', 'subject': 'SDLC project report', 'keywords': 'CivicFlow, SDLC, Scrum, UML, Supabase'})
doc.save(m['output'], garbage=3, deflate=True)
print('merged', doc.page_count, 'pages ->', m['output'], '(contents check passed)')
