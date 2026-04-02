import { useState, useEffect, useRef, type ReactNode } from 'react';
import { checkMediaRecorderSupport, checkMicDevices } from '@/lib/micCheck';
import {
  UNSUPPORTED_BROWSER_MESSAGE,
  NO_MIC_MESSAGE,
  MIC_PERMISSION_MESSAGE,
} from '@/constants/copy';
import { Button } from '@/components/ui/button';

type CheckStatus = 'checking' | 'passed' | 'failed';

export function MicCheckGate({ onReady, children }: { onReady: () => void; children: ReactNode }) {
  const [status, setStatus] = useState<CheckStatus>('checking');
  const [errorMessage, setErrorMessage] = useState('');
  const requestIdRef = useRef(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  async function runChecks() {
    const token = ++requestIdRef.current;

    if (!checkMediaRecorderSupport()) {
      if (!mountedRef.current || token !== requestIdRef.current) return;
      setErrorMessage(UNSUPPORTED_BROWSER_MESSAGE);
      setStatus('failed');
      return;
    }

    try {
      const hasDevices = await checkMicDevices();
      if (!mountedRef.current || token !== requestIdRef.current) return;
      if (!hasDevices) {
        setErrorMessage(NO_MIC_MESSAGE);
        setStatus('failed');
        return;
      }
    } catch {
      if (!mountedRef.current || token !== requestIdRef.current) return;
      setErrorMessage(NO_MIC_MESSAGE);
      setStatus('failed');
      return;
    }

    // Try getting mic permission early
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true }).then((s) => {
        s.getTracks().forEach((t) => t.stop());
      });
    } catch {
      if (!mountedRef.current || token !== requestIdRef.current) return;
      setErrorMessage(MIC_PERMISSION_MESSAGE);
      setStatus('failed');
      return;
    }

    if (!mountedRef.current || token !== requestIdRef.current) return;
    setStatus('passed');
    onReady();
  }

  useEffect(() => {
    void runChecks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (status === 'checking') {
    return (
      <div className="flex flex-col items-center gap-4 py-12">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
        <p className="text-sm text-muted-foreground">Checking microphone...</p>
      </div>
    );
  }

  if (status === 'failed') {
    return (
      <div className="flex flex-col items-center gap-4 py-12 text-center">
        <p className="max-w-md text-sm text-foreground">{errorMessage}</p>
        <Button
          variant="outline"
          onClick={() => {
            setStatus('checking');
            void runChecks();
          }}
        >
          Retry
        </Button>
      </div>
    );
  }

  return <>{children}</>;
}
