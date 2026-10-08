import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { ComponentProps } from 'react';
import { useSyncExternalStore } from 'react';
const subscribe = () => () => {};
export function useHydrated() {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
const buttonVariants = cva('button', {
  variants: { variant: { default: 'button-primary', outline: 'button-outline' } },
  defaultVariants: { variant: 'default' },
});
export function Button({
  className,
  variant,
  asChild = false,
  ...props
}: ComponentProps<'button'> & VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Component = asChild ? Slot : 'button';
  return <Component className={cn(buttonVariants({ variant }), className)} {...props} />;
}
export {
  ArrowUpRight,
  ArrowRight,
  MapPin,
  Menu,
  X,
  Check,
  Plus,
  Minus,
  Flower2,
  LogOut,
} from 'lucide-react';
