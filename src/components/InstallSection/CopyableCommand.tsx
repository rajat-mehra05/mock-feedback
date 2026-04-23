import { useState } from 'react';
import { Check, Copy } from 'lucide-react';

interface CopyableCommandProps {
  command: string;
}

export function CopyableCommand({ command }: CopyableCommandProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      setTimeout(() => setCopied(false), 2_000);
    } catch {
      // Clipboard API unavailable or blocked; manual selection still works.
    }
  }

  return (
    <div className="group relative border-2 border-black bg-black">
      <pre className="whitespace-pre-wrap break-all p-3 pr-12 font-mono text-xs text-white">
        <code>{command}</code>
      </pre>
      <button
        type="button"
        onClick={() => void handleCopy()}
        aria-label={copied ? 'Copied to clipboard' : 'Copy command to clipboard'}
        title={copied ? 'Copied' : 'Copy'}
        className="absolute right-2 top-2 flex h-8 w-8 cursor-pointer items-center justify-center border border-white/20 bg-black/60 text-white opacity-100 transition-opacity duration-150 hover:border-white/50 hover:bg-black focus-visible:opacity-100 lg:opacity-0 lg:group-hover:opacity-100"
      >
        {copied ? (
          <Check className="h-4 w-4" aria-hidden="true" />
        ) : (
          <Copy className="h-4 w-4" aria-hidden="true" />
        )}
      </button>
    </div>
  );
}
