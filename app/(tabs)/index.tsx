import { View, ScrollView, ActivityIndicator, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useRouter } from "expo-router";
import * as React from "react";
import { Text } from "@/components/ui/text";
import { Card } from "@/components/ui/card";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { BookOpen, TrendingUp, Zap, ChevronRight, Clock, Award, Target } from "lucide-react-native";
import { useCurrentUserId } from "@/hooks/stores/useUserStore";
import { useUserRoadmaps } from "@/hooks/queries/useRoadmapQueries";
import type { RoadmapWithProgress } from "@/server/queries/roadmaps";

export default function Home() {
  const router = useRouter();
  const currentUserId = useCurrentUserId();
  const { data: roadmaps, isLoading } = useUserRoadmaps(currentUserId || undefined);

  const totalRoadmaps = roadmaps?.length || 0;
  const completedRoadmaps = roadmaps?.filter((r: RoadmapWithProgress) => r.status === 'completed')?.length || 0;
  
  const totalProgress = roadmaps?.reduce((sum: number, r: RoadmapWithProgress) => {
    return sum + (r.completedSteps || 0);
  }, 0) || 0;

  const totalSteps = roadmaps?.reduce((sum: number, r: RoadmapWithProgress) => sum + (r.stepsCount || 0), 0) || 0;
  const overallCompletionRate = totalSteps > 0 ? Math.round((totalProgress / totalSteps) * 100) : 0;

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      <Stack.Screen options={{ title: "Home", headerShown: false }} />

      <ScrollView showsVerticalScrollIndicator={false} className="flex-1">
        {/* Header */}
        <Animated.View entering={FadeIn.duration(400)} className="px-6 pt-6 pb-4">
          <Text className="text-3xl font-bold text-foreground mb-1">Welcome Back!</Text>
          <Text className="text-sm text-muted-foreground">
            Continue your learning journey
          </Text>
        </Animated.View>

        {/* Quick Stats Banner */}
        {totalRoadmaps > 0 && (
          <Animated.View entering={FadeInDown.delay(50)} className="px-6 pb-4">
            <Card className="overflow-hidden bg-gradient-to-r">
              <View className="p-4 flex-row items-center justify-between">
                <View className="flex-1">
                  <Text className="text-lg font-bold text-foreground mb-1">
                    {overallCompletionRate}% Complete
                  </Text>
                  <Text className="text-xs text-muted-foreground">
                    Keep up the great work!
                  </Text>
                </View>
                <View className="h-16 w-16 rounded-full bg-primary/20 items-center justify-center">
                  <Target size={32} className="text-primary" />
                </View>
              </View>
            </Card>
          </Animated.View>
        )}

        {/* Learning Progress Section */}
        <Animated.View entering={FadeInDown.duration(400)} className="px-6 pb-6">
          <Text className="text-base font-semibold text-foreground mb-4">
            Your Learning Progress
          </Text>

          <View className="flex-row gap-3">
            {/* Roadmaps Card */}
            <Animated.View entering={FadeInDown.delay(100)} className="flex-1">
              <Card className="overflow-hidden">
                <View className="p-4 items-center">
                  <View className="h-12 w-12 rounded-lg bg-blue-100 dark:bg-blue-950 items-center justify-center mb-2">
                    <BookOpen size={24} className="text-blue-600 dark:text-blue-400" />
                  </View>
                  <Text className="text-2xl font-bold text-foreground">
                    {totalRoadmaps}
                  </Text>
                  <Text className="text-xs font-medium text-muted-foreground text-center">
                    Roadmaps
                  </Text>
                  <Text className="text-xs text-muted-foreground text-center mt-1">
                    Learning paths
                  </Text>
                </View>
              </Card>
            </Animated.View>

            {/* Progress Card */}
            <Animated.View entering={FadeInDown.delay(200)} className="flex-1">
              <Card className="overflow-hidden">
                <View className="p-4 items-center">
                  <View className="h-12 w-12 rounded-lg bg-green-100 dark:bg-green-950 items-center justify-center mb-2">
                    <TrendingUp size={24} className="text-green-600 dark:text-green-400" />
                  </View>
                  <Text className="text-2xl font-bold text-foreground">
                    {totalProgress}/{totalSteps}
                  </Text>
                  <Text className="text-xs font-medium text-muted-foreground text-center">
                    Progress
                  </Text>
                  <Text className="text-xs text-muted-foreground text-center mt-1">
                    Steps completed
                  </Text>
                </View>
              </Card>
            </Animated.View>

            {/* Achievements Card */}
            <Animated.View entering={FadeInDown.delay(300)} className="flex-1">
              <Card className="overflow-hidden">
                <View className="p-4 items-center">
                  <View className="h-12 w-12 rounded-lg bg-purple-100 dark:bg-purple-950 items-center justify-center mb-2">
                    <Zap size={24} className="text-purple-600 dark:text-purple-400" />
                  </View>
                  <Text className="text-2xl font-bold text-foreground">
                    {completedRoadmaps}
                  </Text>
                  <Text className="text-xs font-medium text-muted-foreground text-center">
                    Completed
                  </Text>
                  <Text className="text-xs text-muted-foreground text-center mt-1">
                    Roadmaps done
                  </Text>
                </View>
              </Card>
            </Animated.View>
          </View>
        </Animated.View>

        {/* Roadmaps Section */}
        <Animated.View entering={FadeInDown.delay(400)} className="px-6 pb-8">
          <View className="flex-row items-center justify-between mb-4">
            <Text className="text-base font-semibold text-foreground">
              Your Roadmaps
            </Text>
            {totalRoadmaps > 0 && (
              <Pressable
                onPress={() => router.push("/(tabs)/roadmap")}
                className="flex-row items-center gap-1 active:opacity-70"
              >
                <Text className="text-sm text-primary font-medium">View All</Text>
                <ChevronRight size={16} className="text-primary" />
              </Pressable>
            )}
          </View>

          {isLoading ? (
            <View className="items-center py-8">
              <ActivityIndicator size="large" />
              <Text className="text-sm text-muted-foreground mt-4">
                Loading roadmaps...
              </Text>
            </View>
          ) : totalRoadmaps === 0 ? (
            <Card className="overflow-hidden">
              <View className="p-6 items-center">
                <View className="h-16 w-16 rounded-full bg-secondary items-center justify-center mb-4">
                  <BookOpen size={32} className="text-muted-foreground" />
                </View>
                <Text className="text-base font-semibold text-foreground mb-2 text-center">
                  No Roadmaps Yet
                </Text>
                <Text className="text-sm text-muted-foreground text-center mb-4">
                  Create your first learning path to get started
                </Text>
                <Pressable
                  onPress={() => router.push("/(tabs)/roadmap")}
                  className="px-6 py-2 bg-primary rounded-lg active:opacity-90"
                >
                  <Text className="text-sm font-semibold text-primary-foreground">
                    Create Roadmap
                  </Text>
                </Pressable>
              </View>
            </Card>
          ) : (
            <View className="gap-3">
              {roadmaps?.slice(0, 5).map((roadmap: RoadmapWithProgress, index: number) => {
                const totalSteps = roadmap.stepsCount || 0;
                const completedSteps = roadmap.completedSteps || 0;
                const progressPercent = totalSteps > 0 ? (completedSteps / totalSteps) * 100 : 0;
                const isComplete = roadmap.status === 'completed';

                return (
                  <Animated.View
                    key={roadmap.id}
                    entering={FadeInDown.delay(500 + index * 50)}
                  >
                    <Pressable
                      onPress={() =>
                        router.push({
                          pathname: "/roadmap/[id]",
                          params: { id: roadmap.id },
                        })
                      }
                      className="active:opacity-70"
                    >
                      <Card className="overflow-hidden">
                        <View className="p-4">
                          <View className="flex-row items-start justify-between mb-3">
                            <View className="flex-1">
                              <View className="flex-row items-center gap-2 mb-1">
                                <Text className="text-base font-semibold text-foreground">
                                  {roadmap.title}
                                </Text>
                                {isComplete && (
                                  <View className="bg-green-100 dark:bg-green-950 px-2 py-0.5 rounded-full">
                                    <Text className="text-xs font-semibold text-green-700 dark:text-green-400">
                                      ✓ Done
                                    </Text>
                                  </View>
                                )}
                              </View>
                              <Text className="text-xs text-muted-foreground mt-1" numberOfLines={2}>
                                {roadmap.description || "Learning path"}
                              </Text>
                            </View>
                            <View className={`h-10 w-10 rounded-lg ${isComplete ? 'bg-green-100 dark:bg-green-950' : 'bg-blue-100 dark:bg-blue-950'} items-center justify-center ml-2`}>
                              {isComplete ? (
                                <Award size={20} className="text-green-600 dark:text-green-400" />
                              ) : (
                                <BookOpen size={20} className="text-blue-600 dark:text-blue-400" />
                              )}
                            </View>
                          </View>

                          {/* Progress Bar */}
                          <View className="bg-secondary rounded-full h-2 mb-2 overflow-hidden">
                            <View
                              className="bg-primary rounded-full h-full"
                              style={{
                                width: `${Math.min(progressPercent, 100)}%`,
                              }}
                            />
                          </View>

                          <View className="flex-row items-center justify-between">
                            <View className="flex-row items-center gap-4">
                              <View className="flex-row items-center gap-1">
                                <BookOpen size={12} className="text-muted-foreground" />
                                <Text className="text-xs text-muted-foreground">
                                  {completedSteps}/{totalSteps} steps
                                </Text>
                              </View>
                            </View>
                            <Text className="text-xs font-semibold text-primary">
                              {Math.round(progressPercent)}%
                            </Text>
                          </View>
                        </View>
                      </Card>
                    </Pressable>
                  </Animated.View>
                );
              })}

              {totalRoadmaps > 5 && (
                <Pressable
                  onPress={() => router.push("/(tabs)/roadmap")}
                  className="py-4 items-center active:opacity-70"
                >
                  <Text className="text-sm font-semibold text-primary">
                    View {totalRoadmaps - 5} more roadmaps
                  </Text>
                </Pressable>
              )}
            </View>
          )}
        </Animated.View>

        {/* Quick Stats Footer */}
        {totalRoadmaps > 0 && (
          <Animated.View entering={FadeInDown.delay(600)} className="px-6 pb-8">
            <Card className="overflow-hidden">
              <View className="p-4">
                <Text className="text-sm font-semibold text-foreground mb-3">
                  Learning Insights
                </Text>
                <View className="space-y-3">
                  <View className="flex-row items-center justify-between p-3 bg-secondary/50 rounded-lg">
                    <View className="flex-row items-center gap-2">
                      <View className="h-8 w-8 rounded-full bg-primary/20 items-center justify-center">
                        <Target size={16} className="text-primary" />
                      </View>
                      <Text className="text-sm text-foreground font-medium">
                        Completion Rate
                      </Text>
                    </View>
                    <Text className="text-base font-bold text-primary">
                      {overallCompletionRate}%
                    </Text>
                  </View>
                  <View className="flex-row items-center justify-between p-3 bg-secondary/50 rounded-lg">
                    <View className="flex-row items-center gap-2">
                      <View className="h-8 w-8 rounded-full bg-orange-100 dark:bg-orange-950 items-center justify-center">
                        <Clock size={16} className="text-orange-600 dark:text-orange-400" />
                      </View>
                      <Text className="text-sm text-foreground font-medium">
                        In Progress
                      </Text>
                    </View>
                    <Text className="text-base font-bold text-foreground">
                      {totalRoadmaps - completedRoadmaps}
                    </Text>
                  </View>
                  <View className="flex-row items-center justify-between p-3 bg-secondary/50 rounded-lg">
                    <View className="flex-row items-center gap-2">
                      <View className="h-8 w-8 rounded-full bg-green-100 dark:bg-green-950 items-center justify-center">
                        <Award size={16} className="text-green-600 dark:text-green-400" />
                      </View>
                      <Text className="text-sm text-foreground font-medium">
                        Achievements
                      </Text>
                    </View>
                    <Text className="text-base font-bold text-foreground">
                      {completedRoadmaps}
                    </Text>
                  </View>
                </View>
              </View>
            </Card>
          </Animated.View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
