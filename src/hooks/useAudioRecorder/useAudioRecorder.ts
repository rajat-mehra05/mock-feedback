import { useState, useRef, useCallback, useEffect } from 'react';
import { MicVAD } from '@ricky0123/vad-web';
import { AUDIO_MIME_TYPES } from '@/constants/openai';
import { SILENCE_TIMEOUT_SECONDS } from '@/constants/session';

interface UseAudioRecorderReturn {
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  clearBlob: () => void;
  isRecording: boolean;
  audioBlob: Blob | null;
  error: string | null;
}

function getSupportedMimeType(): string {
  if (typeof MediaRecorder === 'undefined') return '';
  if (MediaRecorder.isTypeSupported(AUDIO_MIME_TYPES.WEBM)) return AUDIO_MIME_TYPES.WEBM;
  if (MediaRecorder.isTypeSupported(AUDIO_MIME_TYPES.MP4)) return AUDIO_MIME_TYPES.MP4;
  return '';
}

export function useAudioRecorder(): UseAudioRecorderReturn {
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const vadRef = useRef<MicVAD | null>(null);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cleanupVAD = useCallback(async () => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    if (vadRef.current) {
      await vadRef.current.destroy();
      vadRef.current = null;
    }
  }, []);

  const stopRecording = useCallback(() => {
    void cleanupVAD();
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state === 'recording') {
      recorder.stop();
    }
  }, [cleanupVAD]);

  const startRecording = useCallback(async () => {
    // Guard against overlapping recording sessions
    const existing = mediaRecorderRef.current;
    if (existing && existing.state !== 'inactive') return;

    setError(null);
    setAudioBlob(null);

    const mimeType = getSupportedMimeType();
    if (!mimeType) {
      setError('Your browser does not support audio recording.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];

      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        setAudioBlob(blob);
        setIsRecording(false);
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      };

      recorder.onerror = () => {
        void cleanupVAD();
        chunksRef.current = [];
        setAudioBlob(null);
        setIsRecording(false);
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        setError('Recording failed unexpectedly.');
      };

      recorder.start();
      setIsRecording(true);

      // Neural VAD for speech detection — stops recording after speech ends
      const stopRef = stopRecording;
      const vad = await MicVAD.new({
        baseAssetPath: '/vad/',
        onnxWASMBasePath: '/vad/',
        getStream: () => Promise.resolve(stream),
        startOnLoad: true,
        redemptionMs: SILENCE_TIMEOUT_SECONDS * 1000,
        onSpeechEnd: () => {
          // Speech ended and silence exceeded redemption period — stop recording
          silenceTimerRef.current = null;
          stopRef();
        },
      });
      vadRef.current = vad;
    } catch (err) {
      await cleanupVAD();
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      const msg =
        err instanceof DOMException && err.name === 'NotAllowedError'
          ? 'Microphone access is required. Please allow microphone access in your browser settings.'
          : 'Failed to start recording.';
      setError(msg);
    }
  }, [stopRecording, cleanupVAD]);

  // Release all resources on unmount
  useEffect(() => {
    return () => {
      void cleanupVAD();
      const recorder = mediaRecorderRef.current;
      if (recorder && recorder.state === 'recording') {
        recorder.stop();
      }
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [cleanupVAD]);

  const clearBlob = useCallback(() => setAudioBlob(null), []);

  return { startRecording, stopRecording, clearBlob, isRecording, audioBlob, error };
}
