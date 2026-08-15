import type { ReactNode } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { TabsContent } from '@/components/ui/tabs';
import { cn } from '@/lib/core/utils';

export function SettingsTab({
  value,
  children,
  surface = 'card',
  className,
}: {
  value: string;
  children: ReactNode;
  surface?: 'card' | 'bare';
  className?: string;
}) {
  return (
    <TabsContent value={value} className={cn('space-y-6', className)}>
      {surface === 'card' ? (
        <Card>
          <CardContent className="space-y-6">{children}</CardContent>
        </Card>
      ) : (
        children
      )}
    </TabsContent>
  );
}
