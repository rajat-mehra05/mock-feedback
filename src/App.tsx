import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { lazy, Suspense, useEffect } from 'react';
import { Analytics } from '@vercel/analytics/react';
import { Agentation } from 'agentation';
import { ApiKeyProvider } from '@/hooks/ApiKeyContext/ApiKeyContext';
import { Layout } from '@/components/Layout/Layout';
import { ErrorBoundary, SessionErrorFallback } from '@/components/ErrorBoundary/ErrorBoundary';
import { Spinner } from '@/components/ui/spinner';

const Home = lazy(() => import('@/pages/Home/Home').then((m) => ({ default: m.Home })));
const Session = lazy(() => import('@/pages/Session/Session').then((m) => ({ default: m.Session })));
const History = lazy(() => import('@/pages/History/History').then((m) => ({ default: m.History })));
const Feedback = lazy(() =>
  import('@/pages/Feedback/Feedback').then((m) => ({ default: m.Feedback })),
);
const NotFound = lazy(() =>
  import('@/pages/NotFound/NotFound').then((m) => ({ default: m.NotFound })),
);

function PageLoader() {
  return <Spinner centered message="Loading..." />;
}

function AppRoutes() {
  const { pathname } = useLocation();

  // Fix @base-ui Select rendering aria-hidden inputs with tabindex="-1"
  // which triggers axe "aria-hidden-focus" violation
  useEffect(() => {
    let frameId: number;
    const observer = new MutationObserver(() => {
      cancelAnimationFrame(frameId);
      frameId = requestAnimationFrame(() => {
        document
          .querySelectorAll<HTMLInputElement>('input[aria-hidden="true"][tabindex="-1"]')
          .forEach((el) => el.removeAttribute('tabindex'));
      });
    });
    observer.observe(document.getElementById('root')!, { childList: true, subtree: true });
    return () => {
      cancelAnimationFrame(frameId);
      observer.disconnect();
    };
  }, []);

  return (
    <Layout>
      <Suspense key={pathname} fallback={<PageLoader />}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route
            path="/session"
            element={
              <ErrorBoundary fallback={<SessionErrorFallback />}>
                <Session />
              </ErrorBoundary>
            }
          />
          <Route path="/history" element={<History />} />
          <Route path="/history/:id" element={<Feedback />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </Layout>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <ApiKeyProvider>
          <AppRoutes />
        </ApiKeyProvider>
      </BrowserRouter>
      <Analytics />
      {import.meta.env.DEV && <Agentation />}
    </ErrorBoundary>
  );
}
