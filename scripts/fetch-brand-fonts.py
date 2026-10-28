#!/usr/bin/env python3
"""Refresh public brand-text font subsets and their unmodified OFL notices.

Uses Python's standard library and honors HTTPS_PROXY. This is an explicit asset
maintenance command; neither the application nor the build contacts font hosts.
"""
import hashlib
import json
from pathlib import Path
import re
from urllib.parse import urlencode, urlsplit
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
USER_AGENT = ('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) '
              'AppleWebKit/537.36 (KHTML, like Gecko) '
              'Chrome/131.0.0.0 Safari/537.36')
FONTS = [
    {
        'family': 'Noto Serif SC', 'alias': 'Workbench Display Serif',
        'query': 'Noto Serif SC:wght@600', 'style': 'normal', 'weight': 600,
        'text': '比护的 AI 工作台 Bihu AI Workbench',
        'filename': 'bihu-display-serif-600.woff2',
        'license_filename': 'NotoSerifSC-OFL.txt',
        'license_url': 'https://raw.githubusercontent.com/google/fonts/main/ofl/notoserifsc/OFL.txt',
        'source_url': 'https://github.com/google/fonts/tree/main/ofl/notoserifsc',
    },
    {
        'family': 'Cormorant Garamond', 'alias': 'Workbench Signature',
        'query': 'Cormorant Garamond:ital,wght@1,600', 'style': 'italic', 'weight': 600,
        'text': 'AI Ai Haibara',
        'filename': 'haibara-signature-600-italic.woff2',
        'license_filename': 'CormorantGaramond-OFL.txt',
        'license_url': 'https://raw.githubusercontent.com/google/fonts/main/ofl/cormorantgaramond/OFL.txt',
        'source_url': 'https://github.com/google/fonts/tree/main/ofl/cormorantgaramond',
    },
]


def download(url):
    with urlopen(Request(url, headers={'User-Agent': USER_AGENT}), timeout=30) as response:
        return response.read()


def digest(data):
    return hashlib.sha256(data).hexdigest()


def font_css(records):
    blocks = ['/* Public wordmark subsets are bundled locally; other text retains the native font stack. */']
    for record in records:
        blocks.append("@font-face {\n"
                      "  font-family: '" + record['alias'] + "';\n"
                      "  src: url('./assets/fonts/" + record['filename'] + "') format('woff2');\n"
                      "  font-style: " + record['style'] + ";\n"
                      "  font-weight: " + str(record['weight']) + ";\n"
                      "  font-display: swap;\n"
                      "  unicode-range: " + record['unicode_range'] + ";\n}")
    return '\n\n'.join(blocks) + '\n'


def download_font(config):
    css_url = 'https://fonts.googleapis.com/css2?' + urlencode({
        'family': config['query'], 'display': 'swap', 'text': config['text'],
    })
    css_bytes = download(css_url)
    css = css_bytes.decode('utf-8')
    urls = re.findall(r'url\([\"\x27]?(https://[^\s\"\x27)]+)[\"\x27]?\)\s*format\([\"\x27]woff2[\"\x27]\)', css)
    if len(urls) != 1 or urlsplit(urls[0]).hostname != 'fonts.gstatic.com':
        raise RuntimeError('Expected exactly one official WOFF2 subset for ' + config['family'])
    if not re.search(r'font-weight:\s*600\s*;', css) or not re.search(r'font-style:\s*' + config['style'] + r'\s*;', css):
        raise RuntimeError('Font weight/style changed for ' + config['family'])
    match = re.search(r'unicode-range:\s*([^;]+);', css)
    if match is None:
        raise RuntimeError('Missing subset range for ' + config['family'])
    ranges = match.group(1)
    admitted = set()
    for part in ranges.split(','):
        limits = part.strip().removeprefix('U+').split('-')
        start = int(limits[0], 16)
        stop = int(limits[-1], 16)
        admitted.update(range(start, stop + 1))
    if admitted != {ord(character) for character in config['text']}:
        raise RuntimeError('The returned subset does not match the requested public wordmark')
    font = download(urls[0])
    if font[:4] != b'wOF2':
        raise RuntimeError('The response is not WOFF2; do not relabel another format')
    license_bytes = download(config['license_url'])
    if b'SIL OPEN FONT LICENSE Version 1.1' not in license_bytes:
        raise RuntimeError('Expected the original SIL Open Font License')
    record = {**config, 'api_url': css_url, 'font_url': urls[0],
              'unicode_range': ranges, 'bytes': len(font), 'sha256': digest(font),
              'license_sha256': digest(license_bytes), 'css_sha256': digest(css_bytes)}
    return record, font, license_bytes, css_bytes


