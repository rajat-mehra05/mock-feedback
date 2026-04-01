# Mock Feedback

AI-powered mock interviewer that helps developers practice technical interviews. The AI asks questions via voice, you answer verbally, and you get detailed feedback with ratings.

## Tech Stack

- **Frontend:** Vite + React 19 + TypeScript
- **Styling:** Tailwind CSS v4 + shadcn/ui
- **Storage:** IndexedDB (Dexie.js) — fully local, no backend
- **Testing:** Vitest + React Testing Library
- **CI:** GitHub Actions (lint + format + test + build)
- **Pre-commit:** Husky + lint-staged

## BYOK (Bring Your Own Key)

This app requires your own OpenAI API key. Your key is stored in IndexedDB on your device and is only sent to OpenAI directly from the browser. No keys are shipped, hardcoded, or proxied.

## Getting Started

```bash
npm install
npm run dev
```

## Scripts

| Command                 | Description                   |
| ----------------------- | ----------------------------- |
| `npm run dev`           | Start dev server              |
| `npm run build`         | Type-check + production build |
| `npm run preview`       | Preview production build      |
| `npm run lint`          | ESLint (includes jsx-a11y)    |
| `npm run lint:fix`      | ESLint with auto-fix          |
| `npm run format`        | Prettier write                |
| `npm run format:check`  | Prettier check                |
| `npm run test`          | Vitest unit/component tests   |
| `npm run test:watch`    | Vitest in watch mode          |
| `npm run test:coverage` | Vitest with coverage report   |

## Project Structure

```
src/
├── components/          # Reusable UI components
│   ├── ApiKeyGate/      # First-run API key prompt
│   ├── ErrorBoundary/   # Root + session error boundaries
│   ├── Layout/          # Header, nav, skip-to-content
│   ├── SessionCard/     # Interview session card
│   ├── SettingsModal/   # API key management modal
│   ├── StartModal/      # Topic + question count selection
│   └── ui/              # shadcn/ui primitives
├── pages/               # Route-level components (lazy-loaded)
│   ├── Home/            # Recent sessions + Start button
│   ├── Session/         # Active interview UI
│   ├── History/         # Past sessions grid + stats
│   └── Feedback/        # Per-question ratings + feedback
├── hooks/               # React hooks + context
│   ├── ApiKeyContext/   # Shared API key state provider
│   ├── useApiKey/       # API key consumer hook
│   └── useSessions/     # Sessions data hook
├── db/                  # IndexedDB layer (Dexie.js)
│   ├── sessions/        # Session CRUD operations
│   ├── apiKey/          # API key storage
│   └── seed/            # Mock data for development
├── constants/           # App-wide constants (no magic values)
└── test/                # Test utilities + factories
```

## Accessibility

- WCAG 2.1 AA compliant
- `eslint-plugin-jsx-a11y` enforced
- Skip-to-content link, proper landmarks, ARIA labels, focus management
- `prefers-reduced-motion` respected for all animations
- Lighthouse accessibility target: 100
