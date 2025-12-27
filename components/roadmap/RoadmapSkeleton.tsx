import React from 'react';
import { View } from 'react-native';
import { Skeleton } from '@/components/ui/skeleton';

export function RoadmapSkeleton() {
  return (
    <View className="space-y-4">
      {/* Roadmap Cards Skeleton */}
      {[1, 2, 3].map((i) => (
        <View key={i} className="py-2">
          {/* Card with glow effect */}
          <View 
            className="p-5 rounded-xl border border-border bg-card"
            style={{ 
              shadowColor: '#7c3aed',
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: 0.1,
              shadowRadius: 12,
              elevation: 3,
            }}
          >
            {/* Header section */}
            <View className="mb-4">
              <Skeleton className="h-6 w-3/4 mb-2" />
              <Skeleton className="h-4 w-full" />
            </View>
            
            {/* Progress section */}
            <View className="mb-4">
              <View className="flex-row items-center justify-between mb-2">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-3 w-24" />
              </View>
              <Skeleton className="h-2 w-full rounded-full mb-1" />
              <Skeleton className="h-3 w-20" />
            </View>
            
            {/* Footer section */}
            <View className="flex-row items-center justify-between pt-3 border-t border-border">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-4 w-20" />
            </View>
          </View>
        </View>
      ))}
    </View>
  );
}
