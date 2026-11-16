# Changelog

## 2.0.0 (2026-11-16)

- New flag: **Target too small**. Buttons and controls under 24 x 24 px (WCAG 2.2, 2.5.8). Links inside sentences are exempt.
- New flag: **Text clipped vertically**. Fixed-height boxes that hide their last lines. Intentional line clamps are left alone.
- `--only` renders just the cases you name, for quick fix-and-check loops.
- Cases can set `"reducedMotion": true`.
- URL templates can use `{width}`.
- `references/frameworks.md`: copy-paste sheet routes for React with Vite, Next.js and Vue.
- Examples: icon-only button too small to tap (save button), plan name cut at the bottom (pricing card). 11 planted bugs, all caught; fixed versions clean.

## 0.1.0 (2026-11-12)

- First release: sheet renderer (HTML harness or dev-server URL), 7 automatic flags, 12 standard cases, 3 examples with seeded bugs and fixes, checks.
