import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useApiKey } from '@/hooks/useApiKey/useApiKey';
import { OPENAI_API_KEYS_URL } from '@/constants/copy';

interface ApiKeyInputProps {
  inputId: string;
  onSaved?: () => void;
  placeholder?: string;
}

export function ApiKeyInput({ inputId, onSaved, placeholder = 'sk-...' }: ApiKeyInputProps) {
  const { save } = useApiKey();
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
      onSaved?.();
    } catch {
      setStatus('error');
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Input
          id={inputId}
          type={showKey ? 'text' : 'password'}
          placeholder={placeholder}
          value={keyInput}
          onChange={(e) => setKeyInput(e.target.value)}
          disabled={status === 'saved'}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setShowKey(!showKey)}
          disabled={status === 'saved'}
          aria-label={showKey ? 'Hide API key' : 'Show API key'}
        >
          {showKey ? 'Hide' : 'Show'}
        </Button>
      </div>
      <Button
        className="w-full"
        size="sm"
        onClick={() => void handleSave()}
        disabled={!keyInput.trim() || status === 'saving' || status === 'saved'}
      >
        {status === 'saving' ? 'Saving...' : status === 'saved' ? 'Saved' : 'Save'}
      </Button>
      {status === 'error' && (
        <p className="text-sm font-bold text-neo-accent" role="alert">
          Failed to save key. Please try again.
        </p>
      )}
      <p className="text-xs font-medium text-black/50">
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
  );
}
