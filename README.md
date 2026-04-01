# Mock Feedback

AI-powered mock interviewer that helps developers practice technical interviews. The AI asks questions via voice, you answer verbally, and you get detailed feedback with ratings.

## Tech Stack

- **Frontend:** Vite + React 19 + TypeScript
- **Styling:** Tailwind CSS v4 + shadcn/ui
- **AI / Voice:** OpenAI (GPT-4o Mini for LLM + STT, gpt-4o-mini-tts for TTS)
- **Storage:** IndexedDB (Dexie.js) — fully local, no backend
- **Testing:** Vitest + React Testing Library + MSW
- **CI:** GitHub Actions (lint + format + test + build)
- **Pre-commit:** Husky + lint-staged

## BYOK (Bring Your Own Key)

This app requires your own OpenAI API key. Your key is stored in IndexedDB on your device and is only sent to OpenAI directly from the browser. No keys are shipped, hardcoded, or proxied.

## How It Works

1. Configure your OpenAI API key (first-run gate)
2. Click **Start** → select a topic and question count
3. AI asks questions via text-to-speech
4. You answer verbally — mic records → audio sent to OpenAI STT
5. After all questions, AI generates structured feedback (rating + commentary per question)
6. Feedback saved to IndexedDB, viewable anytime from History

## Getting Started

```bash
npm install
npm run dev
```

## Interview Topics

- JavaScript / TypeScript
- React & Next.js
- Node.js
- Behavioral / STAR

## Error Handling

- **Invalid API key (401):** prompts user to update key in Settings
- **Quota exhausted (429 — billing):** links to OpenAI billing page
- **Rate limited (429 — rate):** automatic retry with exponential backoff (max 3 attempts)
- **Network failure:** inline error with retry button
- **Request timeout:** per-call timeouts (STT: 30s, LLM: 20s, TTS: 15s)
- **TTS failure:** falls back to displaying question as text

## Audio & Microphone

- Browser compatibility check (MediaRecorder API) before session start
- Mic device detection and permission gating
- Max recording duration: 4 minutes per answer (with 30s warning)
- Supported formats: WebM/Opus (Chrome/Firefox), MP4/AAC (Safari)
- All in-flight API calls cancelled via AbortController on navigation/stop

## Accessibility

Accessibility has been a priority from the start. The app is designed to meet WCAG 2.1 AA standards — all interactive elements are fully keyboard-navigable, screen readers are kept informed of recording and session state changes, and animations respect the user's `prefers-reduced-motion` preference.

## Contributing

Contributions are welcome! Feel free to open an issue or submit a pull request — whether it's a bug fix, a new feature idea, or just a suggestion to improve the experience. This project is licensed under MIT, so fork away.

If you have feedback or ideas on how to make the app better, don't hesitate to open an issue. All input is appreciated. All the best!
