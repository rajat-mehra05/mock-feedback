import { type ReactNode, useState, useRef, useCallback, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SettingsModal } from '@/components/SettingsModal/SettingsModal';
import { APP_NAME } from '@/constants/copy';
import logoSvg from '@/assets/logo.svg';

export function Layout({ children }: { children: ReactNode }) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const menuToggleRef = useRef<HTMLButtonElement>(null);
  const menuItemRefs = useRef<(HTMLElement | null)[]>([]);

  const closeMenu = useCallback(() => {
    setMobileMenuOpen(false);
    menuToggleRef.current?.focus();
  }, []);

  const onMenuKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const items = menuItemRefs.current.filter(Boolean) as HTMLElement[];
      if (!items.length) return;
      const currentIndex = items.indexOf(document.activeElement as HTMLElement);

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        const next = currentIndex < items.length - 1 ? currentIndex + 1 : 0;
        items[next].focus();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        const prev = currentIndex > 0 ? currentIndex - 1 : items.length - 1;
        items[prev].focus();
      } else if (e.key === 'Escape') {
        closeMenu();
      }
    },
    [closeMenu],
  );

  // Focus first menu item when menu opens
  useEffect(() => {
    if (mobileMenuOpen) menuItemRefs.current[0]?.focus();
  }, [mobileMenuOpen]);

  // Global shortcut: Cmd+, (macOS) / Ctrl+, (Windows/Linux) opens Settings.
  // Skip when typing in an editable field so the modal does not interrupt input.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.shiftKey || e.altKey) return;
      if (!(e.metaKey || e.ctrlKey) || e.key !== ',') return;
      const { target } = e;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        (target instanceof HTMLElement && target.isContentEditable)
      ) {
        return;
      }
      e.preventDefault();
      setSettingsOpen(true);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

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
          <Link to="/" aria-label={`${APP_NAME} — Home`} className="flex items-center gap-2">
            <img
              src={logoSvg}
              alt=""
              aria-hidden="true"
              fetchPriority="high"
              className="h-11 w-11"
            />
            <span className="text-xl font-bold uppercase leading-none tracking-tight text-black">
              {APP_NAME}
            </span>
          </Link>

          {/* Desktop nav */}
          <div className="hidden items-center gap-2 md:flex">
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
              size="icon"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-expanded={mobileMenuOpen}
              aria-haspopup="menu"
              aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
            >
              {mobileMenuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
            </Button>

            {mobileMenuOpen && (
              /* eslint-disable-next-line jsx-a11y/interactive-supports-focus -- WAI-ARIA menu pattern: focus lives on individual menuitems, not the container */
              <div
                role="menu"
                onKeyDown={onMenuKeyDown}
                className="absolute right-0 top-full z-50 mt-2 w-44 flex-col border-4 border-black bg-neo-cream shadow-neo-md"
              >
                <Link
                  ref={(el) => {
                    menuItemRefs.current[0] = el;
                  }}
                  role="menuitem"
                  tabIndex={-1}
                  to="/history"
                  className="block px-4 py-3 text-sm font-bold uppercase tracking-wide hover:bg-neo-secondary"
                  onClick={closeMenu}
                >
                  History
                </Link>
                <hr className="border-t-2 border-black" />
                <button
                  ref={(el) => {
                    menuItemRefs.current[1] = el;
                  }}
                  role="menuitem"
                  tabIndex={-1}
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

      {settingsOpen && <SettingsModal open={settingsOpen} onOpenChange={setSettingsOpen} />}
    </div>
  );
}
