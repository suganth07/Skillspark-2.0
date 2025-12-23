import React from 'react';
import { View } from 'react-native';
import { Skeleton } from '@/components/ui/skeleton';

export function RoadmapSkeleton() {
  return (
    <View className="px-6 space-y-5">
      {/* Header Skeleton */}
      <View className="space-y-3 pt-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-full" />
      </View>

      {/* Stats Cards Skeleton */}
      <View className="flex-row space-x-3">
        <View className="flex-1">
          <Skeleton className="h-20 w-full rounded-xl" />
        </View>
        <View className="flex-1">
          <Skeleton className="h-20 w-full rounded-xl" />
        </View>
        <View className="flex-1">
          <Skeleton className="h-20 w-full rounded-xl" />
        </View>
      </View>

      {/* Create Button Skeleton */}
      <Skeleton className="h-14 w-full rounded-xl" />

      {/* Roadmap Cards Skeleton */}
      <View className="space-y-4 pb-4">
        <Skeleton className="h-6 w-32" />
        
        {[1, 2, 3].map((i) => (
          <View key={i} className="space-y-3 p-5 rounded-xl border border-border bg-card">
            <View className="flex-row items-start justify-between">
              <View className="flex-1 space-y-2">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-full" />
              </View>
              <Skeleton className="h-6 w-20 rounded-full ml-3" />
            </View>
            
            <View className="space-y-2">
              <View className="flex-row items-center justify-between">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-3 w-24" />
              </View>
              <Skeleton className="h-2 w-full rounded-full" />
            </View>
            
            <View className="flex-row items-center justify-between">
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-10 w-28 rounded-lg" />
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}
