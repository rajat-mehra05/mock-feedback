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

    if (state.status === 'generating') {
      void (async () => {
        try {
          const question = await withRetry(
            (sig) => generateNextQuestion(state.topic, state.history, sig),
            { ...RETRY_OPTS, signal: s },
          );
          if (s.aborted) return;
          dispatch({ type: 'QUESTION_READY', question });
        } catch (error) {
          if (s.aborted) return;
          onError(error, 'generating');
        }
      })();
    }

    if (state.status === 'ai_speaking' && state.currentQuestion) {
      void (async () => {
        try {
          await speakText(state.currentQuestion!, s);
          if (s.aborted) return;
          dispatch({ type: 'TTS_DONE' });
        } catch {
          if (s.aborted) return;
          dispatch({ type: 'TTS_FAILED', question: state.currentQuestion! });
        }
      })();
    }

    if (state.status === 'user_recording' && !recorder.isRecording) {
      void recorder.startRecording();
    }

    if (state.status === 'generating_feedback') {
      if (state.pendingTranscriptions > 0) return; // wait for background transcriptions
      void (async () => {
        try {
          // Speak closing message (non-blocking — continue even if TTS fails)
          try {
            await speakText(INTERVIEW_CLOSING_MESSAGE, s);
          } catch {
            // TTS failure is non-blocking
          }
          if (s.aborted) return;
          const result = await generateFeedback(state.topic, state.history, s);
          if (s.aborted) return;
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
              followUp: result.questions[i]?.modelAnswer,
            })),
          });
          if (s.aborted) return;
          dispatch({ type: 'FEEDBACK_DONE', sessionId });
        } catch (error) {
          if (s.aborted) return;
          onError(error, 'generating_feedback');
        }
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.status, state.currentQuestionIndex, state.pendingTranscriptions]);

  // Surface recorder errors into session state
  useEffect(() => {
    if (recorder.error && state.status === 'user_recording') {
      onError(
        { type: 'unknown', message: recorder.error, retryable: false } as OpenAIServiceError,
        'user_recording',
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recorder.error]);

  // audioBlob ready → advance to next question immediately, transcribe in background
  useEffect(() => {
    if (!recorder.audioBlob || state.status !== 'user_recording') return;
    const blob = recorder.audioBlob;
    const questionIndex = state.history.length; // index this answer will occupy
    recorder.clearBlob();
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
    });
  }, []);

  const stop = useCallback(() => {
    abortRef.current.abort();
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
