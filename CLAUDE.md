# Mock Feedback — Project Instructions

## Overview
AI-powered mock interviewer web app. Vite + React 19 + TypeScript + Tailwind v4 + shadcn/ui.
Full plan: see `PLAN.md` in this directory.

## BYOK (Bring Your Own Key)
This app uses the user's own OpenAI API key. Never hardcode, commit, or ship any API keys. The key is stored in IndexedDB and sent only to OpenAI.

## Testing — Project-Specific Details

The global testing principles in `~/.claude/CLAUDE.md` apply here. Below are project-specific additions.

### Unit / Component Tests (Vitest + React Testing Library)
- Runner: Vitest (native Vite integration)
- Run: `npm run test`, `npm run test:watch`, `npm run test:coverage`
- Mock HTTP: MSW (Mock Service Worker) for all OpenAI API calls
- Mock IndexedDB: `fake-indexeddb` package
- Custom render wrapper: `renderWithProviders` includes React Router + context providers
- Test files live next to source: `src/components/Home.tsx` → `src/components/Home.test.tsx`

### E2E Tests (Playwright)
- Run: `npm run test:e2e`, `npm run test:e2e:headed`
- Playwright starts the Vite dev server via `webServer` config
- All OpenAI calls mocked via MSW (no real API keys in E2E)
- Test files in `e2e/` directory at project root
- Only happy-path flows: full interview session, API key setup, history + feedback viewing

### Prompt Regression Tests
- Run: `npm run test:prompts`
- NOT in CI — uses real OpenAI API, costs money, non-deterministic
- Validates output structure matches expected JSON schema
- Verifies scoring boundaries (bad answer → low score, good answer → high score)

## Accessibility
- WCAG 2.1 AA compliance required
- `eslint-plugin-jsx-a11y` enforced in lint
- All interactive elements keyboard-navigable
- Proper landmarks, ARIA labels, focus management
- `getByRole` queries in tests double as accessibility verification
- Lighthouse accessibility target: **100**
- Lighthouse performance target: **100**

## Code Quality
- ESLint + Prettier enforced
- `noUnusedLocals` + `noUnusedParameters` in tsconfig
- Tree shaking + code splitting verified in production builds
- No unused JS ships to the browser
