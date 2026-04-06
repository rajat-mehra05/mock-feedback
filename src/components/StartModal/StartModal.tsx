import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { TOPICS, QUESTION_COUNTS, DEFAULT_QUESTION_COUNT } from '@/constants/topics';
import { useApiKey } from '@/hooks/useApiKey/useApiKey';
import { ApiKeyInput } from '@/components/ApiKeyInput/ApiKeyInput';
import { API_KEY_DESCRIPTION } from '@/constants/copy';
import { getCandidateName, saveCandidateName } from '@/db/preferences/preferences';

interface StartModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function StartModal({ open, onOpenChange }: StartModalProps) {
  const navigate = useNavigate();
  const { hasKey, isLoading } = useApiKey();
  const [showKeyInput, setShowKeyInput] = useState(false);

  // Show key input only for new users (no key when modal first loads).
  // Once shown, it stays mounted so the user sees the "Saved" confirmation
  // and can continue filling the rest of the form without an abrupt layout shift.
  if (!isLoading && !hasKey && !showKeyInput) {
    setShowKeyInput(true);
  }

  const [topic, setTopic] = useState('');
  const [questionCount, setQuestionCount] = useState(DEFAULT_QUESTION_COUNT);
  const [name, setName] = useState('');

  useEffect(() => {
    let mounted = true;
    void getCandidateName().then((saved) => {
      if (mounted && saved) setName(saved);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const handleKeySaved = useCallback(() => {
    // Guide focus to the next field after key is saved
    requestAnimationFrame(() => {
      document.getElementById('topic-select')?.focus();
    });
  }, []);

  function handleStart() {
    /* v8 ignore next */ if (!topic || !hasKey) return;
    const trimmedName = name.trim();
    if (trimmedName) void saveCandidateName(trimmedName);
    const params = new URLSearchParams({ topic, count: questionCount });
    if (trimmedName) params.set('name', trimmedName);
    void navigate(`/session?${params.toString()}`);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Start a Session</DialogTitle>
          <DialogDescription>
            Configure your interview session and begin practicing.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {showKeyInput && (
            <div className="space-y-3 border-4 border-black bg-neo-muted/20 p-4 shadow-neo-sm">
              <label
                htmlFor="start-api-key"
                className="block text-sm font-bold uppercase tracking-wider"
              >
                OpenAI API Key
              </label>
              <p className="text-sm font-medium text-black/60">{API_KEY_DESCRIPTION}</p>
              <ApiKeyInput inputId="start-api-key" onSaved={handleKeySaved} />
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label
                htmlFor="name-input"
                className="mb-1.5 block text-sm font-bold uppercase tracking-wider"
              >
                Your Name{' '}
                <span className="font-medium normal-case tracking-normal text-black/40">
                  (optional)
                </span>
              </label>
              <Input
                id="name-input"
                type="text"
                placeholder="e.g. Rajat"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div>
              <label
                htmlFor="topic-select"
                className="mb-1.5 block text-sm font-bold uppercase tracking-wider"
              >
                Interview Topic
              </label>
              <Select value={topic} onValueChange={(v) => setTopic(v ?? '')}>
                <SelectTrigger id="topic-select" aria-required="true">
                  <SelectValue placeholder="Select a topic" />
                </SelectTrigger>
                <SelectContent>
                  {TOPICS.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label
                htmlFor="count-select"
                className="mb-1.5 block text-sm font-bold uppercase tracking-wider"
              >
                Number of Questions
              </label>
              <Select
                value={questionCount}
                onValueChange={(v) => setQuestionCount(v ?? DEFAULT_QUESTION_COUNT)}
              >
                <SelectTrigger id="count-select" aria-required="true">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {QUESTION_COUNTS.map((c) => (
                    <SelectItem key={c} value={String(c)}>
                      {c} questions
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button className="w-full" size="lg" onClick={handleStart} disabled={!topic || !hasKey}>
            Start Session
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
