import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface IosInstallModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// iOS Safari has no beforeinstallprompt event. Add to Home Screen is
// strictly a manual flow via the Share menu. Show step-by-step
// instructions with the Apple Share glyph rather than a screenshot —
// screenshots age across iOS versions and become misleading after a
// system redesign.
//
// The SVG glyph below is a hand-traced approximation of Apple's Share
// icon that renders consistently regardless of iOS version, system
// font, or OS theme. Decorative only (aria-hidden); the surrounding
// text carries the real instruction.
function ShareIconGlyph() {
  return (
    <svg
      width="20"
      height="24"
      viewBox="0 0 20 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="inline-block translate-y-[-1px] align-middle"
    >
      <path d="M10 16V2" />
      <path d="M5 7l5-5 5 5" />
      <path d="M3 12v8a2 2 0 002 2h10a2 2 0 002-2v-8" />
    </svg>
  );
}

export function IosInstallModal({ open, onOpenChange }: IosInstallModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Install on iPhone or iPad</DialogTitle>
          <DialogDescription>
            iOS doesn&apos;t support one-tap install. The Add to Home Screen flow takes about ten
            seconds.
          </DialogDescription>
        </DialogHeader>

        <ol className="space-y-3 text-sm font-medium text-black/80">
          <li className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center border-2 border-black bg-neo-secondary text-xs font-bold">
              1
            </span>
            <span>
              Tap the <ShareIconGlyph /> <strong>Share</strong> button in the Safari toolbar.
            </span>
          </li>
          <li className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center border-2 border-black bg-neo-secondary text-xs font-bold">
              2
            </span>
            <span>
              Scroll down and tap <strong>Add to Home Screen</strong>.
            </span>
          </li>
          <li className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center border-2 border-black bg-neo-secondary text-xs font-bold">
              3
            </span>
            <span>
              Confirm the name (VoiceRound) and tap <strong>Add</strong>. The icon appears on your
              home screen.
            </span>
          </li>
        </ol>

        <p className="text-xs font-medium text-black/60">
          The Add to Home Screen entry only shows in Safari. If you opened this site in Chrome or
          another iOS browser, switch to Safari first.
        </p>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Got it
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
