"""Build docs/preview.html: the whole website in one file that opens by double-click.

Browsers block fetch() for files opened straight from disk, so the normal page
cannot load docs/data/*.json that way. This script copies docs/index.html and
inlines the stylesheet, every script and the six JSON files (as
window.SITE_DATA, which docs/js/data.js uses instead of fetching).

Run after src/export_web_data.py:

    python src/build_preview.py
"""

from pathlib import Path
import json
import re

DOCS = Path(__file__).resolve().parent.parent / 'docs'
DATA_FILES = ['facts', 'events', 'dial', 'models', 'blocks', 'rules', 'charts']


def safe_for_script(text):
    # A literal "</script>" inside an inline script would end it early.
    return text.replace('</', '<\\/')


def main():
    page = (DOCS / 'index.html').read_text()

    # 1. Stylesheet -> <style>
    css = (DOCS / 'css' / 'style.css').read_text()
    page = page.replace('<link rel="stylesheet" href="css/style.css">', '<style>\n' + css + '\n</style>')

    # 2. Remove the deferred <script src> tags from <head>, keeping their order.
    script_pattern = re.compile(r'\s*<script src="(js/[\w/-]+\.js)" defer></script>')
    script_paths = script_pattern.findall(page)
    page = script_pattern.sub('', page)

    # 3. Data first, then every script in the original order, at the end of <body>
    #    (inline scripts run immediately, so they must come after the HTML they use).
    data = {name: json.loads((DOCS / 'data' / f'{name}.json').read_text()) for name in DATA_FILES}
    inline = ['<script>window.SITE_DATA = ' + safe_for_script(json.dumps(data, separators=(',', ':'))) + ';</script>']
    for path in script_paths:
        inline.append('<script>\n' + safe_for_script((DOCS / path).read_text()) + '\n</script>')
    page = page.replace('</body>', '\n'.join(inline) + '\n</body>')

    output = DOCS / 'preview.html'
    output.write_text(page)
    print(f'wrote {output} ({output.stat().st_size:,} bytes, {len(script_paths)} scripts inlined)')


if __name__ == '__main__':
    main()
