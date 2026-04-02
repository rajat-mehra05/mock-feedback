import { useState } from 'react';
import { StartModal } from '@/components/StartModal/StartModal';
import { useApiKey } from '@/hooks/useApiKey/useApiKey';
import { NO_API_KEY_MESSAGE } from '@/constants/copy';

export function Home() {
  const [startOpen, setStartOpen] = useState(false);
  const { hasKey } = useApiKey();

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-10">
      <div className="relative">
        <button
          onClick={() => setStartOpen(true)}
          disabled={!hasKey}
          aria-label="Start new interview session"
          aria-describedby={!hasKey ? 'start-disabled-hint' : undefined}
          className="flex h-32 w-32 cursor-pointer items-center justify-center border-4 border-black bg-neo-accent text-xl font-bold uppercase tracking-wide text-black shadow-neo-md transition-all duration-100 hover:-translate-y-1 hover:shadow-neo-lg focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 active:translate-x-[3px] active:translate-y-[3px] active:shadow-none disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-neo-md disabled:active:translate-x-0 disabled:active:translate-y-0"
        >
          Start
        </button>
      </div>

      {!hasKey && (
        <p id="start-disabled-hint" className="text-sm font-bold text-black/60">
          {NO_API_KEY_MESSAGE}
        </p>
      )}

      <p className="rounded-md border-2 border-black bg-neo-muted/20 px-6 py-4 text-center text-base font-bold text-black/70">
        Ready when you are — hit Start and show them what you&apos;ve got!
      </p>

      <StartModal open={startOpen} onOpenChange={setStartOpen} />
    </div>
  );
}
