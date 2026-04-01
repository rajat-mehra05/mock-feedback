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
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
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
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-4">
      <div className="w-full max-w-md space-y-6 text-center">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-foreground">Welcome to {APP_NAME}</h1>
          <p className="text-muted-foreground">
            AI-powered mock interviews to sharpen your skills.
          </p>
        </div>

        <div className="rounded-lg border border-border bg-card p-6 text-left shadow-sm">
          <h2 className="mb-2 text-lg font-semibold">Enter your OpenAI API Key</h2>
          <p className="mb-4 text-sm text-muted-foreground">{API_KEY_DESCRIPTION}</p>

          <div className="space-y-3">
            <div className="flex gap-2">
              <Input
                id="gate-api-key"
                type={showKey ? 'text' : 'password'}
                placeholder="sk-..."
                value={keyInput}
                onChange={(e) => setKeyInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                aria-label="OpenAI API Key"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowKey(!showKey)}
                aria-label={showKey ? 'Hide API key' : 'Show API key'}
              >
                {showKey ? 'Hide' : 'Show'}
              </Button>
            </div>

            <Button
              className="w-full"
              onClick={handleSave}
              disabled={!keyInput.trim() || status === 'saving'}
            >
              {status === 'saving' ? 'Saving...' : 'Save & Continue'}
            </Button>

            {status === 'error' && (
              <p className="text-sm text-destructive">Failed to save key. Please try again.</p>
            )}
          </div>

          <p className="mt-4 text-xs text-muted-foreground">
            Need a key?{' '}
            <a
              href={OPENAI_API_KEYS_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-foreground"
            >
              Get one from OpenAI
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
