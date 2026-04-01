import { useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { TOPIC_LABELS, DEFAULT_QUESTION_COUNT } from '@/constants/topics';
import { useInterviewSession } from '@/hooks/useInterviewSession/useInterviewSession';
import { SessionHeader } from './SessionHeader';
import { ConversationLog } from './ConversationLog';
import { StatusIndicator } from './StatusIndicator';
import { RecordingTimer } from './RecordingTimer';
import { SessionErrorDisplay } from './SessionErrorDisplay';
import { MicCheckGate } from './MicCheckGate';

export function Session() {
  const [searchParams] = useSearchParams();
  const topic = searchParams.get('topic') ?? 'javascript-typescript';
  const rawCount = Number(searchParams.get('count'));
  const count =
    Number.isFinite(rawCount) && rawCount > 0 ? rawCount : Number(DEFAULT_QUESTION_COUNT);
  const topicLabel = TOPIC_LABELS[topic] ?? topic;
  const { state, start, stop, retry, stopRecordingOnly } = useInterviewSession();
  const startedRef = useRef(false);

  const handleMicReady = useCallback(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    start({ topic, topicLabel, questionCount: count });
  }, [start, topic, topicLabel, count]);

  const handleMaxRecording = useCallback(() => {
    stopRecordingOnly();
  }, [stopRecordingOnly]);

  // Warn on navigation away during active session
  useEffect(() => {
    const active = !['idle', 'completed', 'error'].includes(state.status);
    if (!active) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [state.status]);

  return (
    <div className="flex flex-col items-center gap-6 py-4">
      <SessionHeader
        topicLabel={topicLabel}
        currentIndex={state.currentQuestionIndex}
        totalCount={count}
      />

      <MicCheckGate onReady={handleMicReady}>
        <ConversationLog
          history={state.history}
          currentQuestion={state.currentQuestion}
          ttsFallbackText={state.ttsFallbackText}
        />

        <StatusIndicator status={state.status} />

        <RecordingTimer
          isActive={state.status === 'user_recording'}
          onMaxReached={handleMaxRecording}
        />

        {state.status === 'error' && state.error && (
          <SessionErrorDisplay error={state.error} onRetry={retry} />
        )}

        {!['idle', 'completed', 'error'].includes(state.status) && (
          <button
            onClick={stop}
            aria-label="Stop interview"
            className="flex h-20 w-20 cursor-pointer items-center justify-center border-4 border-black bg-neo-accent text-sm font-bold uppercase tracking-wide text-black shadow-neo transition-all duration-100 hover:-translate-y-0.5 hover:shadow-neo-md focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 active:translate-x-[3px] active:translate-y-[3px] active:shadow-none"
          >
            Stop
          </button>
        )}
      </MicCheckGate>
    </div>
  );
}
