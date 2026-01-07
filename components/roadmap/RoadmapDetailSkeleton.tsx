import React from 'react';
import { View } from 'react-native';
import { Skeleton } from '@/components/ui/skeleton';

export function RoadmapDetailSkeleton() {
  return (
    <View className="flex-1 bg-background px-6 pt-6">
      {/* Header Skeleton */}
      <View className="mb-6">
        <Skeleton className="h-8 w-3/4 mb-2" />
        <Skeleton className="h-4 w-full mb-1" />
        <Skeleton className="h-4 w-5/6" />
      </View>

      {/* Progress Card Skeleton */}
      <View className="p-4 rounded-xl border border-border bg-card mb-6">
        <View className="flex-row items-center justify-between mb-3">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-5 w-16" />
        </View>
        <Skeleton className="h-3 w-full rounded-full mb-2" />
        <Skeleton className="h-4 w-32" />
      </View>

      {/* Action Buttons Skeleton */}
      <View className="flex-row gap-3 mb-6">
        <Skeleton className="h-12 flex-1 rounded-xl" />
        <Skeleton className="h-12 flex-1 rounded-xl" />
      </View>

      {/* Steps Skeleton */}
      {[1, 2, 3].map((i) => (
        <View key={i} className="mb-4">
          <View className="p-4 rounded-xl border border-border bg-card">
            <View className="flex-row items-start gap-3">
              <Skeleton className="h-6 w-6 rounded-full" />
              <View className="flex-1">
                <Skeleton className="h-5 w-3/4 mb-2" />
                <Skeleton className="h-4 w-full mb-1" />
                <Skeleton className="h-4 w-5/6" />
              </View>
            </View>
          </View>
        </View>
      ))}
    </View>
  );
}