def main():
    # Finish and validate every network read before replacing any local resource.
    downloads = [download_font(config) for config in FONTS]
    assets = ROOT / 'src/assets/fonts'
    docs = ROOT / 'docs/fonts'
    assets.mkdir(parents=True, exist_ok=True)
    docs.mkdir(parents=True, exist_ok=True)
    records = []
    for record, font, license_bytes, css_bytes in downloads:
        records.append(record)
        (assets / record['filename']).write_bytes(font)
        (docs / record['license_filename']).write_bytes(license_bytes)
        (docs / (record['filename'] + '.source.css')).write_bytes(css_bytes)
    (docs / 'sources.json').write_text(json.dumps({'user_agent': USER_AGENT, 'fonts': records}, ensure_ascii=False, indent=2) + '\n')
    (ROOT / 'src/brand-fonts.css').write_text(font_css(records))
    (docs / 'README.md').write_text('''# Brand display fonts

These are locally bundled Google Fonts text subsets. The Chinese and English application names use Noto Serif SC 600; the AI accent and decorative signature use Cormorant Garamond 600 italic. Other interface and document text continues to use its existing fonts.

The exact public API text inputs, returned Unicode ranges, font URLs, byte lengths and SHA-256 checksums are recorded in `sources.json`. The `.source.css` files preserve the official subset responses. The two `OFL.txt` files retain their original copyright notices and SIL Open Font License text without edits.

To intentionally refresh the assets, run `python3 scripts/fetch-brand-fonts.py` from a checkout with HTTPS access. The script honors `HTTPS_PROXY`; no font tools or additional Python packages are required. It validates the returned WOFF2 magic, weight, style and exact character set, then updates the assets, source records, `brand-fonts.css` (including its Unicode ranges), and the font section of `THIRD_PARTY_NOTICES.md` together.

The normal application and build make no Google Fonts requests. `src/brand-fonts.css` refers only to local assets, which the Client build embeds as WOFF2 data URLs. These subsets contain only the specified wordmarks; changing or adding a localized wordmark requires updating the explicit text inputs before refreshing.
''')
    section = ['<!-- brand-fonts:start -->', '## Bundled display-font subsets', '',
               'The following official Google Fonts text subsets are embedded locally in the Client CSS. Runtime font loading does not contact Google. Their original copyright notices and SIL Open Font License 1.1 texts are included under `docs/fonts`; these fonts are not relicensed under the application MIT license.', '',
               '| Local resource | Official family/style | Exact public API text input | SHA-256 |',
               '| --- | --- | --- | --- |']
    for record in records:
        section.append('| `src/assets/fonts/' + record['filename'] + '` | ' + record['family'] + ' 600 ' + record['style'] + ' | `' + record['text'] + '` | `' + record['sha256'] + '` |')
    section.append('')
    for record in records:
        section.append('- **' + record['family'] + '**: [official source](' + record['source_url'] + '), [CSS2 subset request](' + record['api_url'] + '), [original copyright/OFL](docs/fonts/' + record['license_filename'] + '). Returned subset: `' + record['unicode_range'] + '`.')
    section += ['', 'The CSS aliases are `Workbench Display Serif` and `Workbench Signature`. Full response URLs and resource/license checksums are recorded in `docs/fonts/sources.json`; refresh instructions are in `docs/fonts/README.md`.', '<!-- brand-fonts:end -->']
    notices = ROOT / 'THIRD_PARTY_NOTICES.md'
    text = notices.read_text()
    block = '\n'.join(section)
    if '<!-- brand-fonts:start -->' in text:
        text = re.sub(r'<!-- brand-fonts:start -->[\s\S]*?<!-- brand-fonts:end -->', lambda _: block, text)
    else:
        text = text.rstrip() + '\n\n' + block + '\n'
    notices.write_text(text)
    for record in records:
        print(record['filename'], record['bytes'], record['sha256'])


if __name__ == '__main__':
    main()
