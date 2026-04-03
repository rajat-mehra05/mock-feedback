import { cn } from '@/lib/utils';

interface SpinnerProps {
  className?: string;
  message?: string;
  centered?: boolean;
}

export function Spinner({ className, message, centered }: SpinnerProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center gap-3',
        centered ? 'fixed inset-0 z-50 justify-center' : 'py-12',
        className,
      )}
    >
      <div
        className={cn(
          'animate-spin rounded-full border-black border-t-transparent',
          centered ? 'h-12 w-12 border-[5px]' : 'h-8 w-8 border-4',
        )}
        role="status"
        aria-label={message ?? 'Loading'}
      />
      {message && (
        <p
          className={cn(
            'font-bold uppercase tracking-wider text-black/60',
            centered ? 'text-base' : 'text-sm',
          )}
        >
          {message}
        </p>
      )}
    </div>
  );
}
