import { type ReactNode, lazy, Suspense, useState, useRef, useCallback, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

const SettingsModal = lazy(() =>
  import('@/components/SettingsModal/SettingsModal').then((m) => ({
    default: m.SettingsModal,
  })),
);

export function Layout({ children }: { children: ReactNode }) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const menuToggleRef = useRef<HTMLButtonElement>(null);
  const firstMenuItemRef = useRef<HTMLAnchorElement>(null);

  const closeMenu = useCallback(() => {
    setMobileMenuOpen(false);
    menuToggleRef.current?.focus();
  }, []);

  // Close mobile menu on Escape
  useEffect(() => {
    if (!mobileMenuOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeMenu();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [mobileMenuOpen, closeMenu]);

  // Focus first menu item when menu opens
  useEffect(() => {
    if (mobileMenuOpen) firstMenuItemRef.current?.focus();
  }, [mobileMenuOpen]);

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

          {/* Desktop nav */}
          <div className="hidden items-center gap-1 md:flex">
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

          {/* Mobile hamburger + dropdown */}
          <div className="relative md:hidden">
            <Button
              ref={menuToggleRef}
              variant="ghost"
              size="icon-sm"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-expanded={mobileMenuOpen}
              aria-haspopup="menu"
              aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
            >
              {mobileMenuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
            </Button>

            {mobileMenuOpen && (
              <div
                role="menu"
                className="absolute right-0 top-full z-50 mt-2 w-44 flex-col border-4 border-black bg-neo-cream shadow-neo-md"
              >
                <Link
                  ref={firstMenuItemRef}
                  role="menuitem"
                  to="/history"
                  className="block px-4 py-3 text-sm font-bold uppercase tracking-wide hover:bg-neo-secondary"
                  onClick={closeMenu}
                >
                  History
                </Link>
                <hr className="border-t-2 border-black" />
                <button
                  role="menuitem"
                  className="w-full px-4 py-3 text-left text-sm font-bold uppercase tracking-wide hover:bg-neo-secondary"
                  onClick={() => {
                    closeMenu();
                    setSettingsOpen(true);
                  }}
                >
                  Settings
                </button>
              </div>
            )}
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

      {settingsOpen && (
        <Suspense fallback={null}>
          <SettingsModal open={settingsOpen} onOpenChange={setSettingsOpen} />
        </Suspense>
      )}
    </div>
  );
}
