#!/usr/bin/env python3
"""Builds studio-single.html: the whole Studio (shell, themes, and every app listed in apps.json)
in ONE file, so it can be opened straight from a file manager with no web address.
Run it again after you add or change an app:  python3 tools/build_single.py"""
import json, os

root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
def rd(p): return open(os.path.join(root, p), encoding='utf-8').read()
def safe(s): return s.replace('</', '<\\/').replace('<!--', '<\\!--')

manifest = json.loads(rd('apps.json'))
theme, appjs = rd('core/theme.css'), rd('core/app.js')
files = {}
for a in manifest['apps']:
    html = rd(a['entry'])
    html = html.replace('<link rel="stylesheet" href="../../core/theme.css">', '<style>' + theme + '</style>')
    html = html.replace('<script src="../../core/app.js"></script>', '<script>' + appjs + '</script>')
    assert '../../core' not in html, 'app %s uses a file the single build cannot inline' % a['id']
    files[a['id']] = html

page = rd('index.html')
shell_js = rd('core/shell.js')
assert '</script' not in shell_js
page = page.replace('<link rel="manifest" href="manifest.webmanifest">\n', '').replace('<link rel="icon" href="icon-192.png">\n', '')
page = page.replace('<link rel="stylesheet" href="core/theme.css">', '<style>' + theme + '</style>')
page = page.replace('<link rel="stylesheet" href="core/shell.css">', '<style>' + rd('core/shell.css') + '</style>')
sync_js = rd('core/sync.js')
assert '</script' not in sync_js and '</script' not in appjs
embed = ('<script>window.__EMBED=' + safe(json.dumps({'manifest': manifest, 'files': files})) + ';</script>\n'
         '<script>' + appjs + '</script>\n<script>' + sync_js + '</script>\n<script>' + shell_js + '</script>')
old = '<script src="core/app.js"></script>\n<script src="core/sync.js"></script>\n<script src="core/shell.js"></script>'
assert old in page
page = page.replace(old, embed)
out = os.path.join(root, 'studio-single.html')
open(out, 'w', encoding='utf-8').write(page)
print('wrote', out, round(len(page.encode()) / 1024), 'KB')
