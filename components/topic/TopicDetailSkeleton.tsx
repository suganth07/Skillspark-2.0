import React from 'react';
import { View } from 'react-native';
import { Skeleton } from '@/components/ui/skeleton';

export function TopicDetailSkeleton() {
  return (
    <View className="p-6 space-y-6">
      {/* Header Skeleton */}
      <View className="mb-6">
        <View className="flex-row items-start justify-between mb-3">
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-6 w-20 rounded-full" />
        </View>
        <Skeleton className="h-4 w-full mb-2" />
        <Skeleton className="h-4 w-5/6" />
      </View>

      {/* Web Search Button Skeleton */}
      <View className="flex-row items-center justify-between mb-4">
        <View className="flex-1 mr-3">
          <Skeleton className="h-4 w-32 mb-1" />
          <Skeleton className="h-3 w-48" />
        </View>
        <Skeleton className="h-9 w-24 rounded-lg" />
      </View>

      {/* Key Concepts Skeleton */}
      <View className="mb-4">
        <View className="flex-row items-center gap-2 mb-3">
          <Skeleton className="h-5 w-5 rounded" />
          <Skeleton className="h-6 w-32" />
        </View>
      </View>

      {/* Subtopics Skeleton */}
      <View className="space-y-3">
        {[1, 2, 3].map((i) => (
          <View 
            key={i}
            className="rounded-xl overflow-hidden bg-card dark:bg-card/50 border border-border p-4"
          >
            <View className="flex-row items-center gap-3">
              <Skeleton className="w-8 h-8 rounded-full" />
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-5 w-5 rounded" />
            </View>
          </View>
        ))}
      </View>

      {/* Best Practices Skeleton */}
      <View className="mt-6">
        <View className="flex-row items-center justify-between py-3 mb-2">
          <View className="flex-row items-center gap-2">
            <Skeleton className="h-5 w-5 rounded" />
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-4 w-8 rounded-full" />
          </View>
          <Skeleton className="h-5 w-5 rounded" />
        </View>
      </View>

      {/* Common Pitfalls Skeleton */}
      <View className="mt-4">
        <View className="flex-row items-center justify-between py-3">
          <View className="flex-row items-center gap-2">
            <Skeleton className="h-5 w-5 rounded" />
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-4 w-8 rounded-full" />
          </View>
          <Skeleton className="h-5 w-5 rounded" />
        </View>
      </View>
    </View>
  );
}
