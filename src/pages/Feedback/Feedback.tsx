import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { getSession, type Session } from '@/db/sessions/sessions';
import type { ConfidenceLevel } from '@/services/types';

function scoreColor(score: number): string {
  if (score >= 8) return 'text-green-700';
  if (score >= 6) return 'text-yellow-700';
  return 'text-red-700';
}

function scoreBg(score: number): string {
  if (score >= 8) return 'bg-green-200 border-black';
  if (score >= 6) return 'bg-yellow-200 border-black';
  return 'bg-red-200 border-black';
}

const CONFIDENCE_CONFIG: Record<ConfidenceLevel, { label: string; style: string }> = {
  high: { label: 'High Confidence', style: 'bg-green-100 text-green-800 border-green-800' },
  medium: { label: 'Medium Confidence', style: 'bg-yellow-100 text-yellow-800 border-yellow-800' },
  low: { label: 'Low Confidence', style: 'bg-red-100 text-red-800 border-red-800' },
};

function getConfidence(level: ConfidenceLevel | undefined) {
  return CONFIDENCE_CONFIG[level ?? 'medium'];
}

export function Feedback() {
  const { id } = useParams<{ id: string }>();
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'feedback' | 'model-answers'>('feedback');

  useEffect(() => {
    if (!id) return;
    getSession(id)
      .then((s) => setSession(s ?? null))
      .catch(() => setSession(null))
      .finally(() => setIsLoading(false));
  }, [id]);

  if (isLoading) {
    return <Spinner message="Loading feedback..." />;
  }

  if (!session) {
    return (
      <div className="flex flex-col items-center gap-4 py-12">
        <p className="text-lg font-bold text-black">Session not found</p>
        <Button nativeButton={false} render={<Link to="/history" />}>
          Back to History
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold uppercase tracking-tight text-black">
            Session Feedback
          </h1>
          <p className="text-sm font-bold text-black/60">
            {session.topic} · {session.questionCount} questions
          </p>
        </div>
        <Select
          value={viewMode}
          onValueChange={(v) => {
            const mode = v ?? 'feedback';
            if (mode === 'feedback' || mode === 'model-answers') setViewMode(mode);
          }}
        >
          <SelectTrigger className="w-48" aria-label="View mode">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="feedback">Detailed Feedback</SelectItem>
            <SelectItem value="model-answers">Model Answers</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-6">
        {session.questions.map((q, i) => {
          const conf = getConfidence(q.confidence);
          return (
            <section
              key={q.id}
              className="border-4 border-black bg-white p-6 shadow-neo-sm"
              aria-label={`Question ${i + 1}`}
            >
              <div className="mb-4 flex items-start justify-between">
                <h3 className="text-sm font-bold uppercase tracking-wider text-black/60">
                  Question {i + 1}
                </h3>
                <div className="flex items-center gap-2">
                  <Badge className={`${conf.style} border`} aria-label={conf.label}>
                    <span className="text-xs font-bold">{conf.label}</span>
                  </Badge>
                  <Badge
                    className={`${scoreBg(q.rating)} border-2`}
                    aria-label={`Rating: ${q.rating} out of 10`}
                  >
                    <span className={`font-bold ${scoreColor(q.rating)}`}>{q.rating}/10</span>
                  </Badge>
                </div>
              </div>

              <p className="mb-4 text-lg font-bold text-black">{q.questionText}</p>

              {viewMode === 'feedback' ? (
                <>
                  <div className="mb-3 border-2 border-black bg-neo-muted/20 p-4">
                    <p className="mb-1 text-xs font-bold uppercase tracking-wider text-black/60">
                      Your Answer
                    </p>
                    <p className="text-sm font-medium text-black">{q.userTranscript}</p>
                  </div>
                  <div>
                    <p className="mb-1 text-xs font-bold uppercase tracking-wider text-black/60">
                      Feedback
                    </p>
                    <p className="text-sm font-medium text-black">{q.feedback}</p>
                  </div>
                </>
              ) : (
                <div className="border-2 border-black bg-neo-secondary/30 p-4">
                  <p className="mb-1 text-xs font-bold uppercase tracking-wider text-black/60">
                    Model Answer
                  </p>
                  <p className="text-sm font-medium text-black">{q.followUp || q.feedback}</p>
                </div>
              )}
            </section>
          );
        })}
      </div>

      <section className="border-4 border-black bg-neo-secondary/30 p-6 shadow-neo-sm">
        <h2 className="mb-3 text-lg font-bold uppercase tracking-tight text-black">
          Overall Performance Summary
        </h2>
        <div className="mb-3 flex items-center gap-3">
          <span className="text-sm font-bold uppercase tracking-wider text-black/60">
            Average Score:
          </span>
          <span
            className={`border-2 border-black px-3 py-1 text-xl font-bold ${scoreColor(session.averageScore)} ${scoreBg(session.averageScore)}`}
          >
            {Math.round(session.averageScore)}/10
          </span>
        </div>
        <p className="text-sm font-medium text-black/80">
          You answered {session.questionCount} questions on {session.topic}. Your strongest answers
          demonstrated good conceptual understanding. Focus on providing more specific examples and
          quantifying your experiences to improve your scores.
        </p>
      </section>

      <div className="flex justify-center">
        <Button nativeButton={false} render={<Link to="/history" />}>
          Back to History
        </Button>
      </div>
    </div>
  );
}
