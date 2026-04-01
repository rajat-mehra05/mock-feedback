import { type ReactNode, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { SettingsModal } from '@/components/SettingsModal/SettingsModal';
import { StartModal } from '@/components/StartModal/StartModal';

export function Layout({ children }: { children: ReactNode }) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [howItWorksOpen, setHowItWorksOpen] = useState(false);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
      >
        Skip to content
      </a>

      <header className="border-b border-border">
        <nav aria-label="Main navigation" className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <Link to="/" aria-label="Mock Feedback — Home" className="text-lg font-bold text-foreground">
            Mock Feedback
          </Link>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setHowItWorksOpen(true)}>
              How it works
            </Button>
            <Button variant="ghost" size="sm" nativeButton={false} render={<Link to="/history" />}>
              History
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setSettingsOpen(true)}>
              Settings
            </Button>
          </div>
        </nav>
      </header>

      <main id="main-content" tabIndex={-1} className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 outline-none">
        {children}
      </main>

      <SettingsModal open={settingsOpen} onOpenChange={setSettingsOpen} />
      <StartModal open={howItWorksOpen} onOpenChange={setHowItWorksOpen} />
    </div>
  );
}
