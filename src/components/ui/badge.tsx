import { mergeProps } from '@base-ui/react/merge-props';
import { useRender } from '@base-ui/react/use-render';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'group/badge inline-flex h-6 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-full border-2 border-black px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider whitespace-nowrap transition-all focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 [&>svg]:pointer-events-none [&>svg]:size-3!',
  {
    variants: {
      variant: {
        default: 'bg-neo-accent text-black shadow-[2px_2px_0px_0px_#000]',
        secondary: 'bg-neo-secondary text-black shadow-[2px_2px_0px_0px_#000]',
        destructive: 'bg-neo-accent text-black shadow-[2px_2px_0px_0px_#000]',
        outline: 'border-black bg-white text-black',
        ghost: 'border-transparent bg-neo-muted/40 text-black',
        link: 'text-black underline-offset-4 hover:underline',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

function Badge({
  className,
  variant = 'default',
  render,
  ...props
}: useRender.ComponentProps<'span'> & VariantProps<typeof badgeVariants>) {
  return useRender({
    defaultTagName: 'span',
    props: mergeProps<'span'>(
      {
        className: cn(badgeVariants({ variant }), className),
      },
      props,
    ),
    render,
    state: {
      slot: 'badge',
      variant,
    },
  });
}

export { Badge, badgeVariants };
