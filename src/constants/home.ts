import { Mic, Brain, BarChart3, Zap } from 'lucide-react';

export const FEATURES = [
  {
    icon: Mic,
    title: 'Voice-First',
    desc: 'Speak naturally. Auto-detects when you stop.',
    color: 'bg-neo-accent',
  },
  {
    icon: Brain,
    title: 'AI Interviewer',
    desc: 'Staff-level questions that adapt to your answers.',
    color: 'bg-neo-secondary',
  },
  {
    icon: BarChart3,
    title: 'Instant Feedback',
    desc: 'Detailed ratings and actionable tips per question.',
    color: 'bg-neo-muted',
  },
  {
    icon: Zap,
    title: 'Zero Setup',
    desc: 'Runs in your browser. Just bring an OpenAI key.',
    color: 'bg-neo-cream',
  },
] as const;
