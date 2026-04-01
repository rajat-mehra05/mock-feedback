import { useState, useEffect, type ReactNode } from 'react';
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

  useEffect(() => {
    runChecks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function runChecks() {
    if (!checkMediaRecorderSupport()) {
      setErrorMessage(UNSUPPORTED_BROWSER_MESSAGE);
      setStatus('failed');
      return;
    }

    try {
      const hasDevices = await checkMicDevices();
      if (!hasDevices) {
        setErrorMessage(NO_MIC_MESSAGE);
        setStatus('failed');
        return;
      }
    } catch {
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
      setErrorMessage(MIC_PERMISSION_MESSAGE);
      setStatus('failed');
      return;
    }

    setStatus('passed');
    onReady();
  }

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
            runChecks();
          }}
        >
          Retry
        </Button>
      </div>
    );
  }

  return <>{children}</>;
}
