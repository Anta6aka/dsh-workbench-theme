# Theme assets

The current client bundles six unchanged original images, the earlier transparent standee, two panel crops from the user-selected phone-case photograph, and one locally authored APTX capsule SVG. Frames, cropping, silver reflections and contour shadows are CSS treatments. Source imagery is not covered by the MIT code license. Older wallpaper provenance is retained below as history; those wallpaper bytes are no longer in the client bundle.

| File | Source | SHA-256 |
| --- | --- | --- |
| ytv-portrait.png | https://www.ytv.co.jp/conan/character/haibara/ | 35e435d9eb85a4f4b47d83f0881d4b978c4486313597a02252cdab21d5313d31 |
| ytv-still-01.jpg | https://www.ytv.co.jp/conan/character/haibara/ | 33fe019ac82d6a91ef9420048d79ed527aa0109782d20db11dd1874667cc36a9 |
| ytv-still-02.jpg | https://www.ytv.co.jp/conan/character/haibara/ | 334669e7699634c34001930346674f3cc77863d9191f84828a07a3474429fb4a |
| ytv-still-03.jpg | https://www.ytv.co.jp/conan/character/haibara/ | e1e70c138923739b9af40a6ede91292bb7ad655290a541e7cc738669bd33f091 |
| tms-submarine-08.jpg | https://tmsanime.com/detective-conan-black-iron-submarine | 7d2ea57ceb5f4f2fd30515f36f421422fc5104e3f985f12d04b67c0198dd221b |
| shogakukan-character.jpg | https://www.conan-portal.com/index_normal.html | ec9db29c49cca492ea945a330207239ecef53fc36133a83724fd266c710c8b18 |


## Earlier transparent standee

`haibara-standee.png` is the earlier phone-case-inspired transparent reconstruction generated in this task, explicitly selected again by the user. It is a distinct source from the official YTV illustration, and its bytes are unchanged. SHA-256: `f9a51ab73383dc112703111709ac2f3e35edc3df97901c4761239f4af0b8a296`. The character remains associated with the original rights holders; it is not described as an official source image.

## Additional chat / pet visuals

These files are kept for the current local fan customization. They are not MIT-licensed and no redistribution license is granted here; confirm rights or replace them before publishing a public asset bundle.

| File | Source / note | Status |
| --- | --- | --- |
| art-pastel.jpg | User-selected pastel artwork; exact upstream author unknown | Local fan use only |
| art-winter.png | User-selected pixel Christmas artwork; exact upstream author unknown | Local fan use only |
| chat-bg-1.jpg | Derived from the user-selected F image, originally via wallpapers.com pensive Haibara wallpaper | Third-party wallpaper; not MIT |
| chat-bg-2.jpg | Derived from the user-selected G image, originally via wallpapers.com Haibara-in-action wallpaper | Third-party wallpaper; not MIT |
| chat-bg-3.jpg | 16:9 derivative of the user-selected pastel artwork | Local fan use only |
| haibara-dock.png | User-selected Haibara sticker crop | Local fan use only |

## Pet sticker / animation source

The sticker pack used to build the pet animations came from the Bilibili video **《小柯小哀表情包分享》**:

- https://www.bilibili.com/video/BV1NkhU6oExk/
- The video's uploader is credited as the source of the shared sticker set.
- Stickers were cropped/converted into local WebM actions; no ownership is claimed.
- If the uploader or a rights holder objects, remove the derived animation files on request.

`phonecase-panel-observe.jpg` and `phonecase-panel-gesture.jpg` are the personal phone-case photograph crops already described below; they are not licensed for public redistribution.

<!-- brand-fonts:start -->
## Bundled display-font subsets

The following official Google Fonts text subsets are embedded locally in the Client CSS. Runtime font loading does not contact Google. Their original copyright notices and SIL Open Font License 1.1 texts are included under `docs/fonts`; these fonts are not relicensed under the application MIT license.

| Local resource | Official family/style | Exact public API text input | SHA-256 |
| --- | --- | --- | --- |
| `src/assets/fonts/bihu-display-serif-600.woff2` | Noto Serif SC 600 normal | `比护的 AI 工作台 Bihu AI Workbench` | `89cdd4aa71c51b7ab0b1c940fd71d43b4ecd3e0aea66efafd9a0aa5379e6f350` |
| `src/assets/fonts/haibara-signature-600-italic.woff2` | Cormorant Garamond 600 italic | `AI Ai Haibara` | `3ab8e9094fc2b5ebf6b86fbd1dd04679d20c06d342a2b5d4c31d60303f76627d` |

- **Noto Serif SC**: [official source](https://github.com/google/fonts/tree/main/ofl/notoserifsc), [CSS2 subset request](https://fonts.googleapis.com/css2?family=Noto+Serif+SC%3Awght%40600&display=swap&text=%E6%AF%94%E6%8A%A4%E7%9A%84+AI+%E5%B7%A5%E4%BD%9C%E5%8F%B0+Bihu+AI+Workbench), [original copyright/OFL](docs/fonts/NotoSerifSC-OFL.txt). Returned subset: `U+20, U+41-42, U+49, U+57, U+62-63, U+65, U+68-69, U+6b, U+6e-6f, U+72, U+75, U+4f5c, U+53f0, U+5de5, U+62a4, U+6bd4, U+7684`.
- **Cormorant Garamond**: [official source](https://github.com/google/fonts/tree/main/ofl/cormorantgaramond), [CSS2 subset request](https://fonts.googleapis.com/css2?family=Cormorant+Garamond%3Aital%2Cwght%401%2C600&text=AI+Ai+Haibara&display=swap), [original copyright/OFL](docs/fonts/CormorantGaramond-OFL.txt). Returned subset: `U+20, U+41, U+48-49, U+61-62, U+69, U+72`.

The CSS aliases are `Workbench Display Serif` and `Workbench Signature`. Full response URLs and resource/license checksums are recorded in `docs/fonts/sources.json`; refresh instructions are in `docs/fonts/README.md`.
<!-- brand-fonts:end -->

## Home silver-frame story panels

`phonecase-panel-observe.jpg` and `phonecase-panel-gesture.jpg` are rectangular crops of the two printed panels on the user's previously selected `IMG_1338.HEIC` phone-case photograph, using its existing JPEG conversion. Only orientation, cropping, proportional downsampling and JPEG encoding were applied. Expressions and gestures were not redrawn; silver/grayscale appearance is a CSS treatment. No new external image download or generated replacement is used.

The user's authorization covers this current local customization. The depicted artwork remains associated with its original rights holders; these images are not described as MIT, public domain, or licensed for general redistribution. Crop coordinates, exact source and resulting resource SHA values are recorded in `docs/artwork/phonecase-panels.sources.json`. The complete personal photograph is not bundled.
