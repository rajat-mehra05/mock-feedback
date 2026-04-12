'use client';

import { Button as ButtonPrimitive } from '@base-ui/react/button';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

const buttonVariants = cva(
  "group/button inline-flex shrink-0 cursor-pointer items-center justify-center border-2 border-black bg-clip-padding text-sm font-bold uppercase tracking-wide whitespace-nowrap transition-all duration-100 outline-none select-none shadow-neo-sm neo-push focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: 'bg-neo-accent text-black hover:brightness-110',
        outline: 'bg-white text-black hover:bg-neo-secondary',
        secondary: 'bg-neo-secondary text-black hover:brightness-110',
        ghost:
          'border-transparent shadow-none hover:border-black hover:bg-neo-secondary hover:shadow-neo-sm',
        destructive: 'bg-red-200 text-red-900 hover:brightness-90',
        link: 'border-transparent text-black underline-offset-4 shadow-none hover:underline',
      },
      size: {
        default: 'h-11 gap-2 px-4',
        xs: 'h-7 gap-1 px-2 text-xs',
        sm: 'h-8 gap-1.5 px-3 text-xs',
        lg: 'h-12 gap-2 px-6 text-base',
        icon: 'size-11',
        'icon-xs': 'size-7',
        'icon-sm': 'size-8',
        'icon-lg': 'size-12',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

function Button({
  className,
  variant = 'default',
  size = 'default',
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
