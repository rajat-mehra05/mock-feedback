import { Button } from '@/components/ui/button';
import type { OpenAIServiceError } from '@/services/types';

const BILLING_URL = 'https://platform.openai.com/account/billing';

interface SessionErrorDisplayProps {
  error: OpenAIServiceError;
  onRetry: () => void;
  onRestart: () => void;
}

export function SessionErrorDisplay({ error, onRetry, onRestart }: SessionErrorDisplayProps) {
  return (
    <div
      className="w-full max-w-md border-4 border-black bg-neo-accent/10 p-6 text-center shadow-neo-sm"
      role="alert"
    >
      <p className="mb-4 text-sm font-bold text-black">{error.message}</p>

      <div className="flex flex-col items-center gap-3">
        {error.retryable && (
          <Button size="sm" onClick={onRetry}>
            Retry
          </Button>
        )}
        {error.type === 'auth' && (
          <p className="text-sm font-bold text-black/70">
            Click <strong>Settings</strong> in the header to update your API key.
          </p>
        )}
        {error.type === 'quota' && (
          <a
            href={BILLING_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-8 items-center border-2 border-black bg-white px-3 text-sm font-bold uppercase tracking-wide hover:bg-neo-secondary"
          >
            Check Billing
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
        )}
        <Button variant="outline" size="sm" onClick={onRestart}>
          Restart Interview
        </Button>
      </div>
    </div>
  );
}
