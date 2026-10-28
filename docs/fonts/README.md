# Brand display fonts

These are locally bundled Google Fonts text subsets. The Chinese and English application names use Noto Serif SC 600; the AI accent and decorative signature use Cormorant Garamond 600 italic. Other interface and document text continues to use its existing fonts.

The exact public API text inputs, returned Unicode ranges, font URLs, byte lengths and SHA-256 checksums are recorded in `sources.json`. The `.source.css` files preserve the official subset responses. The two `OFL.txt` files retain their original copyright notices and SIL Open Font License text without edits.

To intentionally refresh the assets, run `python3 scripts/fetch-brand-fonts.py` from a checkout with HTTPS access. The script honors `HTTPS_PROXY`; no font tools or additional Python packages are required. It validates the returned WOFF2 magic, weight, style and exact character set, then updates the assets, source records, `brand-fonts.css` (including its Unicode ranges), and the font section of `THIRD_PARTY_NOTICES.md` together.

The normal application and build make no Google Fonts requests. `src/brand-fonts.css` refers only to local assets, which the Client build embeds as WOFF2 data URLs. These subsets contain only the specified wordmarks; changing or adding a localized wordmark requires updating the explicit text inputs before refreshing.
