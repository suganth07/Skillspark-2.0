import React from 'react';
import { View } from 'react-native';
import { Skeleton } from '@/components/ui/skeleton';
import { Card } from '@/components/ui/card';

export function ProgressTimelineSkeleton() {
  return (
    <Card className="overflow-hidden">
      {/* Header */}
      <View className="p-4 border-b border-border">
        <View className="flex-row items-center justify-between">
          <View className="space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-24" />
          </View>
          <Skeleton className="h-7 w-16 rounded-full" />
        </View>
      </View>

      {/* Timeline */}
      <View className="px-4 py-5">
        <View className="flex-row items-center gap-3">
          {[1, 2, 3, 4].map((i) => (
            <React.Fragment key={i}>
              <View className="items-center" style={{ width: 80 }}>
                <Skeleton className="h-14 w-14 rounded-full mb-2" />
                <Skeleton className="h-3 w-16 mb-1" />
                <Skeleton className="h-2 w-12" />
              </View>
              {i < 4 && <Skeleton className="h-0.5 w-8" />}
            </React.Fragment>
          ))}
        </View>
      </View>

      {/* Footer */}
      <View className="px-4 py-3 bg-secondary/30 flex-row items-center justify-around border-t border-border">
        {[1, 2, 3].map((i) => (
          <React.Fragment key={i}>
            <View className="items-center space-y-1">
              <Skeleton className="h-3 w-12" />
              <Skeleton className="h-5 w-6" />
            </View>
            {i < 3 && <View className="h-8 w-px bg-border" />}
          </React.Fragment>
        ))}
      </View>
    </Card>
  );
}
