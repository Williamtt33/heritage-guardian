# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

3D Gaussian Splatting showcase website — a browser-based gallery and interactive viewer for `.splat` files. Built for non-technical audiences (not 3DGS researchers). Focus on visual polish, intuitive interaction, and simple model management.

## Behavioral Guidelines

**Tradeoff:** These bias toward caution over speed. For trivial tasks, use judgment.

### 0. Overriding Collaboration Rules (User-Mandated)

These rules override any conflicting guidance in this document:

1. **Expose conflicts, don't reconcile them.** When code logic, architecture, old/new code, or implementation ideas conflict, explicitly present the problem. No implicit compatibility, vague compromises, or automatic smoothing. All conflicts must be surfaced and explicitly resolved.

2. **Read before writing.** Before adding, modifying, or refactoring code, thoroughly read and understand existing code, context logic, module associations, and business rules. When encountering unclear logic, historical patterns, or implicit constraints, stop and ask — never guess.

3. **Set checkpoints for long-running operations.** For refactoring, debugging, large feature development, and complex transformations, divide into stages and set verification checkpoints. If direction deviates or thinking becomes confused, pause immediately, realign with goals, then continue.

4. **Convention over novelty.** Project's existing coding style, design patterns, code paradigms take priority over personal preferences, novel syntax, or niche implementations. Maintain codebase consistency — don't introduce patterns that break the established norm.

5. **Fail explicitly, not silently.** All interface calls, logic validation, and exception branches must have observable results. Actively throw exceptions, output logs, or clearly prompt on failure. Never swallow exceptions, ignore return values, or let problems silently fail.

6. **Fit existing project style.** All code output should match the project's existing style and structure. Prioritize reusing existing implementations. When logic or solutions diverge, directly point out conflicts.

### 1. Think Before Coding

- State assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them — don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

### 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

### 3. Surgical Changes

**Touch only what you must.**

- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it — don't delete it.
- Remove only imports/variables that YOUR changes made unused.
- The test: every changed line should trace directly to the user's request.

### 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

## Commands

```bash
npm run dev          # Start dev server (port 3000)
npm run build        # Type-check + production build to dist/
npm run preview      # Preview production build
```

## Architecture

### Rendering engine: gsplat.js v1.2

The core 3D viewer wraps `gsplat` (v1.2.9), which provides a WebGL-based Gaussian Splatting renderer. Key gsplat APIs used:

- `new SPLAT.Scene()` — scene graph
- `new SPLAT.Camera()` — camera (extends Object3D, immutable Vector3 position/rotation)
- `new SPLAT.WebGLRenderer(canvas)` — WebGL renderer; pass canvas directly, not as object
- `new SPLAT.OrbitControls(camera, canvas, a, b, r, enableKeyboard)` — pass `false` for last param to disable WASD keyboard controls so custom shortcuts work
- `SPLAT.Loader.LoadAsync(url, scene, onProgress)` — load .splat/.ply; returns Splat object
- `scene.reset()` — clear scene; `scene.objects` getter for children
- `camera.position = new SPLAT.Vector3(x,y,z)` — set position (Vector3 is immutable, no `.set()`)
- `controls.setCameraTarget(new SPLAT.Vector3(x,y,z))` — set orbit target
- `splat.data.vertexCount` — count of gaussians

**Important**: OrbitControls has `enableKeyboardControls` (6th constructor param). Must pass `false` so custom key handlers (`E` for edit mode, `R` for reset, `H` for help) work.

### Routing (React Router v7)

Six routes with animated page transitions:
- `/` — Home (Hero + features + CTA)
- `/gallery` — Scene gallery grid
- `/viewer/:modelId` — Full-screen 3D viewer (read-only, hides nav/footer)
- `/edit/:modelId` — Full-screen 3D editor (annotation + camera path tools)
- `/upload` — Upload new .splat files
- `/admin` — Model management (CRUD for custom models)

### Data model (`src/types/index.ts`)

`ModelMeta` is the central type: id, bilingual name/description, file path, thumbnail, hotspots array, camera paths array. All editor data (hotspots, camera paths, custom models) persists via **localStorage**. Uploaded `.splat` files and thumbnail images persist via **IndexedDB** (`src/utils/fileStorage.ts`).

### Model resolution (`src/utils/models.ts`)

