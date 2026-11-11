# Paperclip skin — Kintsugi Ember

Skins the local Paperclip web UI (`npx paperclipai`, http://127.0.0.1:3100) in Kaizen's house theme. It doesn't fork Paperclip: it adds one stylesheet to the UI Paperclip already ships.

## What it does

- `ksk-paperclip.css` maps Paperclip's shadcn variables (`--background`, `--primary`, `--border`, `--ring`, `--chart-*`, `--sidebar*`, `--status-task-icon-*`, chips, scrollbar and others) to the Kintsugi Ember tokens. The token values are copied from `shared/css/ksk-dashboard.css`, which stays the source of truth.
- **Forced dark.** Ember is a dark-only theme, so the light `:root` gets the same values. A one-line script in the injected block adds `dark` to `<html>`. Paperclip's light toggle can't turn the page white.
- **Colour jobs:**
  - Amber is the only fill, and only on primary buttons. Count badges are outlined.
  - Gold is used only for lines: focus rings and the sidebar ring.
  - Ember is reserved for destructive actions, blocked tasks and errors. Destructive buttons are outlined.
  - SaaS blue and purple are pulled to the house steel and dusk colours.
- **Status icons:** done = good · in progress / in review / queued = warn · blocked = crit · todo = ink · backlog / cancelled = neutral. Agents: running = good · paused = warn · error = crit.
- **Fonts:** Inter for all UI text. Fraunces only for text at 20px or larger (Tailwind `text-xl` and up). Both fonts sit in `fonts/` next to the CSS, with no paths into other folders. Both are SIL OFL.

`apply.py` (stdlib, idempotent) writes only inside each Paperclip `ui-dist` folder:

| Path in `ui-dist` | What |
|---|---|
| `ksk-skin/` | The CSS and fonts |
| `index.html` | One block between `<!-- KSK_SKIN_START … -->` and `<!-- KSK_SKIN_END -->`, placed after the app stylesheet |
| `index.html.ksk-original` | A one-time backup of the untouched file |

Paperclip reads `index.html` from disk on every request (`dist/static-index-html.js`), so a reload shows the skin. **No server restart.**

## The one command

```bash
python C:/Users/Desig/kaizen-artifacts/paperclip-skin/apply.py
```

It finds every `@paperclipai/server/ui-dist` under the npx cache (`%LOCALAPPDATA%\npm-cache\_npx\*`) and the global npm folder. To target one install, add `--ui-dist <path>`. The flag can be repeated.

The live server is the one whose process path matches. To see which install it uses:

```powershell
Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object CommandLine -match paperclipai | Select-Object CommandLine
```

## Check

```bash
python C:/Users/Desig/kaizen-artifacts/paperclip-skin/apply.py --check
```

It prints `OK` or `NO` per install and exits 1 if any install is missing the skin. It also says if the installed CSS is older than this folder.

## After a Paperclip upgrade

An upgrade installs a fresh `ui-dist` (new npx hash or new files), so the skin is gone. Run the one command again. If Paperclip changes how `index.html` links its stylesheet, `apply.py` stops with a clear message and changes nothing.

After editing `ksk-paperclip.css`, run the one command again. The link carries a content hash (`?v=`), so browsers fetch the new file.

## Remove

```bash
python C:/Users/Desig/kaizen-artifacts/paperclip-skin/apply.py --remove
```

This strips the block, checks that the result matches the backup byte for byte, and then deletes the backup and `ksk-skin/`. If the file was changed by something else in between, it keeps the backup and warns you instead.
