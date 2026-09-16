import { Pressable, Text, type PressableProps } from 'react-native';
import { tv } from 'tailwind-variants';

import { cn } from '@/lib/utils';

const button = tv({
  slots: {
    root: 'flex-row items-center justify-center gap-2 rounded-lg',
    label: 'text-center font-medium',
  },
  variants: {
    variant: {
      primary: { root: 'bg-primary', label: 'text-primary-foreground' },
      secondary: { root: 'bg-muted', label: 'text-foreground' },
      destructive: { root: 'bg-destructive', label: 'text-background' },
    },
    size: {
      sm: { root: 'min-h-9 px-3 py-2', label: 'text-sm' },
      md: { root: 'min-h-11 px-4 py-2.5', label: 'text-base' },
      lg: { root: 'min-h-12 px-6 py-3', label: 'text-lg' },
    },
    fullWidth: {
      true: { root: 'w-full' },
    },
  },
  defaultVariants: { variant: 'primary', size: 'md' },
});

export type ButtonProps = PressableProps & {
  variant?: 'primary' | 'secondary' | 'destructive';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  className?: string;
  children?: string;
};

export function Button({ variant, size, fullWidth, className, children, ...props }: ButtonProps) {
  const styles = button({ variant, size, fullWidth });
  return (
    <Pressable accessibilityRole="button" className={cn(styles.root(), className)} {...props}>
      <Text className={styles.label()}>{children}</Text>
    </Pressable>
  );
}
