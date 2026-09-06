# Agent Instructions

This repository is **Lanes**, an Angular PWA tactical RPG optimized for hosting on **GitHub Pages**.

When working in this repository, follow these guidelines:

## Core Principles

1. **Preserve PWA & Deployment Infrastructure**:
   - Keep the Angular Service Worker (`@angular/service-worker`, `ngsw-config.json`), Web App Manifest (`public/manifest.webmanifest`), and GitHub Actions Pages deployment workflows intact.
   - Maintain the SPA 404 fallback mechanism (`scripts/prepare-pages.mjs`) to ensure client-side routing survives direct navigation and browser refreshes on GitHub Pages.

2. **Tactical RPG Design & Grand Kingdom Heritage**:
   - The combat system relies on a 3-lane horizontal battlefield (Lanes 0, 1, 2) with action-point budgeting (Action Gauge) per turn.
   - Maintain the 6 core unit classes (Fighter, Cleric, Archer, Witch, Lancer, Gunner) with accurate damage formulas, cross-lane targeting, and friendly fire on high-risk AoE spells.
   - Keep the game engine in pure, dependency-free TypeScript in `src/app/core/engine/` and reactive Angular Signals in `src/app/core/services/`.

3. **Preserve Responsive & Accessibility Standards**:
   - Adhere to the mobile-first foundations defined in `src/styles.scss` (accessible `:focus-visible` outlines, touch targets >= 44px, safe-area insets, and reduced-motion support).
   - Prevent accidental horizontal overflow across all viewports (phone portrait, phone landscape, tablet, desktop).

4. **Run Quality & Validation Gates**:
   Before completing substantial changes, verify that the suite passes cleanly:

   ```bash
   npm run lint          # ESLint static analysis
   npm run format:check  # Prettier formatting verification
   npm test              # Vitest unit & component test suite
   npm run build         # Production Angular bundle
   npm run e2e           # Playwright multi-viewport smoke tests
   ```

5. **Simplicity & YAGNI**:
   - Strictly follow repository rules in `GEMINI.md`: no unnecessary external libraries or layers of abstraction.
   - Deletion over addition, boring over clever, fewest files possible.
