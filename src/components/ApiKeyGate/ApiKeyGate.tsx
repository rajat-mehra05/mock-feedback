import { useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useApiKey } from '@/hooks/useApiKey/useApiKey';
import { APP_NAME, API_KEY_DESCRIPTION, OPENAI_API_KEYS_URL } from '@/constants/copy';

export function ApiKeyGate({ children }: { children: ReactNode }) {
  const { hasKey, isLoading, save } = useApiKey();
  const [keyInput, setKeyInput] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [status, setStatus] = useState<'idle' | 'saving' | 'error'>('idle');

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background neo-grid-pattern">
        <p className="font-bold text-black">Loading...</p>
      </div>
    );
  }

  if (hasKey) {
    return <>{children}</>;
  }

  async function handleSave() {
    if (!keyInput.trim()) return;
    setStatus('saving');
    try {
      await save(keyInput.trim());
    } catch {
      setStatus('error');
    }
  }

  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="flex min-h-screen flex-col items-center justify-center gap-8 bg-background px-4 outline-none neo-grid-pattern"
    >
      <div className="w-full max-w-md space-y-8 text-center">
        <div className="space-y-3">
          <h1 className="text-4xl font-bold uppercase tracking-tight text-black">
            Welcome to {APP_NAME}
          </h1>
          <p className="font-bold text-black/60">
            AI-powered mock interviews to sharpen your skills.
          </p>
        </div>

        <div className="border-4 border-black bg-white p-6 text-left shadow-neo-md">
          <h2 className="mb-2 text-lg font-bold uppercase tracking-tight">
            Enter your OpenAI API Key
          </h2>
          <p className="mb-4 text-sm font-medium text-black/60">{API_KEY_DESCRIPTION}</p>

          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              void handleSave();
            }}
          >
            <div className="flex gap-2">
              <Input
                id="gate-api-key"
                type={showKey ? 'text' : 'password'}
                placeholder="sk-..."
                value={keyInput}
                onChange={(e) => setKeyInput(e.target.value)}
                aria-label="OpenAI API Key"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowKey(!showKey)}
                aria-label={showKey ? 'Hide API key' : 'Show API key'}
              >
                {showKey ? 'Hide' : 'Show'}
              </Button>
            </div>

            <Button
              type="submit"
              className="w-full"
              size="lg"
              disabled={!keyInput.trim() || status === 'saving'}
            >
              {status === 'saving' ? 'Saving...' : 'Save & Continue'}
            </Button>

            {status === 'error' && (
              <p className="text-sm font-bold text-neo-accent">
                Failed to save key. Please try again.
              </p>
            )}
          </form>

          <p className="mt-4 text-xs font-medium text-black/50">
            Need a key?{' '}
            <a
              href={OPENAI_API_KEYS_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="font-bold underline hover:text-black"
            >
              Get one from OpenAI
              <span className="sr-only"> (opens in new tab)</span>
            </a>
          </p>
        </div>
      </div>
    </main>
  );
}
