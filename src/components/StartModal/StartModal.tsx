import { useState } from 'react';
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
import { TOPICS, QUESTION_COUNTS, DEFAULT_QUESTION_COUNT } from '@/constants/topics';

interface StartModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function StartModal({ open, onOpenChange }: StartModalProps) {
  const navigate = useNavigate();
  const [topic, setTopic] = useState('');
  const [questionCount, setQuestionCount] = useState(DEFAULT_QUESTION_COUNT);

  function handleStart() {
    if (!topic) return;
    navigate(`/session?topic=${topic}&count=${questionCount}`);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Welcome to Mock Feedback!</DialogTitle>
          <DialogDescription>
            Practice technical interviews with an AI interviewer.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <div className="space-y-3 border-4 border-black bg-neo-muted/20 p-4 shadow-neo-sm">
            <h3 className="text-sm font-bold uppercase tracking-wider">How it works</h3>
            <ol className="space-y-2 text-sm font-medium text-black/80">
              <li className="flex gap-2">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center border-2 border-black bg-neo-accent text-xs font-bold">
                  1
                </span>
                Choose a topic and number of questions
              </li>
              <li className="flex gap-2">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center border-2 border-black bg-neo-secondary text-xs font-bold">
                  2
                </span>
                The AI interviewer asks you a question via voice
              </li>
              <li className="flex gap-2">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center border-2 border-black bg-neo-muted text-xs font-bold">
                  3
                </span>
                Speak your answer — your response is transcribed
              </li>
              <li className="flex gap-2">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center border-2 border-black bg-neo-accent text-xs font-bold">
                  4
                </span>
                The AI asks follow-up questions based on your answers
              </li>
              <li className="flex gap-2">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center border-2 border-black bg-neo-secondary text-xs font-bold">
                  5
                </span>
                Get detailed feedback with ratings for each answer
              </li>
            </ol>
          </div>

          <div className="space-y-4">
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
                <SelectTrigger id="count-select">
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

          <Button className="w-full" size="lg" onClick={handleStart} disabled={!topic}>
            Start Session
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
