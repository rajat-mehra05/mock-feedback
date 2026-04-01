import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { lazy, Suspense, useEffect } from 'react';
import { Agentation } from 'agentation';
import { ApiKeyProvider } from '@/hooks/ApiKeyContext/ApiKeyContext';
import { Layout } from '@/components/Layout/Layout';
import { ApiKeyGate } from '@/components/ApiKeyGate/ApiKeyGate';
import { ErrorBoundary, SessionErrorFallback } from '@/components/ErrorBoundary/ErrorBoundary';
import { seedMockData } from '@/db/seed/seed';

const Home = lazy(() => import('@/pages/Home/Home').then((m) => ({ default: m.Home })));
const Session = lazy(() => import('@/pages/Session/Session').then((m) => ({ default: m.Session })));
const History = lazy(() => import('@/pages/History/History').then((m) => ({ default: m.History })));
const Feedback = lazy(() =>
  import('@/pages/Feedback/Feedback').then((m) => ({ default: m.Feedback })),
);

function PageLoader() {
  return <p className="py-12 text-center text-muted-foreground">Loading...</p>;
}

export default function App() {
  useEffect(() => {
    seedMockData();
  }, []);

  return (
    <ErrorBoundary>
      <BrowserRouter>
        <ApiKeyProvider>
          <ApiKeyGate>
            <Layout>
              <Suspense fallback={<PageLoader />}>
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
                </Routes>
              </Suspense>
            </Layout>
          </ApiKeyGate>
        </ApiKeyProvider>
      </BrowserRouter>
      {import.meta.env.DEV && <Agentation />}
    </ErrorBoundary>
  );
}
