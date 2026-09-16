import { View, Text, type ViewProps } from 'react-native';

import { cn } from '@/lib/utils';

export function Card({ className, ...props }: ViewProps & { className?: string }) {
  return <View className={cn('rounded-xl border border-border bg-card p-4', className)} {...props} />;
}

export function CardTitle({ className, ...props }: ViewProps & { className?: string }) {
  return <Text className={cn('text-base font-semibold text-card-foreground', className)} {...props} />;
}

export function CardContent({ className, ...props }: ViewProps & { className?: string }) {
  return <View className={cn('gap-2', className)} {...props} />;
}
