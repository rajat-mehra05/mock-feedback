import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { getSession, type Session } from '@/db';

function scoreColor(score: number): string {
  if (score >= 8) return 'text-green-600';
  if (score >= 6) return 'text-yellow-600';
  return 'text-red-600';
}

function scoreBg(score: number): string {
  if (score >= 8) return 'bg-green-50 border-green-200';
  if (score >= 6) return 'bg-yellow-50 border-yellow-200';
  return 'bg-red-50 border-red-200';
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
    return <p className="py-8 text-center text-muted-foreground">Loading feedback...</p>;
  }

  if (!session) {
    return (
      <div className="flex flex-col items-center gap-4 py-12">
        <p className="text-lg text-muted-foreground">Session not found</p>
        <Button render={<Link to="/history" />}>Back to History</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Session Feedback</h1>
          <p className="text-sm text-muted-foreground">
            {session.topic} · {session.questionCount} questions
          </p>
        </div>
        <Select
          value={viewMode}
          onValueChange={(v) => setViewMode((v ?? 'feedback') as 'feedback' | 'model-answers')}
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

      <div className="space-y-4">
        {session.questions.map((q, i) => (
          <section
            key={q.id}
            className="rounded-lg border border-border bg-card p-5 shadow-sm"
            aria-label={`Question ${i + 1}`}
          >
            <div className="mb-3 flex items-start justify-between">
              <h3 className="text-sm font-semibold text-foreground">Question {i + 1}</h3>
              <Badge
                className={`${scoreBg(q.rating)} border`}
                aria-label={`Rating: ${q.rating} out of 10`}
              >
                <span className={`font-bold ${scoreColor(q.rating)}`}>{q.rating}/10</span>
              </Badge>
            </div>

            <p className="mb-3 font-medium text-foreground">{q.questionText}</p>

            {viewMode === 'feedback' ? (
              <>
                <div className="mb-2 rounded-md bg-muted/50 p-3">
                  <p className="mb-1 text-xs font-medium text-muted-foreground">Your Answer</p>
                  <p className="text-sm text-foreground">{q.userTranscript}</p>
                </div>
                <div>
                  <p className="mb-1 text-xs font-medium text-muted-foreground">Feedback</p>
                  <p className="text-sm text-foreground">{q.feedback}</p>
                </div>
              </>
            ) : (
              <div className="rounded-md bg-green-50 p-3">
                <p className="mb-1 text-xs font-medium text-green-700">Model Answer</p>
                <p className="text-sm text-green-900">
                  {q.feedback}
                </p>
              </div>
            )}
          </section>
        ))}
      </div>

      <section className="rounded-lg border border-border bg-muted/30 p-5">
        <h2 className="mb-2 text-lg font-semibold text-foreground">Overall Performance Summary</h2>
        <div className="mb-3 flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Average Score:</span>
          <span className={`text-xl font-bold ${scoreColor(session.averageScore)}`}>
            {session.averageScore.toFixed(1)}/10
          </span>
        </div>
        <p className="text-sm text-muted-foreground">
          You answered {session.questionCount} questions on {session.topic}. Your strongest answers
          demonstrated good conceptual understanding. Focus on providing more specific examples and
          quantifying your experiences to improve your scores.
        </p>
      </section>

      <div className="flex justify-center">
        <Button render={<Link to="/history" />}>Back to History</Button>
      </div>
    </div>
  );
}
