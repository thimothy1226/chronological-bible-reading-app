#!/usr/bin/env python3
"""Convert user-provided SDB/DCT files only. Never fetch or redistribute a corpus."""
import argparse, collections, hashlib, html, json, re, sqlite3
from pathlib import Path
from html.parser import HTMLParser

class Plain(HTMLParser):
    def __init__(self): super().__init__(convert_charrefs=True); self.parts=[]
    def handle_data(self,data): self.parts.append(data)
    def handle_starttag(self,tag,attrs):
        if tag.lower() in ('br','p','div','li'): self.parts.append('\n')
    def handle_endtag(self,tag):
        if tag.lower() in ('p','div','li'): self.parts.append('\n')

def plain(text):
    parser=Plain();parser.feed(text);parser.close()
    return re.sub(r'\n{3,}', '\n\n', ''.join(parser.parts)).strip()

def dump(path,value): path.write_text(json.dumps(value,ensure_ascii=False,separators=(',',':'))+'\n',encoding='utf-8')

def convert(source, output, canonical):
    output.mkdir(parents=True,exist_ok=True); data=output/'import'; data.mkdir(exist_ok=True)
    archive=output/'source-records';archive.mkdir(exist_ok=True)
    bookNames=[book['book'] for book in json.loads(canonical.read_text())]
    report={'schema':'gf-bible-original-v1','minimumAppVersion':'1.3.23','sources':{},'issues':[]}
    used=set(); dictionaryCodes=set()
    def database(name):
        p=source/name; c=sqlite3.connect(p.resolve().as_uri()+'?mode=ro',uri=True)
        assert c.execute('pragma integrity_check').fetchone()==('ok',),name
        return p,c
    specs=[('개역개정S.sdb','NKRV_S','개역개정_s','ko'),('원전분해.sdb','ORIGINAL_S','원전분해_s','ko'),('KJV_S.sdb','KJV_S','KJV_s','en')]
    for name,ident,label,language in specs:
        p,c=database(name); rows=c.execute('select id,book,chapter,verse,btext from Bible order by id').fetchall();c.close()
        raw_path=archive/(ident+'.source.jsonl')
        with raw_path.open('w',encoding='utf-8') as raw:
            for row in rows:raw.write(json.dumps(row,ensure_ascii=False)+'\n')
        bookMap={}; addresses=set();verses=[];without=0;tag_count=0;normalized=0;invalid=0;zero_placeholders=0
        for rowId,b,ch,v,text in rows:
            address=[b,ch,v]
            if not all(isinstance(n,int) and n>0 for n in address) or b>66 or ch>150 or v>200 or not isinstance(text,str) or not text.strip():
                report['issues'].append({'source':name,'row':rowId,'address':address,'kind':'invalid_or_empty_row','rawPreserved':True});invalid+=1;continue
            assert (b,ch,v) not in addresses,(name,address);addresses.add((b,ch,v)); codes=[]
            def tag(match):
                nonlocal normalized,tag_count,zero_placeholders
                inner=match.group(1)
                if inner in ('i','/i'): return ''
                if re.fullmatch(r'W?[HG]0+[ )]*', inner):
                    zero_placeholders+=1
                    return ''
                exact=re.fullmatch(r'W?([HG])([1-9]\d{0,4})([a-z]?)',inner)
                repair=None
                if not exact:
                    repair=re.fullmatch(r'W?([HG])\s*([1-9]\d{0,4})([a-z]?)([\uac00-\ud7a3].*|[ )]*)',inner)
                # A doubled H in a WHH tag is retained as an explicit normalization issue.
                doubled=re.fullmatch(r'W([HG])\1([1-9]\d{0,4})([a-z]?)',inner) if not exact and not repair else None
                found=exact or repair or doubled
                if found:
                    code=found.group(1)+found.group(2)+found.group(3);codes.append(code);tag_count+=1;used.add(code)
                    if not exact:
                        normalized+=1;report['issues'].append({'source':name,'row':rowId,'address':address,'kind':'tag_normalization','rawTag':inner,'code':code})
                    tail=repair.group(4) if repair else ''
                    return tail if re.search('[\uac00-\ud7a3]',tail) else ''
                report['issues'].append({'source':name,'row':rowId,'address':address,'kind':'unresolved_tag','rawTag':inner,'rawPreserved':True})
                return '['+inner+']'
            readable=re.sub(r'<([^<>]+)>',tag,text).replace('\r\n','\n').replace('\r','\n').strip()
            readable=html.unescape(readable)
            if not codes:without+=1
            bookName=bookNames[b-1];verses.append({'book':bookName,'chapter':ch,'verse':v,'codes':list(dict.fromkeys(codes))})
            bookMap.setdefault(b,{}).setdefault(ch,[]).append({'verse':v,'text':readable})
        bible={'name':label,'language':language,'books':[{'book':bookNames[b-1],'chapters':[{'chapter':ch,'verses':sorted(vs,key=lambda x:x['verse'])} for ch,vs in sorted(chs.items())]} for b,chs in sorted(bookMap.items())]}
        doc={'format':'gf-bible-original-v1','minimumAppVersion':'1.3.23','type':'codes','translationId':ident,'verses':verses,'bible':bible}
        dump(data/(ident+'.json'),doc)
        report['sources'][name]={'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'rows':len(rows),'rawRowsPreserved':len(rows),'validAddresses':len(verses),'books':len(bookMap),'withoutCodes':without,'tagOccurrences':tag_count,'normalizedTags':normalized,'zeroPlaceholders':zero_placeholders,'invalidRows':invalid,'output':ident+'.json'}
    for name,language in [('HebGrkKo.dct','ko'),('HebGrkEn.dct','en')]:
        p,c=database(name);rows=c.execute('select id,scode,dtext from Lexicon order by id').fetchall();c.close();entries={};dups=[]
        with (archive/(name+'.source.jsonl')).open('w',encoding='utf-8') as raw:
            for row in rows:raw.write(json.dumps(row,ensure_ascii=False)+'\n')
        for rowId,code,text in rows:
            assert re.fullmatch(r'[HG][1-9]\d{0,4}[a-z]?',code),(name,code)
            lemma,sep,body=text.partition('^');lemma=plain(lemma) if sep else '';body=plain(body if sep else text)
            assert body.strip(),(name,code)
            trans=re.search(r'Transliteration:\s*([^\n]+)',body)
            e={'lemma':lemma,'transliteration':trans.group(1).strip() if trans else '', 'meaning':body}
            if code in entries:
                dups.append({'code':code,'row':rowId});entries[code]['meaning']+='\n\n[원본의 추가 항목]\n'+body
            else:entries[code]=e
            dictionaryCodes.add(code)
        dump(data/(name.split('.')[0]+'.json'),{'format':'gf-bible-original-v1','minimumAppVersion':'1.3.23','type':'dictionary','language':language,'entries':entries})
        report['sources'][name]={'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'rows':len(rows),'rawRowsPreserved':len(rows),'entries':len(entries),'duplicateRowsMerged':dups,'maxMeaningLength':max(len(e['meaning']) for e in entries.values()),'output':name.split('.')[0]+'.json'}
    report['unresolvedDictionaryCodes']=sorted(used-dictionaryCodes)
    report['usedUniqueCodes']=len(used);report['dictionaryUniqueCodes']=len(dictionaryCodes)
    dump(output/'validation-report.json',report)
    print(json.dumps({'sources':report['sources'],'issueCount':len(report['issues']),'unresolvedDictionaryCodes':len(report['unresolvedDictionaryCodes'])},ensure_ascii=False,indent=2))

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('source',type=Path);p.add_argument('output',type=Path);p.add_argument('--books',type=Path,default=Path(__file__).resolve().parent.parent/'assets/bible-books.json');args=p.parse_args();convert(args.source,args.output,args.books)
