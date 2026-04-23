import { useEffect, useMemo, useState } from 'react';
import { Download } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { getCurrentPlatform, type Platform } from '@/lib/detectPlatform';
import { consumeInstallPrompt, useInstallPrompt } from '@/lib/installPrompt';
import { trackEvent } from '@/lib/analytics';
import { DownloadCta } from './DownloadCta';
import { OsWarning, type TauriOs } from './OsWarning';
import { IosInstallModal } from './IosInstallModal';
import { ByokExplainerModal } from './ByokExplainerModal';

// PWA.4 top-level dispatcher. Decides which install CTA to render based
// on who the user is:
//
//   - Installed PWA / Tauri: nothing (CTA is always misleading inside
//     the installed app). Tauri is also gated at the call site in
//     Home.tsx by VITE_TARGET, but the standalone check here covers
//     the "already installed PWA" case that the build flag can't see.
//   - Mobile iOS: "Install" button opens IosInstallModal with A2HS
//     instructions (iOS has no beforeinstallprompt).
//   - Mobile other: Install button that triggers beforeinstallprompt
//     if captured, or tells the user to use the browser menu.
//   - Desktop Chromium: Tauri download primary, PWA install secondary
//     with a BYOK-tradeoff explainer link.
//   - Desktop Safari / Firefox: Tauri download only. Desktop Safari
//     gets a one-line pointer to File → Add to Dock.
export function InstallSection() {
  const platform = useMemo(() => getCurrentPlatform(), []);
  const { event: installPromptEvent, installed } = useInstallPrompt();

  if (platform.isStandalone || installed) return null;

  if (platform.device === 'mobile') {
    return <MobileInstallCta platform={platform} promptEvent={installPromptEvent} />;
  }

  return <DesktopInstallCta platform={platform} promptEvent={installPromptEvent} />;
}

