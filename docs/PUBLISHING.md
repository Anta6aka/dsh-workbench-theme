# Publishing

This repository is a local-first DSH theme plus a local pet engine. It is not a drop-in public demo: some files are machine-local or third-party assets.

## Before pushing

1. Do not commit any of these (already ignored):
   - `pet-engine/.auth-token`
   - `pet-data/`
   - `pet-engine/logs/`
   - `pet-engine/.trace/`
   - `pet-engine/.voice/`
   - `pet-engine/.auto-speech.json`
   - `pet-engine/.chat-history.json`
   - `node_modules/`, `dist/`, `*.tgz`
2. Check absolute paths:
   ```bash
   git grep -n -I -E '([A-Za-z]:[\\/](Users|harness|虚拟角色)|/Users/)' -- .
   ```
3. Check personal/derived artwork and media licensing before a public push. `src/assets/` and `media/` contain character/derived images. Replace them with your own licensed assets or placeholders for a public branch.
4. Build and test on a clean checkout:
   ```bash
   npm ci
   npm run build
   npm test
   ```

## Local runtime configuration

Create `pet-data/local-env.json` (ignored) if the defaults do not fit:

```json
{
  "dshPython": "path/to/python-with-Pillow.exe",
  "ttsConfig": "path/to/cmd_config.json"
}
```

`pet-data/tts-config.json` can be used as the default TTS config path. If TTS is not configured, `/say` still works but voice generation is disabled.

## Public branch strategy

Recommended:

- keep this `main` for the personal build and local assets;
- create a `public` branch with placeholder artwork and no `media/` showcase files;
- push `public` only after the licensing check and clean-clone build pass.

Do not add a remote or push from the automation session; that is an explicit manual step.

## Screenshots and video

- Use a separate demo DSH profile/workspace with fake sessions, fake cost data and no personal plugins.
- Never put raw captures in the repo; keep them in `media-captures/` (ignored) and only export final sanitized assets.
- If a real window must be used, crop to the component only and mask sidebar session names, cost/usage and account details.
- Re-check `git ls-files` for screenshot names before every push. If private data was pushed, make the repo private immediately, remove the files from history (fresh orphan history or git filter-repo), then publish a new clean repo.

