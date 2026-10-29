# Changelog

## 0.2.5 · 2026-10-29

### Added

- Live session readers for Claude Code, Codex, DeepSeek Harness, Gemini CLI, Qwen Code, Pi, omp, Qoder, WorkBuddy and CodeBuddy, with a gateway-hook fallback for other agents.
- Isometric 3D and top-down 2D office, live list, per-agent details and resume commands, plus a draggable and resizable in-page floating window.
- Varied idle gestures: stretching, glancing, leg swinging and dozing, with reduced-motion support.
- Front-aisle sofa boarding and exit, collision-safe pathfinding, worker separation and non-overlapping name tags.
- Real agent icons for the agents magpie knows, English and Chinese UI, and local-only text privacy controls.

### Fixed

- Furniture and seated-worker compositing so sofas, cushions, backrests and consoles no longer paint through workers.
- Walkers no longer cross furniture or take a route behind a sofa's backrest.
- Every seat now faces its own furniture; monitor screens, chair backs and sitting legs follow the same orientation.
- The page no longer paints its own card, so magpie's window background shows through without a grey ring.

## 0.2.0 · 2026-10-28

- Replaced traffic-inferred statuses with live data read from each agent's own session files.
- Reworked interaction to click-to-open panels and replaced placeholder agent marks with magpie's real icons.

## 0.1.0 · 2026-10-28

- First public preview of the voxel Agent Office for magpie.
