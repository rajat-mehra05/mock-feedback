import { useRef, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useApiKey } from '@/hooks/useApiKey/useApiKey';
import { ApiKeyInput } from '@/components/ApiKeyInput/ApiKeyInput';
import { APP_NAME } from '@/constants/copy';

interface SettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SettingsModal({ open, onOpenChange }: SettingsModalProps) {
  const { hasKey, remove } = useApiKey();
  const autoCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (autoCloseTimerRef.current) clearTimeout(autoCloseTimerRef.current);
    };
  }, []);

  function handleSaved() {
    if (autoCloseTimerRef.current) clearTimeout(autoCloseTimerRef.current);
    autoCloseTimerRef.current = setTimeout(() => {
      onOpenChange(false);
    }, 1000);
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

        <div className="space-y-4">
          {!hasKey && (
            <p className="text-sm font-bold text-black/60">
              You need an OpenAI API key to use {APP_NAME}. Set your key below, or add it when
              starting a session.
            </p>
          )}

          <div>
            <label
              htmlFor="api-key-input"
              className="mb-1.5 block text-sm font-bold uppercase tracking-wider"
            >
              OpenAI API Key
            </label>
            <ApiKeyInput
              inputId="api-key-input"
              onSaved={handleSaved}
              placeholder={hasKey ? '••••••••••••••••' : undefined}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="text-sm font-bold" aria-live="polite">
              {hasKey ? (
                <span className="text-green-700">Key configured</span>
              ) : (
                <span className="text-black/70">No key configured</span>
              )}
            </div>
            {hasKey && (
              <Button type="button" variant="destructive" size="sm" onClick={() => void remove()}>
                Remove
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
