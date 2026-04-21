import { Mic, Brain, BarChart3, Zap } from 'lucide-react';

export const FEATURES = [
  {
    icon: Mic,
    title: 'Voice-First',
    desc: 'Speak naturally. Auto-detects when you stop talking.',
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
    desc: 'Detailed ratings and actionable feedback per answer.',
    color: 'bg-neo-muted',
  },
  {
    icon: Zap,
    title: 'Zero Setup',
    desc: 'Runs in your browser. Your OpenAI key is used only to call OpenAI.',
    color: 'bg-neo-cream',
  },
] as const;