interface PromptEvent {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface CtaProps {
  platform: Platform;
  promptEvent: PromptEvent | null;
}

function MobileInstallCta({ platform, promptEvent }: CtaProps) {
  const [iosOpen, setIosOpen] = useState(false);
  const surface = platform.os === 'ios' ? 'mobile-ios' : 'mobile-other';

  // Fire "prompt shown" once per mount. A component unmount/remount
  // (route change back to /) counts as a new impression.
  useEffect(() => {
    void trackEvent('pwa_install_prompt_shown', { surface, browser: platform.browser });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAndroidInstall = async () => {
    if (!promptEvent) return;
    try {
      await promptEvent.prompt();
      const { outcome } = await promptEvent.userChoice;
      void trackEvent(
        outcome === 'accepted' ? 'pwa_install_prompt_accepted' : 'pwa_install_prompt_dismissed',
        { surface },
      );
    } catch {
      // prompt() can reject on double-call; swallow silently.
    } finally {
      // Clear the stashed event so the disabled={!promptEvent} state
      // on the button accurately reflects that the prompt has been
      // consumed. Chromium rejects a second .prompt() on the same
      // event, so we shouldn't keep offering to fire it.
      consumeInstallPrompt();
    }
  };

  const handleIosInstall = () => {
    setIosOpen(true);
    void trackEvent('pwa_install_prompt_accepted', { surface });
  };

  return (
    <section className="border-4 border-black bg-white p-8 shadow-neo-lg sm:p-12">
      <p className="text-xs font-black uppercase tracking-widest text-black/50">
        Install on your phone
      </p>
      <h2 className="mt-3 text-xl font-black uppercase leading-tight tracking-tight text-black sm:text-2xl">
        Add VoiceRound to your{' '}
        <span className="relative inline-block whitespace-nowrap">
          <span className="relative z-10">home screen.</span>
          <span
            className="absolute bottom-1 left-0 -z-0 h-3 w-full -rotate-1 bg-neo-accent"
            aria-hidden="true"
          />
        </span>
      </h2>
      <p className="mt-4 text-sm font-medium text-black/70">
        Opens full-screen, works offline for the app shell, stays one tap away.
      </p>

      {platform.os === 'ios' ? (
        <>
          <button
            type="button"
            onClick={handleIosInstall}
            className={`${buttonVariants({ size: 'lg' })} mt-6 h-14 min-w-[240px]`}
          >
            <Download className="h-5 w-5" aria-hidden="true" />
            Install on iOS
          </button>
          <IosInstallModal open={iosOpen} onOpenChange={setIosOpen} />
        </>
      ) : (
        <>
          {/* The beforeinstallprompt event may not have fired yet
              (Chromium uses engagement heuristics; fresh visitors don't
              get one). Render the button disabled with a hint instead
              of an empty CTA so users on a supported browser still
              understand the install path exists. */}
          <button
            type="button"
            onClick={() => void handleAndroidInstall()}
            disabled={!promptEvent}
            className={`${buttonVariants({ size: 'lg' })} mt-6 h-14 min-w-[240px] disabled:cursor-not-allowed disabled:opacity-50`}
          >
            <Download className="h-5 w-5" aria-hidden="true" />
            Install VoiceRound
          </button>
          {platform.browser === 'firefox' ? (
            <p className="mt-3 text-sm font-medium text-black/60">
              Firefox: tap the menu (⋮) and choose <strong>Install</strong>.
            </p>
          ) : (
            <p className="mt-3 text-sm font-medium text-black/60">
              If the button is disabled, browse around for a moment then look for the install option
              in your browser menu.
            </p>
          )}
        </>
      )}
    </section>
  );
}

function DesktopInstallCta({ platform, promptEvent }: CtaProps) {
  const [byokOpen, setByokOpen] = useState(false);
  // Only mac and Windows have Tauri builds. Linux and unknown-OS users
  // get a PWA-primary layout without the misleading .dmg CTA.
  const hasTauriBuild = platform.os === 'mac' || platform.os === 'windows';
  const initialTauriOs: TauriOs = platform.os === 'windows' ? 'windows' : 'mac';
  const [cta, setCta] = useState<TauriOs>(initialTauriOs);

  // Fire a one-time "prompt shown" impression when the desktop PWA
  // secondary CTA is actually visible (i.e. supportsPwaInstall).
  useEffect(() => {
    if (platform.supportsPwaInstall) {
      void trackEvent('pwa_install_prompt_shown', {
        surface: hasTauriBuild ? 'desktop-secondary' : 'desktop-primary',
        browser: platform.browser,
      });
    }
  }, [platform.supportsPwaInstall, platform.browser, hasTauriBuild]);

  const handlePwaInstall = async () => {
    if (!promptEvent) return;
    try {
      await promptEvent.prompt();
      const { outcome } = await promptEvent.userChoice;
      void trackEvent(
        outcome === 'accepted' ? 'pwa_install_prompt_accepted' : 'pwa_install_prompt_dismissed',
        { surface: hasTauriBuild ? 'desktop-secondary' : 'desktop-primary' },
      );
    } catch {
      /* double-prompt rejection is safe to ignore */
    } finally {
      consumeInstallPrompt();
    }
  };

  // Linux / unknown OS: no native Tauri build. PWA is the only install
  // path. Promote it to primary; don't render the misleading .dmg CTA.
  if (!hasTauriBuild) {
    return (
      <section className="border-4 border-black bg-white p-8 shadow-neo-lg sm:p-12">
        <p className="text-xs font-black uppercase tracking-widest text-black/50">
          Install as a web app
        </p>
        <h2 className="mt-3 text-xl font-black uppercase leading-tight tracking-tight text-black sm:text-2xl">
          VoiceRound on{' '}
          <span className="relative inline-block whitespace-nowrap">
            <span className="relative z-10">your desktop.</span>
            <span
              className="absolute bottom-1 left-0 -z-0 h-3 w-full -rotate-1 bg-neo-accent"
              aria-hidden="true"
            />
          </span>
        </h2>
        <p className="mt-4 text-sm font-medium text-black/70">
          No native build for Linux. The web app installs from your browser and runs in a standalone
          window.
        </p>

        {platform.supportsPwaInstall ? (
          <>
            <button
              type="button"
              onClick={() => void handlePwaInstall()}
              disabled={!promptEvent}
              className="mt-6 cursor-pointer border-2 border-black bg-neo-accent px-6 py-3 text-sm font-bold uppercase tracking-wide text-black shadow-neo transition-all hover:-translate-y-0.5 hover:shadow-neo-md disabled:cursor-not-allowed disabled:opacity-60"
            >
              Install in browser
            </button>
            <p className="mt-3 text-xs font-medium text-black/60">
              Web app stores your API key in the browser instead of your OS keychain.{' '}
              <button
                type="button"
                onClick={() => setByokOpen(true)}
                className="cursor-pointer underline hover:text-black"
              >
                Why the difference?
              </button>
            </p>
          </>
        ) : (
          <p className="mt-6 text-sm font-medium text-black/70">
            Your browser doesn&apos;t expose a programmatic install. Use the browser&apos;s menu
            (Chrome / Edge: &quot;Install VoiceRound&quot;; Firefox Android: three-dot menu).
          </p>
        )}
        <ByokExplainerModal open={byokOpen} onOpenChange={setByokOpen} />
      </section>
    );
  }

  return (
    <section className="border-4 border-black bg-white p-8 shadow-neo-lg sm:p-12">
      <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:gap-12">
        <DownloadCta platform={cta} onSwitch={setCta} />
        <OsWarning platform={cta} />
      </div>

      {/* PWA secondary, Chromium desktop only (supportsPwaInstall is true). */}
      {platform.supportsPwaInstall ? (
        <div className="mt-6 border-t-2 border-black/20 pt-6">
          <p className="text-sm font-bold text-black">
            Or install as a lightweight web app —{' '}
            <button
              type="button"
              onClick={() => void handlePwaInstall()}
              disabled={!promptEvent}
              className="underline hover:bg-neo-secondary disabled:cursor-not-allowed disabled:no-underline disabled:opacity-60"
            >
              Install in browser
            </button>
            {!promptEvent ? (
              <span className="ml-1 text-xs font-medium text-black/50">
                (browse around for a moment to unlock)
              </span>
            ) : null}
          </p>
          <p className="mt-2 text-xs font-medium text-black/60">
            Web app stores your API key in the browser instead of your OS keychain.{' '}
            <button
              type="button"
              onClick={() => setByokOpen(true)}
              className="cursor-pointer underline hover:text-black"
            >
              Why the difference?
            </button>
          </p>
          <ByokExplainerModal open={byokOpen} onOpenChange={setByokOpen} />
        </div>
      ) : null}

      {/* Desktop Safari note (Sonoma+ users have File → Add to Dock but
          no programmatic prompt. Firefox desktop has nothing so no note. */}
      {!platform.supportsPwaInstall && platform.browser === 'safari' ? (
        <p className="mt-6 border-t-2 border-black/20 pt-6 text-sm font-medium text-black/70">
          Or use <strong>File → Add to Dock</strong> in Safari to install as a web app. No
          programmatic prompt in Safari.
        </p>
      ) : null}
    </section>
  );
}