`resolveModelUrl(model)` handles three file sources:
1. `[local]` prefix → load from IndexedDB, return blob URL
2. `http://` / `https://` → use as-is
3. Relative path → serve from `/models/` directory

Always use `resolveModelUrl()` (async) rather than the old `getModelUrl()` (sync, doesn't handle local files).

### State management

No global state library. Each page manages its own state via React hooks. Shared data access through:
- `src/store/modelStore.ts` — CRUD for hotspots, camera paths, custom models (localStorage)
- `src/utils/fileStorage.ts` — IndexedDB read/write for .splat files and thumbnail images
- `src/utils/models.ts` — fetch manifest.json + merge with custom models from store

### i18n pattern

`I18nProvider` wraps the app. Components call `useI18n()` to get `{ t, lang, toggleLang }`. Translation keys accessed as `t.nav.home`, `t.viewer.loading`, etc. Adding a new key requires updating both `zh` and `en` objects in `src/i18n/translations.ts`.

### Design system (Tailwind v4)

Custom theme tokens defined in `src/index.css`:
- `surface-0` through `surface-3` — layered dark backgrounds
- `border-1`, `border-2` — subtle borders
- `accent-1` (violet), `accent-2` (indigo), `accent-3` (emerald)
- `text-1` (primary), `text-2` (secondary), `text-3` (muted)

Utility classes: `.glass`, `.glass-light`, `.gradient-text`, `.bg-mesh`, `.bg-grid-subtle`, `.glow-violet`, `.glow-green`, `.animate-fade-up`, `.stagger`

Fonts: Inter + Noto Sans SC + JetBrains Mono (loaded from Google Fonts in index.html)

### Hotspot system

Hotspots are 3D world-space points rendered as CSS-positioned overlays. Each frame, `worldToScreen()` (in `src/utils/math3d.ts`) projects world coordinates to screen space using the camera's position, forward vector, and FOV. Hotspot markers scale with distance. Editing happens via the `HotspotEditor` panel; import/export via `src/utils/hotspotImporter.ts` which auto-detects multiple JSON formats (SuperSplat annotations, simple arrays, etc.).

### Camera path animation

`useCameraPathPlayer` hook (`src/hooks/useCameraPathPlayer.ts`) manages playback state machine (idle→playing→paused→idle). The per-frame update function integrates into Viewer3D's main rAF loop (not a separate rAF), called via `playback.pathUpdateRef.current()` when `playback.isPathPlayingRef.current` is true. Camera position and look-at target are interpolated using Catmull-Rom splines (`catmullRomPoint()` in `src/utils/math3d.ts`), which uses boundary endpoint duplication for segments with fewer than 4 keyframes. `SPLAT.Quaternion.LookRotation(dir)` computes the camera quaternion. Playback speed is adjustable (0.5x/1x/2x). On stop, `controls.setCameraTarget()` + `controls.dampening = 0.2` restores OrbitControls.

`CameraPathPanel` (`src/components/editor/CameraPathPanel.tsx`) provides a unified glass-overlay UI: path CRUD (create/rename/delete), keyframe list with reorder/delete buttons, "Capture Current View" button (reads `camera.position` and `camera.forward * 3` as look-at target), and playback controls with speed selector.

Camera path data persists in localStorage keyed by model ID (`gs_camera_paths_{modelId}`), with 5 CRUD functions in `src/store/modelStore.ts` matching the hotspot pattern. `deleteCustomModel()` cleans up path data alongside hotspots.

### Key patterns to preserve

- **No technical jargon in UI**: This site is for consumers, not 3DGS practitioners. Hide FPS/point-count panels by default. Use accessible language ("场景" not "模型", "探索" not "渲染").
- **ModelForm requires only name + file**: The audience doesn't need point counts or training iteration numbers.
- **Viewer hides navbar/footer**: The 3D viewer is full-screen. `App.tsx` checks `location.pathname.startsWith('/viewer/')` to suppress nav/footer.
- **`[local]` file prefix**: Uploaded files are flagged with `[local]` prefix in `model.file`. The `resolveModelUrl()` function detects this and loads from IndexedDB.
- **AnimatePresence usage**: Page transitions use `AnimatePresence mode="wait"` with `key={location.pathname}` on the motion div. For modals like ModelForm, use plain `<div>` backdrop rather than nesting AnimatePresence (causes render issues without proper keys).
