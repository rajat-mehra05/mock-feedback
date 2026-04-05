import { useReducer, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { interviewReducer, initialState } from './reducer';
import type { InterviewConfig, InterviewState } from './types';
import { generateNextQuestion } from '@/services/llm/llm';
import { speakText } from '@/services/tts/tts';
import { transcribeAudio } from '@/services/stt/stt';
import { generateFeedback } from '@/services/feedback/feedback';
import { useAudioRecorder } from '@/hooks/useAudioRecorder/useAudioRecorder';
import { withRetry } from '@/lib/retry';
import { RETRY_MAX_ATTEMPTS, RETRY_BASE_DELAY_MS, RETRY_MAX_DELAY_MS } from '@/constants/interview';
import { INTERVIEW_CLOSING_MESSAGE } from '@/constants/openai';
import { REPEAT_QUESTION_PHRASE } from '@/constants/prompts';
import { createSession } from '@/db/sessions/sessions';
import type { OpenAIServiceError } from '@/services/types';

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
      void (async () => {
        try {
          const question = await withRetry(
            (sig) =>
              generateNextQuestion(state.topicLabel, state.history, sig, state.candidateName),
            { ...RETRY_OPTS, signal: effectSignal },
          );
          if (effectSignal.aborted) return;
          const isRepeat = question.includes(REPEAT_QUESTION_PHRASE);
          dispatch({ type: 'QUESTION_READY', question, isRepeat });
        } catch (error) {
          if (effectSignal.aborted) return;
          onError(error, 'generating');
        }
      })();
    }

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
          const result = await generateFeedback(state.topicLabel, state.history, effectSignal);
          if (effectSignal.aborted) return;
          const sessionId = crypto.randomUUID();
          const elapsed = state.startedAt ? Math.round((Date.now() - state.startedAt) / 1000) : 0;
          const avg =
            result.questions.reduce((sum, q) => sum + q.rating, 0) / result.questions.length || 0;

          await createSession({
            id: sessionId,
            topic: state.topicLabel,
            createdAt: new Date(),
            duration: elapsed,
            questionCount: state.history.length,
            averageScore: Math.round(avg * 10) / 10,
            questions: state.history.map((turn, i) => ({
              id: crypto.randomUUID(),
              questionText: turn.question,
              userTranscript: turn.answer,
              rating: result.questions[i]?.rating ?? 0,
              feedback: result.questions[i]?.feedback ?? '',
              confidence: result.questions[i]?.confidence ?? 'medium',
              followUp: result.questions[i]?.modelAnswer,
            })),
          });
          if (effectSignal.aborted) return;
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
        { type: 'unknown', message: recorder.error, retryable: true } as OpenAIServiceError,
        'user_recording',
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recorder.error]);

  // Minimum blob size (bytes) to consider as real speech — silence-only blobs are typically <1KB
  const MIN_BLOB_SIZE = 2000;

  // audioBlob ready → check if it contains real speech, then advance
  useEffect(() => {
    if (!recorder.audioBlob || state.status !== 'user_recording') return;
    const blob = recorder.audioBlob;
    recorder.clearBlob();

    // Skip STT for silent/empty blobs — prevents Whisper hallucination
    if (blob.size < MIN_BLOB_SIZE) {
      dispatch({ type: 'SKIP_NO_RESPONSE' });
      return;
    }

    const questionIndex = state.history.length; // index this answer will occupy
    dispatch({ type: 'ANSWER_RECORDED' });

    // Background transcription — doesn't block the interview flow
    const s = getSignal();
    void (async () => {
      try {
        const transcript = await transcribeAudio(blob, s);
        if (s.aborted) return;
        dispatch({ type: 'TRANSCRIPT_READY', questionIndex, transcript });
      } catch {
        if (s.aborted) return;
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
  useEffect(() => () => abortRef.current.abort(), []);

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
