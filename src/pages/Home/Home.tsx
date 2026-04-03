import { useState } from 'react';
import { Mic, Brain, BarChart3, Zap } from 'lucide-react';
import { StartModal } from '@/components/StartModal/StartModal';
import { useApiKey } from '@/hooks/useApiKey/useApiKey';
import { NO_API_KEY_MESSAGE } from '@/constants/copy';

function preloadSession() {
  void import('@/pages/Session/Session');
}

const FEATURES = [
  {
    icon: Mic,
    title: 'Voice-First',
    desc: 'Speak naturally. Auto-detects when you stop.',
    color: 'bg-neo-accent',
  },
  {
    icon: Brain,
    title: 'AI Interviewer',
    desc: 'Staff-level questions that adapt to your answers.',
    color: 'bg-neo-secondary',
  },
  {
    icon: BarChart3,
    title: 'Instant Feedback',
    desc: 'Detailed ratings and actionable tips per question.',
    color: 'bg-neo-muted',
  },
  {
    icon: Zap,
    title: 'Zero Setup',
    desc: 'Runs in your browser. Just bring an OpenAI key.',
    color: 'bg-neo-cream',
  },
] as const;

export function Home() {
  const [startOpen, setStartOpen] = useState(false);
  const { hasKey } = useApiKey();

  return (
    <div className="flex flex-1 flex-col gap-16 py-4 sm:gap-20">
      {/* Hero — left copy, right CTA */}
      <section className="flex flex-col items-center gap-10 lg:flex-row lg:gap-16">
        {/* Left: copy */}
        <div className="flex-1 space-y-6 text-center lg:text-left">
          <div className="inline-block border-2 border-black bg-neo-secondary px-3 py-1 text-xs font-bold uppercase tracking-widest shadow-neo-sm">
            AI-Powered Mock Interviews
          </div>

          <h1 className="text-4xl font-black uppercase leading-[1.1] tracking-tight text-black sm:text-5xl lg:text-6xl">
            Nail your next
            <br />
            <span className="relative inline-block">
              <span className="relative z-10">tech interview</span>
              <span
                className="absolute bottom-1 left-0 -z-0 h-4 w-full -rotate-1 bg-neo-accent sm:h-5"
                aria-hidden="true"
              />
            </span>
          </h1>

          <p className="max-w-lg text-lg font-medium leading-relaxed text-black/70 lg:text-xl">
            Practice with a Staff Engineer AI that asks real questions, listens to your voice, and
            gives brutally honest feedback.{' '}
            <strong className="text-black">No fluff. No mercy. Just growth.</strong>
          </p>
        </div>

        {/* Right: CTA block */}
        <div className="relative flex shrink-0 flex-col items-center gap-6">
          {/* Big Start Button */}
          <button
            onClick={() => setStartOpen(true)}
            onMouseEnter={preloadSession}
            onFocus={preloadSession}
            disabled={!hasKey}
            aria-label="Start new interview session"
            aria-describedby={!hasKey ? 'start-disabled-hint' : undefined}
            className="group relative flex h-40 w-40 cursor-pointer items-center justify-center border-4 border-black bg-neo-accent text-2xl font-black uppercase tracking-wide text-black shadow-neo-lg transition-all duration-150 hover:-translate-y-2 hover:shadow-[16px_16px_0px_0px_#000] focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-4 active:translate-x-[4px] active:translate-y-[4px] active:shadow-none disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-neo-lg sm:h-48 sm:w-48 sm:text-3xl"
          >
            <span className="transition-transform duration-150 group-hover:scale-110">Start</span>
          </button>

          {!hasKey && (
            <p
              id="start-disabled-hint"
              className="max-w-[200px] text-center text-sm font-bold text-black/60"
            >
              {NO_API_KEY_MESSAGE}
            </p>
          )}

          <p className="max-w-[240px] text-center text-sm font-bold text-black/60">
            Pick a topic, turn on your mic, and go.
          </p>
        </div>
      </section>

      {/* Feature cards */}
      <section aria-label="Features">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map(({ icon: Icon, title, desc, color }) => (
            <div
              key={title}
              className="border-4 border-black bg-white p-5 shadow-neo-sm transition-all duration-100 hover:-translate-y-1 hover:shadow-neo-md"
            >
              <div
                className={`mb-3 inline-flex h-10 w-10 items-center justify-center border-2 border-black ${color}`}
              >
                <Icon className="h-5 w-5" aria-hidden="true" />
              </div>
              <h3 className="mb-1 text-sm font-bold uppercase tracking-wider">{title}</h3>
              <p className="text-sm font-medium text-black/60">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 pb-4 text-center text-sm font-bold text-black/60">
        <span>Fully Open source ❤️</span>
        <span aria-hidden="true" className="text-black/20">
          |
        </span>
        <a
          href="https://github.com/rajat-mehra05/mock-feedback"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-black"
        >
          GitHub
        </a>
        <span aria-hidden="true" className="text-black/20">
          |
        </span>
        <a
          href="https://github.com/rajat-mehra05/mock-feedback/issues"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-black"
        >
          Open an issue
        </a>
      </footer>

      <StartModal open={startOpen} onOpenChange={setStartOpen} />
    </div>
  );
}
