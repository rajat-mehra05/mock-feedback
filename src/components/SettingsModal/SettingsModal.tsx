import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useApiKey } from '@/hooks/useApiKey/useApiKey';
import { OPENAI_API_KEYS_URL } from '@/constants/copy';

interface SettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SettingsModal({ open, onOpenChange }: SettingsModalProps) {
  const { apiKey, save, remove } = useApiKey();
  const [keyInput, setKeyInput] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  async function handleSave() {
    if (!keyInput.trim()) return;
    setStatus('saving');
    try {
      await save(keyInput.trim());
      setStatus('saved');
      setKeyInput('');
      setTimeout(() => {
        setStatus('idle');
        onOpenChange(false);
      }, 1000);
    } catch {
      setStatus('error');
    }
  }

  async function handleRemove() {
    await remove();
    setStatus('idle');
    setKeyInput('');
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>
            Manage your OpenAI API key. Your key is stored locally and only sent to OpenAI.
          </DialogDescription>
        </DialogHeader>

        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            handleSave();
          }}
        >
          <div>
            <label htmlFor="api-key-input" className="mb-1.5 block text-sm font-medium">
              OpenAI API Key
            </label>
            <div className="flex gap-2">
              <Input
                id="api-key-input"
                type={showKey ? 'text' : 'password'}
                placeholder={apiKey ? '••••••••••••••••' : 'sk-...'}
                value={keyInput}
                onChange={(e) => setKeyInput(e.target.value)}
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
          </div>

          <div className="flex items-center justify-between">
            <div className="text-sm" aria-live="polite">
              {apiKey ? (
                <span className="text-green-600">Key configured</span>
              ) : (
                <span className="text-muted-foreground">No key configured</span>
              )}
              {status === 'saved' && <span className="ml-2 text-green-600">Saved!</span>}
              {status === 'error' && (
                <span className="ml-2 text-destructive">Error saving key</span>
              )}
            </div>
            <div className="flex gap-2">
              {apiKey && (
                <Button type="button" variant="destructive" size="sm" onClick={handleRemove}>
                  Remove
                </Button>
              )}
              <Button type="submit" size="sm" disabled={!keyInput.trim() || status === 'saving'}>
                {status === 'saving' ? 'Saving...' : 'Save'}
              </Button>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Need a key?{' '}
            <a
              href={OPENAI_API_KEYS_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-foreground"
            >
              Get one from OpenAI
              <span className="sr-only"> (opens in new tab)</span>
            </a>
          </p>
        </form>
      </DialogContent>
    </Dialog>
  );
}
