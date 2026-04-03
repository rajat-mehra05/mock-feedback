import { Link } from 'react-router-dom';
import { Home, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function NotFound() {
  return (
    <main
      className="flex flex-col items-center justify-center px-4 py-16 text-center"
      aria-label="404 — Page not found"
    >
      {/* Giant 404 with neo-brutal style */}
      <div className="relative mb-6">
        <h1
          className="text-[10rem] leading-none font-black tracking-tighter text-neo-accent sm:text-[14rem]"
          style={{
            WebkitTextStroke: '4px #000',
            paintOrder: 'stroke fill',
          }}
        >
          404
        </h1>
        <div className="absolute -top-4 -right-4 rotate-12 border-2 border-black bg-neo-secondary px-3 py-1 shadow-neo-sm">
          <span className="text-sm uppercase tracking-wider">Oops!</span>
        </div>
      </div>

      {/* Image / GIF placeholder — replace src with your own asset */}
      {/* <img
        src="/404-illustration.gif"
        alt="Lost interviewer illustration"
        className="mb-8 h-48 w-48 border-4 border-black shadow-neo-md object-cover"
      /> */}

      {/* Interview-themed copy */}
      <div className="mb-8 max-w-lg space-y-4">
        <h2 className="text-2xl font-bold uppercase tracking-wide sm:text-3xl">
          This wasn&apos;t on the syllabus
        </h2>
        <p className="text-lg text-muted-foreground">
          Looks like you wandered into a question we didn&apos;t prepare. Even the best candidates
          take a wrong turn sometimes.
        </p>
      </div>

      {/* Fun interview "scorecard" */}
      <div className="mb-10 border-4 border-black bg-white p-6 shadow-neo-md">
        <div className="mb-3 flex items-center justify-center gap-2">
          <AlertTriangle className="size-5 text-neo-accent" aria-hidden="true" />
          <span className="text-sm uppercase tracking-wider">Interview Feedback</span>
        </div>
        <table className="mx-auto text-left text-sm" aria-label="Humorous 404 scorecard">
          <tbody>
            <tr>
              <td className="pr-4 py-1 uppercase tracking-wide text-muted-foreground">
                Navigation
              </td>
              <td className="py-1 font-black text-neo-accent">0 / 10</td>
            </tr>
            <tr>
              <td className="pr-4 py-1 uppercase tracking-wide text-muted-foreground">
                Confidence
              </td>
              <td className="py-1 font-black text-neo-secondary">10 / 10</td>
            </tr>
            <tr>
              <td className="pr-4 py-1 uppercase tracking-wide text-muted-foreground">
                Route Awareness
              </td>
              <td className="py-1 font-black text-neo-accent">Needs Work</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* CTA */}
      <Link to="/" aria-label="Go back to the home page">
        <Button size="lg" className="gap-2 text-base">
          <Home className="size-5" aria-hidden="true" />
          Back to Home
        </Button>
      </Link>
    </main>
  );
}
