import { type ReactNode, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { SettingsModal } from '@/components/SettingsModal/SettingsModal';
import { StartModal } from '@/components/StartModal/StartModal';

export function Layout({ children }: { children: ReactNode }) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [howItWorksOpen, setHowItWorksOpen] = useState(false);

  return (
    <div className="flex min-h-screen flex-col bg-background neo-grid-pattern">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:border-2 focus:border-black focus:bg-neo-secondary focus:px-4 focus:py-2 focus:font-bold"
      >
        Skip to content
      </a>

      <header className="border-b-4 border-black bg-neo-cream">
        <nav
          aria-label="Main navigation"
          className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4"
        >
          <Link to="/" aria-label="Mock Feedback — Home" className="flex items-center gap-2">
            <img
              src="/logo.png"
              alt=""
              aria-hidden="true"
              className="h-9 w-9 border-2 border-black object-cover shadow-[3px_3px_0px_0px_#000]"
            />
            <span className="text-xl font-bold uppercase leading-none tracking-tight text-black">
              Mock Feedback
            </span>
          </Link>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setHowItWorksOpen(true)}
              aria-haspopup="dialog"
            >
              How it works
            </Button>
            <Button variant="ghost" size="sm" nativeButton={false} render={<Link to="/history" />}>
              History
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSettingsOpen(true)}
              aria-haspopup="dialog"
            >
              Settings
            </Button>
          </div>
        </nav>
      </header>

      <main
        id="main-content"
        tabIndex={-1}
        className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 py-8 outline-none"
      >
        {children}
      </main>

      <SettingsModal open={settingsOpen} onOpenChange={setSettingsOpen} />
      <StartModal open={howItWorksOpen} onOpenChange={setHowItWorksOpen} />
    </div>
  );
}
