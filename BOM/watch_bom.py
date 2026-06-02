#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
HiNAS Control 2.0 - BOM Process Diagram Server
엑셀 열 추가/변경에 강한 버전 (필수 열만 찾아서 사용)
"""
import json, os, sys, time, threading
import urllib.parse, mimetypes
from http.server import HTTPServer, BaseHTTPRequestHandler

try:
    import openpyxl
    HAS_OPENPYXL = True
except ImportError:
    HAS_OPENPYXL = False

try:
    import xlrd
    HAS_XLRD = True
except ImportError:
    HAS_XLRD = False

_state = {'rows':[],'timestamp':0,'updated':'-','excel_name':'','row_count':0}
_lock  = threading.Lock()
_html  = b''

# ── HTML 로드 ──────────────────────────────────────────
def load_html():
    d = os.path.dirname(os.path.abspath(__file__))
    for name in ['HiNAS_process.html','index.html']:
        for enc in ['utf-8','cp949']:
            try:
                with open(os.path.join(d,name),'r',encoding=enc) as f:
                    c=f.read()
                print(f'  [OK] HTML: {name}')
                return c.encode('utf-8')
            except: continue
    for fname in os.listdir(d):
        if fname.lower().endswith('.html'):
            for enc in ['utf-8','cp949']:
                try:
                    with open(os.path.join(d,fname),'r',encoding=enc) as f:
                        c=f.read()
                    print(f'  [OK] HTML(scan): {fname}')
                    return c.encode('utf-8')
                except: continue
    print('  [ERROR] HTML not found')
    return b'<html><body><h2>HTML file not found</h2></body></html>'

# ── 파일 형식 감지 ──────────────────────────────────────
def detect_fmt(path):
    try:
        with open(path,'rb') as f: h=f.read(4)
        if h[:4]==b'PK\x03\x04': return 'xlsx'
        if h[:4]==b'\xd0\xcf\x11\xe0': return 'xls'
        return 'unknown'
    except: return 'unknown'

# ── 헤더 행 감지 (더 넓은 키워드) ─────────────────────
HEADER_KEYS = {
    'no.','no','item name','item','locaition','location','loc',
    '공정 유형','공정유형','공정담당','담당','maker','qty','qty.',
    'part number','part no','p/n'
}
def is_header(vals):
    return sum(1 for v in vals if str(v).strip().lower() in HEADER_KEYS) >= 2

# ── xlsx 읽기 ──────────────────────────────────────────
def read_xlsx(path):
    rows=[]
    if not HAS_OPENPYXL: return rows
    try:
        wb=openpyxl.load_workbook(path,data_only=True,read_only=True)
        ws=wb.active; header=None
        for row in ws.iter_rows(values_only=True):
            vals=[str(c if c is not None else '').strip() for c in row]
            if header is None:
                if is_header(vals): header=vals
            elif any(v for v in vals):
                rows.append({header[i]:vals[i] if i<len(vals) else ''
                             for i in range(len(header))})
        wb.close()
        print(f'  [OK] xlsx: {len(rows)} rows')
        if rows: print(f'  [INFO] Headers: {list(rows[0].keys())}')
    except Exception as e: print(f'  [ERROR] xlsx: {e}')
    return rows

# ── xls 읽기 ──────────────────────────────────────────
def read_xls(path):
    rows=[]
    if not HAS_XLRD: return rows
    try:
        wb=xlrd.open_workbook(path); ws=wb.sheet_by_index(0); header=None
        for i in range(ws.nrows):
            vals=[str(ws.cell_value(i,j)).strip() for j in range(ws.ncols)]
            if header is None:
                if is_header(vals): header=vals
            elif any(v for v in vals):
                rows.append({header[j]:vals[j] if j<len(vals) else ''
                             for j in range(len(header))})
        print(f'  [OK] xls: {len(rows)} rows')
    except Exception as e: print(f'  [ERROR] xls: {e}')
    return rows

def read_excel(path):
    fmt=detect_fmt(path)
    print(f'  [INFO] format={fmt}')
    if fmt=='xlsx': return read_xlsx(path)
    if fmt=='xls':  return read_xls(path)
    r=read_xlsx(path)
    return r if r else read_xls(path)

# ── 파일 감시 ──────────────────────────────────────────
def watch_loop(path):
    last=0
    print(f'  [WATCH] {os.path.basename(path)}')
    while True:
        try:
            if os.path.exists(path):
                mt=os.path.getmtime(path)
                if mt!=last:
                    rows=read_excel(path)
                    if rows:
                        now=time.strftime('%Y-%m-%d %H:%M:%S')
                        with _lock:
                            _state['rows']=rows
                            _state['timestamp']=int(time.time())
                            _state['updated']=now
                            _state['row_count']=len(rows)
                        last=mt
                        print(f'  [UPDATE] {now}  {len(rows)} rows')
        except PermissionError: pass
        except Exception as e: print(f'  [ERR] {e}')
        time.sleep(2)

# ── HTTP ──────────────────────────────────────────────
class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        p=self.path.split('?')[0]
        if p=='/':
            self._send(200,'text/html; charset=utf-8',_html)
        elif p=='/api/data':
            with _lock: body=json.dumps(_state,ensure_ascii=False).encode('utf-8')
            self._send(200,'application/json; charset=utf-8',body)
        elif p.startswith('/images/'):
            self._serve_image(p[8:])
        else: self.send_error(404)

    def _serve_image(self, raw):
        fname = urllib.parse.unquote(raw).strip()
        # 보안: 경로 탐색 방지
        if not fname or '/' in fname or '\\' in fname or '..' in fname:
            self.send_error(400); return
        base = os.path.dirname(os.path.abspath(__file__))
        # images 폴더를 대소문자 무관하게 탐색
        img_dir = None
        try:
            for d in os.listdir(base):
                if d.lower() == 'images' and os.path.isdir(os.path.join(base, d)):
                    img_dir = os.path.join(base, d); break
        except Exception: pass
        if not img_dir:
            print(f'  [IMG] images 폴더를 찾을 수 없음: {base}')
            self.send_error(404); return
        # 파일을 대소문자 무관하게 탐색
        fname_lower = fname.lower()
        img_path = None
        try:
            for f in os.listdir(img_dir):
                if f.lower() == fname_lower:
                    img_path = os.path.join(img_dir, f); break
        except Exception: pass
        if not img_path:
            print(f'  [IMG] 404: {fname}')
            self.send_error(404); return
        ext = fname.rsplit('.', 1)[-1].lower() if '.' in fname else ''
        ctypes = {'jpg':'image/jpeg','jpeg':'image/jpeg','png':'image/png',
                  'gif':'image/gif','webp':'image/webp','bmp':'image/bmp'}
        ctype = ctypes.get(ext, 'application/octet-stream')
        try:
            with open(img_path, 'rb') as f: body = f.read()
            print(f'  [IMG] 200: {fname} ({len(body)//1024}KB)')
            self._send(200, ctype, body)
        except Exception as e:
            print(f'  [IMG] 읽기 오류: {e}')
            self.send_error(500)
    def _send(self,code,ctype,body):
        self.send_response(code)
        self.send_header('Content-Type',ctype)
        self.send_header('Content-Length',len(body))
        self.send_header('Cache-Control','no-cache, no-store, must-revalidate')
        self.send_header('Pragma','no-cache')
        self.send_header('Access-Control-Allow-Origin','*')
        self.end_headers()
        self.wfile.write(body)
    def log_message(self,*a): pass

# ── 메인 ──────────────────────────────────────────────
def main():
    global _html
    print()
    print('  =============================================')
    print('   HiNAS Control 2.0  BOM Process Diagram v5')
    print('  =============================================')
    print()

    if not HAS_OPENPYXL and not HAS_XLRD:
        print('  [ERROR] Run: pip install openpyxl')
        input('  Press Enter...'); sys.exit(1)

    if not HAS_XLRD:
        try:
            import subprocess
            subprocess.check_call([sys.executable,'-m','pip','install','xlrd','-q'],
                stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
            import xlrd as _x; globals()['xlrd']=_x; globals()['HAS_XLRD']=True
            print('  [OK] xlrd installed')
        except: pass

    print('  [INFO] Loading HTML...')
    _html=load_html()

    if len(sys.argv)>1:
        excel_path=os.path.abspath(sys.argv[1])
    else:
        cwd=os.path.dirname(os.path.abspath(__file__))
        files=[f for f in os.listdir(cwd)
               if f.lower().endswith(('.xlsx','.xls')) and not f.startswith('~$')]
        if not files:
            print(f'  [ERROR] No Excel file in: {cwd}')
            input('  Press Enter...'); sys.exit(1)
        excel_path=os.path.join(cwd,files[0])

    _state['excel_name']=os.path.basename(excel_path)
    print(f'  [OK] BOM: {os.path.basename(excel_path)}')

    rows=read_excel(excel_path)
    with _lock:
        _state['rows']=rows
        _state['timestamp']=int(time.time())
        _state['updated']=time.strftime('%Y-%m-%d %H:%M:%S')
        _state['row_count']=len(rows)

    if len(rows)==0:
        print('  [WARN] 0 rows! 헤더 행에 다음 중 하나가 있어야 합니다:')
        print('         Item name / Locaition / 공정 유형 / 공정담당 / MAKER')
    else:
        print(f'  [OK] Loaded: {len(rows)} rows')

    threading.Thread(target=watch_loop,args=(excel_path,),daemon=True).start()

    # images 폴더 확인 및 파일 목록 출력
    base = os.path.dirname(os.path.abspath(__file__))
    img_dir = None
    for d in os.listdir(base):
        if d.lower() == 'images' and os.path.isdir(os.path.join(base, d)):
            img_dir = os.path.join(base, d); break
    if img_dir:
        imgs = [f for f in os.listdir(img_dir)
                if f.lower().endswith(('.jpg','.jpeg','.png','.gif','.webp','.bmp'))]
        print(f'  [IMG] images 폴더: {len(imgs)}개 파일')
        for f in imgs: print(f'        - {f}')
    else:
        print(f'  [IMG] images 폴더 없음 — BOM 폴더 안에 "images" 폴더를 생성하세요')

    PORT=8080
    try: server=HTTPServer(('localhost',PORT),Handler)
    except: PORT=8081; server=HTTPServer(('localhost',PORT),Handler)

    url=f'http://localhost:{PORT}'
    print(f'\n  [SERVER] {url}')
    print(f'  [INFO]   Excel 저장 → 2초 감지 → 브라우저 3초 갱신')
    print(f'  [STOP]   Ctrl+C\n')
    try: server.serve_forever()
    except KeyboardInterrupt: print('\n  Stopped.')

if __name__=='__main__': main()
