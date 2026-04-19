import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface StopDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  answeredCount: number;
  totalCount: number;
  onLeave: () => void;
  onEndEarly: () => void;
}

export function StopDialog({
  open,
  onOpenChange,
  answeredCount,
  totalCount,
  onLeave,
  onEndEarly,
}: StopDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>
            {answeredCount === 0 ? 'Leave Interview?' : 'End Interview Early?'}
          </DialogTitle>
          <DialogDescription>
            {answeredCount === 0
              ? "You haven't answered any questions. No feedback will be generated."
              : `You've answered ${answeredCount} of ${totalCount} questions. End now and get partial feedback?`}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          {answeredCount === 0 ? (
            <Button variant="destructive" onClick={onLeave}>
              Leave
            </Button>
          ) : (
            <Button onClick={onEndEarly}>End & Get Feedback</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
