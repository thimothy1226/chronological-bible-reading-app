"""Read-only official KKJV comparison. Keeps chapter checkpoints; no app mutation."""
import collections, datetime, difflib, hashlib, json, pathlib, re, sys, time, unicodedata, zipfile
import subprocess, html

archive, out, book, chapters = sys.argv[1], pathlib.Path(sys.argv[2]), int(sys.argv[3]), int(sys.argv[4])
out.mkdir(parents=True, exist_ok=True)
app = collections.defaultdict(list)
with zipfile.ZipFile(archive) as z:
    for name in sorted(z.namelist()):
        if not re.fullmatch(r'korkkjv\d+\.bdf', name, re.I): continue
        for line in z.read(name).decode('cp949').splitlines():
            m = re.match(r'^(\d+).*?\s+(\d+):(\d+)\s+(.+)$', line)
            if m and int(m[1]) == book: app[(int(m[2]),int(m[3]))].append(m[4].strip())
rows, coverage = [], []
for ch in range(1, chapters+1):
    url = f'https://www.biblemaster.co.kr/bible/kjv.php?book={book}&mod=text&mode=viewbible&r=1&start={ch}'
    cache = out / f'book-{book}-chapter-{ch}.json'
    if cache.exists(): record=json.loads(cache.read_text())
    else:
        for attempt in range(2):
            try:
                raw=subprocess.check_output(['curl','--fail','--silent','--show-error','--max-time','35',url]).decode('utf-8')
                if 'class="bible_view2"' not in raw: raise ValueError('Official chapter content absent')
                container=raw.split('class="bible_view2"',1)[1]
                title=html.unescape(re.sub('<[^>]+>','',re.search(r'<h2>(.*?)</h2>',container,re.S)[1]))
                verses={}
                for label, body in re.findall(r'<p class="bible_cv">(.*?)</p>\s*<p class="bible_text[^"]*">(.*?)</p>',container,re.S):
                    label=label.strip()
                    if not label.isdigit(): raise ValueError('Non-numeric verse label: '+label)
                    v=int(label)
                    if v in verses: raise ValueError('Duplicate official verse')
                    verses[v]=html.unescape(re.sub('<[^>]+>','',body)).strip()
                if not verses or sorted(verses)!=list(range(1,max(verses)+1)): raise ValueError('Official numbering gap')
                record={'url':url,'retrieved':datetime.datetime.now(datetime.timezone.utc).isoformat(),'title':title,'verses':verses}
                cache.write_text(json.dumps(record,ensure_ascii=False,indent=2))
                break
            except Exception as e:
                if attempt: raise
                print(f'RETRY {book}:{ch}: {e}',flush=True)
                time.sleep(2)
        time.sleep(.5)
    official={int(v):t for v,t in record['verses'].items()}
    if not re.search(rf'\b{ch}\s*장',record['title']): raise ValueError('Chapter title mismatch')
    for v in sorted(set(official)|{v for c,v in app if c==ch}):
        values=app.get((ch,v),[]); a=' '.join(values); b=official.get(v,'')
        if a==b and len(values)==1: continue
        no_ws=lambda s: re.sub(r'\s','',s)
        letters=lambda s: ''.join(c for c in s if not c.isspace() and not unicodedata.category(c).startswith('P'))
        kind='본문 차이(판본 확인 필요)'
        if len(values)>1: kind='앱 절 번호 중복'
        elif not a or not b: kind='절 구조 확인 필요'
        elif no_ws(a)==no_ws(b): kind='띄어쓰기'
        elif letters(a)==letters(b): kind='문장부호·띄어쓰기'
        # Minimal changed fragments, not full official verse reproduction.
        changes=[{'app':a[i:j],'official':b[k:l]} for op,i,j,k,l in difflib.SequenceMatcher(None,a,b,autojunk=False).get_opcodes() if op!='equal']
        rows.append({'chapter':ch,'verse':v,'category':kind,'changes':changes,'url':record['url']})
    coverage.append({'chapter':ch,'app':sum(len(t) for (c,v),t in app.items() if c==ch),'official':len(official)})
    print(f'CHAPTER {book}:{ch}/{chapters} official={len(official)}',flush=True)
report={'book':book,'status':'comparison_complete_requires_edition_review','source_sha256':hashlib.sha256(pathlib.Path(archive).read_bytes()).hexdigest(),'coverage':coverage,'counts':dict(collections.Counter(r['category'] for r in rows)),'differences':rows}
(out/f'book-{book}-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
print('COMPLETE '+json.dumps(report['counts'],ensure_ascii=False),flush=True)
