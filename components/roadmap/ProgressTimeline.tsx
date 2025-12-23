import React, { useMemo } from 'react';
import { View, ScrollView } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Text } from '@/components/ui/text';
import { Card } from '@/components/ui/card';
import { CheckCircle, Circle, TrendingUp } from 'lucide-react-native';
import { cn } from '@/lib/utils';
import type { RoadmapWithProgress } from '@/server/queries/roadmaps';

interface ProgressTimelineProps {
  roadmaps: RoadmapWithProgress[];
}

export function ProgressTimeline({ roadmaps }: ProgressTimelineProps) {
  const stats = useMemo(() => {
    const total = roadmaps.length;
    const active = roadmaps.filter(r => r.status === 'active').length;
    const completed = roadmaps.filter(r => r.status === 'completed').length;
    const avgProgress = total > 0 
      ? Math.round(roadmaps.reduce((acc, r) => acc + r.progress, 0) / total)
      : 0;
    
    return { total, active, completed, avgProgress };
  }, [roadmaps]);

  // Sort roadmaps by progress for timeline display
  const sortedRoadmaps = useMemo(() => {
    return [...roadmaps]
      .sort((a, b) => {
        // Completed first, then by progress
        if (a.status === 'completed' && b.status !== 'completed') return -1;
        if (a.status !== 'completed' && b.status === 'completed') return 1;
        return b.progress - a.progress;
      })
      .slice(0, 5); // Show only top 5 for clean display
  }, [roadmaps]);

  return (
    <Animated.View entering={FadeIn.duration(400)}>
      <Card className="overflow-hidden">
        {/* Header Stats */}
        <View className="p-4 border-b border-border">
          <View className="flex-row items-center justify-between">
            <View>
              <Text className="text-sm font-medium text-foreground">Learning Progress</Text>
              <Text className="text-xs text-muted-foreground mt-0.5">
                {stats.completed} of {stats.total} completed
              </Text>
            </View>
            <View className="flex-row items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10">
              <TrendingUp className="h-4 w-4 text-primary" />
              <Text className="text-sm font-bold text-primary">{stats.avgProgress}%</Text>
            </View>
          </View>
        </View>

        {/* Timeline */}
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 20 }}
        >
          <View className="flex-row items-center gap-3">
            {sortedRoadmaps.map((roadmap, index) => {
              const isCompleted = roadmap.status === 'completed';
              const isActive = roadmap.status === 'active';
              const progress = roadmap.progress;
              
              return (
                <React.Fragment key={roadmap.id}>
                  {/* Timeline Node */}
                  <View className="items-center" style={{ width: 80 }}>
                    {/* Circle with progress ring */}
                    <View className="relative items-center justify-center mb-2">
                      {/* Background circle */}
                      <View className={cn(
                        "h-14 w-14 rounded-full items-center justify-center border-2",
                        isCompleted 
                          ? "bg-green-50 dark:bg-green-950 border-green-500"
                          : isActive
                          ? "bg-blue-50 dark:bg-blue-950 border-blue-500"
                          : "bg-secondary border-border"
                      )}>
                        {isCompleted ? (
                          <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
                        ) : (
                          <Circle className={cn(
                            "h-6 w-6",
                            isActive ? "text-blue-600 dark:text-blue-400" : "text-muted-foreground"
                          )} />
                        )}
                      </View>
                      
                      {/* Progress indicator */}
                      {!isCompleted && progress > 0 && (
                        <View 
                          className="absolute bottom-0 left-1/2 -translate-x-1/2"
                          style={{ transform: [{ translateX: -10 }] }}
                        >
                          <View className="px-1.5 py-0.5 bg-primary rounded">
                            <Text className="text-[10px] font-bold text-primary-foreground">
                              {progress}%
                            </Text>
                          </View>
                        </View>
                      )}
                    </View>
                    
                    {/* Roadmap Title */}
                    <Text 
                      className="text-xs text-center text-foreground font-medium leading-tight"
                      numberOfLines={2}
                    >
                      {roadmap.title}
                    </Text>
                    
                    {/* Module count */}
                    <Text className="text-[10px] text-muted-foreground text-center mt-1">
                      {roadmap.completedSteps}/{roadmap.stepsCount}
                    </Text>
                  </View>

                  {/* Connecting Line */}
                  {index < sortedRoadmaps.length - 1 && (
                    <View className={cn(
                      "h-0.5 w-8",
                      isCompleted ? "bg-green-500" : "bg-border"
                    )} />
                  )}
                </React.Fragment>
              );
            })}
          </View>
        </ScrollView>

        {/* Footer with additional stats */}
        <View className="px-4 py-3 bg-secondary/30 flex-row items-center justify-around border-t border-border">
          <View className="items-center">
            <Text className="text-xs text-muted-foreground">Active</Text>
            <Text className="text-base font-bold text-blue-600 dark:text-blue-400">
              {stats.active}
            </Text>
          </View>
          <View className="h-8 w-px bg-border" />
          <View className="items-center">
            <Text className="text-xs text-muted-foreground">Completed</Text>
            <Text className="text-base font-bold text-green-600 dark:text-green-400">
              {stats.completed}
            </Text>
          </View>
          <View className="h-8 w-px bg-border" />
          <View className="items-center">
            <Text className="text-xs text-muted-foreground">Total</Text>
            <Text className="text-base font-bold text-foreground">
              {stats.total}
            </Text>
          </View>
        </View>
      </Card>
    </Animated.View>
  );
}
