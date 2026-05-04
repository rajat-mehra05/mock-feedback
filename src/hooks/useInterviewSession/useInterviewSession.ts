import { useReducer, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { interviewReducer, initialState } from './reducer';
import type { InterviewConfig, InterviewState } from './types';
import { streamAndSpeakQuestion } from '@/services/llm/streamingQuestion';
import { speakText } from '@/services/tts/tts';
import { transcribeAudio } from '@/services/stt/stt';
import { generateFeedback } from '@/services/feedback/feedback';
import { getTopicScope } from '@/constants/topics';
import { useAudioRecorder } from '@/hooks/useAudioRecorder/useAudioRecorder';
import { withRetry } from '@/lib/retry';
import { RETRY_MAX_ATTEMPTS, RETRY_BASE_DELAY_MS, RETRY_MAX_DELAY_MS } from '@/constants/interview';
import { INTERVIEW_CLOSING_MESSAGE } from '@/constants/openai';
import { REPEAT_QUESTION_PHRASE } from '@/constants/prompts';
import { platform } from '@/platform';
import type { OpenAIServiceError } from '@/services/types';
import { trackEvent } from '@/lib/analytics';

// Minimum blob size (bytes) to consider as real speech — silence-only blobs are typically <1KB
const MIN_BLOB_SIZE = 2000;

const RETRY_OPTS = {
  maxAttempts: RETRY_MAX_ATTEMPTS,
  baseDelayMs: RETRY_BASE_DELAY_MS,
  maxDelayMs: RETRY_MAX_DELAY_MS,
};

export function useInterviewSession() {
  const [state, dispatch] = useReducer(interviewReducer, initialState);
  const navigate = useNavigate();
  const abortRef = useRef<AbortController>(new AbortController());
  const recorder = useAudioRecorder();

  // Streaming chat emits 50+ tokens per response; dispatching on every
  // token re-renders the transcript that often. Buffer cumulative text
  // in a ref and flush once per animation frame (~16ms) instead.
  const pendingTextRef = useRef<string | null>(null);
  const rafIdRef = useRef<number | null>(null);
  const flushPendingText = useCallback(() => {
    rafIdRef.current = null;
    const text = pendingTextRef.current;
    pendingTextRef.current = null;
    if (text !== null) dispatch({ type: 'QUESTION_TEXT_PROGRESS', text });
  }, []);
  const cancelPendingText = useCallback(() => {
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    pendingTextRef.current = null;
  }, []);
  const scheduleTextUpdate = useCallback(
    (text: string) => {
      pendingTextRef.current = text;
      if (rafIdRef.current === null) {
        rafIdRef.current = requestAnimationFrame(flushPendingText);
      }
    },
    [flushPendingText],
  );

  const getSignal = () => abortRef.current.signal;

  const onError = (error: unknown, failedStatus: InterviewState) => {
    dispatch({ type: 'ERROR', error: error as OpenAIServiceError, failedStatus });
  };

  // Main side-effect engine — reacts to state.status changes
  useEffect(() => {
    const s = getSignal();
    if (s.aborted) return;

    // Local controller prevents duplicate async work when the effect re-runs
    // (e.g. pendingTranscriptions changes while status is still 'generating')
    const localController = new AbortController();
    const effectSignal = AbortSignal.any([s, localController.signal]);

    if (state.status === 'generating') {
      // Skip LLM call if we've already reached the target — reducer will finalize
      if (state.history.length >= state.targetQuestionCount) {
        dispatch({ type: 'QUESTION_READY', question: '', isRepeat: false });
        return () => localController.abort();
      }
      void (async () => {
        try {
          const result = await withRetry(
            (sig) =>
              streamAndSpeakQuestion({
                topic: state.topicLabel,
                history: state.history,
                candidateName: state.candidateName,
                ...getTopicScope(state.topic),
                onTextUpdate: scheduleTextUpdate,
                signal: sig,
              }),
            { ...RETRY_OPTS, signal: effectSignal },
          );
          if (effectSignal.aborted) return;
          const raw = result.text;
          const isRepeat = raw.includes(REPEAT_QUESTION_PHRASE);
          const question = isRepeat ? raw.replace(REPEAT_QUESTION_PHRASE, '').trim() : raw;
          // Drain any in-flight QUESTION_TEXT_PROGRESS before committing the
          // final question — otherwise a pending rAF can overwrite the final
          // text with a stale partial after this dispatch.
          cancelPendingText();
          // Chat + TTS have both completed at this point. Dispatch the two
          // actions back-to-back so React 18 batches them into a single
          // commit and the `ai_speaking` handler below never re-fires TTS.
          dispatch({ type: 'QUESTION_READY', question, isRepeat });
          if (result.ttsFailed) {
            // Some sentences didn't play — preserve the existing ttsFallbackText
            // UX so the user can still read the question.
            dispatch({ type: 'TTS_FAILED', question });
          } else {
            dispatch({ type: 'TTS_DONE' });
          }
        } catch (error) {
          if (effectSignal.aborted) return;
          onError(error, 'generating');
        }
      })();
    }

    // Kept for non-streaming fallback paths (e.g. retry from `ai_speaking`
    // after a TTS_FAILED). The streaming flow above bypasses this branch by
    // dispatching QUESTION_READY + TTS_DONE together.
    if (state.status === 'ai_speaking' && state.currentQuestion) {
      void (async () => {
        try {
          await speakText(state.currentQuestion!, effectSignal);
          if (effectSignal.aborted) return;
          dispatch({ type: 'TTS_DONE' });
        } catch {
          if (effectSignal.aborted) return;
          dispatch({ type: 'TTS_FAILED', question: state.currentQuestion! });
        }
      })();
    }

    if (state.status === 'user_recording' && !recorder.isRecording) {
      void recorder.startRecording();
    }

    if (state.status === 'skipping') {
      const timer = setTimeout(() => {
        if (effectSignal.aborted) return;
        dispatch({ type: 'SKIP_DONE' });
      }, 1500);
      return () => {
        clearTimeout(timer);
        localController.abort();
      };
    }

    if (state.status === 'generating_feedback') {
      if (state.pendingTranscriptions > 0) {
        localController.abort();
        return; // wait for background transcriptions
      }
      void (async () => {
        try {
          // Speak closing message (non-blocking — continue even if TTS fails)
          try {
            await speakText(INTERVIEW_CLOSING_MESSAGE, effectSignal);
          } catch {
            // TTS failure is non-blocking
          }
          if (effectSignal.aborted) return;
          const result = await generateFeedback(
            state.topicLabel,
            state.history,
            effectSignal,
            getTopicScope(state.topic),
          );
          if (effectSignal.aborted) return;
          const sessionId = crypto.randomUUID();
          const elapsed = state.startedAt ? Math.round((Date.now() - state.startedAt) / 1000) : 0;
          const avg =
            result.questions.reduce((sum, q) => sum + q.rating, 0) / result.questions.length || 0;

          await platform.storage.sessions.create({
            id: sessionId,
            topic: state.topicLabel,
            createdAt: new Date(),
            duration: elapsed,
            questionCount: state.history.length,
            averageScore: Math.round(avg * 10) / 10,
            summary: result.summary,
            questions: state.history.map((turn, i) => ({
              id: crypto.randomUUID(),
              questionText: turn.question,
              userTranscript: turn.answer,
              rating: result.questions[i]?.rating ?? 0,
              feedback: result.questions[i]?.feedback ?? '',
              confidence: result.questions[i]?.confidence ?? 'medium',
              modelAnswer: result.questions[i]?.modelAnswer ?? '',
            })),
          });
          if (effectSignal.aborted) return;
          void trackEvent('session_completed', {
            topic: state.topicLabel,
            questionCount: state.targetQuestionCount,
            answeredCount: state.history.length,
            isPartial: state.isPartial,
          });
          dispatch({ type: 'FEEDBACK_DONE', sessionId });
        } catch (error) {
          if (effectSignal.aborted) return;
          onError(error, 'generating_feedback');
        }
      })();
    }

    return () => localController.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.status, state.currentQuestionIndex, state.pendingTranscriptions]);

  // Surface recorder errors into session state
  useEffect(() => {
    if (recorder.error && state.status === 'user_recording') {
      onError(
        {
          type: 'unknown',
          message: recorder.error.message,
          retryable: true,
        } as OpenAIServiceError,
        'user_recording',
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recorder.error]);

  // audioBlob ready → check if it contains real speech, then advance
  useEffect(() => {
    if (!recorder.audioBlob || state.status !== 'user_recording') return;
    const blob = recorder.audioBlob;
    // Snapshot the streaming id before clearBlob resets it; `transcribeAudio`
    // needs it to commit the Rust-side buffer.
    const streamingId = recorder.streamingId;
    recorder.clearBlob();

    // Called on any path that won't reach `transcribe_commit` (silent
    // skip, transcribe failure after retries) so the Rust-side buffer
    // doesn't linger. Safe when streamingId is null or the web adapter
    // has no streaming support — both short-circuit.
    const discardStreamingBuffer = () => {
      if (streamingId) void platform.http.openai.transcribeStreaming?.discard(streamingId);
    };

    // Skip STT for silent/empty blobs — prevents Whisper hallucination
    if (blob.size < MIN_BLOB_SIZE) {
      discardStreamingBuffer();
      dispatch({ type: 'SKIP_NO_RESPONSE' });
      return;
    }

    const questionIndex = state.history.length; // index this answer will occupy
    dispatch({ type: 'ANSWER_RECORDED' });

    // Background transcription with retry — doesn't block the interview flow
    const s = getSignal();
    void (async () => {
      try {
        const transcript = await withRetry((sig) => transcribeAudio(blob, sig, streamingId), {
          ...RETRY_OPTS,
          signal: s,
        });
        if (s.aborted) return;
        dispatch({ type: 'TRANSCRIPT_READY', questionIndex, transcript });
      } catch (error) {
        if (s.aborted) return;
        // On final failure (retries exhausted) the Rust buffer is still
        // alive — drop it so a long-running session doesn't accumulate
        // orphaned recordings under the byte cap.
        discardStreamingBuffer();
        // Surface so users have something to paste when transcription breaks;
        // the state machine still records "[transcription failed]" for the LLM.
        console.error('[transcribe] failed for question', questionIndex, error);
        dispatch({ type: 'TRANSCRIPT_READY', questionIndex, transcript: '[transcription failed]' });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recorder.audioBlob]);

  // Navigate to feedback on completion
  useEffect(() => {
    if (state.status === 'completed' && state.sessionId) {
      void navigate(`/history/${state.sessionId}`);
    }
  }, [state.status, state.sessionId, navigate]);

  // Cleanup on unmount
  useEffect(
    () => () => {
      abortRef.current.abort();
      cancelPendingText();
    },
    [cancelPendingText],
  );

  const start = useCallback((config: InterviewConfig) => {
    abortRef.current.abort();
    abortRef.current = new AbortController();
    dispatch({
      type: 'START',
      topic: config.topic,
      topicLabel: config.topicLabel,
      questionCount: config.questionCount,
      candidateName: config.candidateName,
    });
  }, []);

  const stop = useCallback(() => {
    abortRef.current.abort();
    abortRef.current = new AbortController();
    if (recorder.isRecording) recorder.stopRecording();
    dispatch({ type: 'STOP' });
  }, [recorder]);

  const retry = useCallback(() => {
    abortRef.current = new AbortController();
    dispatch({ type: 'RETRY' });
  }, []);

  const stopRecordingOnly = useCallback(() => {
    if (recorder.isRecording) recorder.stopRecording();
  }, [recorder]);

  return { state, start, stop, retry, stopRecordingOnly };
}
