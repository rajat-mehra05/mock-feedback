import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface ByokExplainerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// BYOK Tauri-vs-PWA tradeoff; opened from desktop secondary CTA + Settings.
export function ByokExplainerModal({ open, onOpenChange }: ByokExplainerModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Where your API key is stored</DialogTitle>
          <DialogDescription>
            VoiceRound is BYOK — you bring your own OpenAI key. Where the key lives depends on which
            version you install.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 text-sm font-medium text-black/80">
          <div className="border-2 border-black bg-white p-3">
            <p className="text-xs font-bold uppercase tracking-wider text-black/60">
              Desktop app (Tauri)
            </p>
            <p className="mt-1">
              Key lives in the OS keychain (macOS Keychain, Windows Credential Manager). All OpenAI
              traffic is routed through a bundled Rust process so the key never reaches the
              renderer. Browser extensions on your system can&apos;t read it.
            </p>
          </div>

          <div className="border-2 border-black bg-white p-3">
            <p className="text-xs font-bold uppercase tracking-wider text-black/60">
              Web app (PWA)
            </p>
            <p className="mt-1">
              Key lives in the browser&apos;s IndexedDB on this device. Two implications worth
              knowing:
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-xs">
              <li>
                A successful XSS in the page can read the key and run charges against your OpenAI
                account.
              </li>
              <li>
                Browser extensions with the right permissions can read IndexedDB on this origin.
              </li>
            </ul>
          </div>

          <p className="text-xs text-black/60">
            For a personal device with a trusted browser the PWA is fine. The desktop app is a
            stronger choice on shared machines or where browser extension hygiene is weaker.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Got it
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
