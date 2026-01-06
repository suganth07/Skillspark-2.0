import { View, ScrollView, Pressable, Dimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useRouter } from "expo-router";
import * as React from "react";
import { LinearGradient } from "expo-linear-gradient";
import { Text } from "@/components/ui/text";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { 
  BookOpen, 
  ChevronRight, 
  Brain, 
  Award,
  GraduationCap,
  Rocket,
} from "lucide-react-native";
import { useCurrentUserId } from "@/hooks/stores/useUserStore";
import { useCurrentUser } from "@/hooks/queries/useUserQueries";
import { useUserRoadmaps } from "@/hooks/queries/useRoadmapQueries";
import type { RoadmapWithProgress } from "@/server/queries/roadmaps";

const { width } = Dimensions.get('window');

export default function Home() {
  const router = useRouter();
  const currentUserId = useCurrentUserId();
  const { data: currentUser, isLoading: isLoadingUser } = useCurrentUser(currentUserId || undefined);
  const { data: roadmaps, isLoading: isLoadingRoadmaps } = useUserRoadmaps(currentUserId || undefined);

  const userName = currentUser?.name || "Student";
  const totalRoadmaps = roadmaps?.length || 0;
  const completedRoadmaps = roadmaps?.filter((r: RoadmapWithProgress) => r.status === 'completed')?.length || 0;
  const totalProgress = roadmaps?.reduce((sum: number, r: RoadmapWithProgress) => sum + (r.completedSteps || 0), 0) || 0;

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      <Stack.Screen options={{ title: "Home", headerShown: false }} />

      <ScrollView showsVerticalScrollIndicator={false} className="flex-1">
        {/* Header Section */}
        <Animated.View entering={FadeIn.duration(500)} className="px-6 pt-8 pb-6">
          <View className="flex-row items-center justify-between mb-2">
            <View className="flex-1">
              <Text className="text-sm text-muted-foreground mb-1">Hello,</Text>
              <Text className="text-3xl font-bold text-foreground tracking-tight">
                {userName}
              </Text>
            </View>
            <Pressable 
              onPress={() => router.push("/(tabs)/settings")}
              className="h-12 w-12 rounded-full bg-primary/10 items-center justify-center active:opacity-70"
            >
              <View className="h-10 w-10 rounded-full bg-primary items-center justify-center">
                <Text className="text-lg font-bold text-primary-foreground">
                  {userName.charAt(0).toUpperCase()}
                </Text>
              </View>
            </Pressable>
          </View>
          <Text className="text-base text-muted-foreground mt-1">
            Continue your learning journey today
          </Text>
        </Animated.View>

        {/* Learning Stats Card */}
        <Animated.View entering={FadeInDown.delay(100)} className="px-6 pb-6">
          <Pressable 
            className="overflow-hidden rounded-3xl active:opacity-90"
            onPress={() => router.push("/(tabs)/roadmap")}
          >
            <LinearGradient
              colors={['#7c3aed', '#8b5cf6', '#a78bfa']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              className="p-6 rounded-3xl"
            >
              {isLoadingRoadmaps ? (
                <>
                  <View className="mb-5">
                    <Skeleton className="h-7 w-48 mb-3 bg-white/30" />
                    <Skeleton className="h-4 w-40 bg-white/20" />
                  </View>
                  
                  <View className="flex-row gap-3">
                    <View className="flex-1 bg-white/20 rounded-2xl p-4 backdrop-blur">
                      <Skeleton className="h-9 w-12 mb-2 bg-white/30" />
                      <Skeleton className="h-3 w-20 bg-white/20" />
                    </View>
                    <View className="flex-1 bg-white/20 rounded-2xl p-4 backdrop-blur">
                      <Skeleton className="h-9 w-12 mb-2 bg-white/30" />
                      <Skeleton className="h-3 w-20 bg-white/20" />
                    </View>
                    <View className="flex-1 bg-white/20 rounded-2xl p-4 backdrop-blur">
                      <Skeleton className="h-9 w-12 mb-2 bg-white/30" />
                      <Skeleton className="h-3 w-20 bg-white/20" />
                    </View>
                  </View>
                </>
              ) : (
                <>
                  <View className="mb-5">
                    <Text className="text-2xl font-bold text-white mb-2">
                      Your Learning Journey
                    </Text>
                    <Text className="text-sm text-white/90 leading-5">
                      {totalRoadmaps > 0 
                        ? `${totalRoadmaps - completedRoadmaps} roadmap${(totalRoadmaps - completedRoadmaps) !== 1 ? 's' : ''} in progress`
                        : 'Start your first roadmap today'}
                    </Text>
                  </View>
                  
                  {/* Stats Grid */}
                  <View className="flex-row gap-3">
                    <View className="flex-1 bg-white/20 rounded-2xl p-4 backdrop-blur">
                      <Text className="text-3xl font-bold text-white mb-1">{totalRoadmaps}</Text>
                      <Text className="text-xs text-white/90 font-medium">Total Roadmaps</Text>
                    </View>
                    <View className="flex-1 bg-white/20 rounded-2xl p-4 backdrop-blur">
                      <Text className="text-3xl font-bold text-white mb-1">{completedRoadmaps}</Text>
                      <Text className="text-xs text-white/90 font-medium">Completed</Text>
                    </View>
                    <View className="flex-1 bg-white/20 rounded-2xl p-4 backdrop-blur">
                      <Text className="text-3xl font-bold text-white mb-1">{totalProgress}</Text>
                      <Text className="text-xs text-white/90 font-medium">Steps Done</Text>
                    </View>
                  </View>
                </>
              )}
            </LinearGradient>
          </Pressable>
        </Animated.View>

        {/* Quick Actions Section */}
        <Animated.View entering={FadeInDown.delay(200)} className="px-6 pb-6">
          <Text className="text-xl font-bold text-foreground mb-4">Quick Actions</Text>
          
          <View className="gap-3">
            {/* Explore Roadmaps */}
            <Pressable
              onPress={() => router.push("/(tabs)/roadmap")}
              className="active:opacity-70"
            >
              <Card className="overflow-hidden">
                <View className="p-5 flex-row items-center gap-4">
                  <View className="h-14 w-14 rounded-2xl bg-blue-100 dark:bg-blue-950 items-center justify-center">
                    <Brain size={26} className="text-blue-600 dark:text-blue-400" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-base font-bold text-foreground mb-1">
                      Explore Roadmaps
                    </Text>
                    <Text className="text-sm text-muted-foreground leading-5">
                      Browse and create personalized learning paths
                    </Text>
                  </View>
                  <ChevronRight size={20} className="text-muted-foreground" />
                </View>
              </Card>
            </Pressable>

            {/* Career Paths */}
            <Pressable
              onPress={() => router.push("/(tabs)/career")}
              className="active:opacity-70"
            >
              <Card className="overflow-hidden">
                <View className="p-5 flex-row items-center gap-4">
                  <View className="h-14 w-14 rounded-2xl bg-purple-100 dark:bg-purple-950 items-center justify-center">
                    <GraduationCap size={26} className="text-purple-600 dark:text-purple-400" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-base font-bold text-foreground mb-1">
                      Career Paths
                    </Text>
                    <Text className="text-sm text-muted-foreground leading-5">
                      Plan your professional journey step by step
                    </Text>
                  </View>
                  <ChevronRight size={20} className="text-muted-foreground" />
                </View>
              </Card>
            </Pressable>
          </View>
        </Animated.View>

        {/* Continue Learning / Recent Roadmaps */}
        {roadmaps && roadmaps.length > 0 && (
          <Animated.View entering={FadeInDown.delay(300)} className="px-6 pb-6">
            <View className="flex-row items-center justify-between mb-4">
              <Text className="text-xl font-bold text-foreground">Continue Learning</Text>
              <Pressable 
                onPress={() => router.push("/(tabs)/roadmap")}
                className="active:opacity-70"
              >
                <Text className="text-sm font-semibold text-primary">See All</Text>
              </Pressable>
            </View>
            
            <View className="gap-3">
              {roadmaps.slice(0, 3).map((roadmap: RoadmapWithProgress, index: number) => {
                const progressPercentage = roadmap.stepsCount > 0 
                  ? Math.round((roadmap.completedSteps / roadmap.stepsCount) * 100) 
                  : 0;
                
                return (
                  <Animated.View
                    key={roadmap.id}
                    entering={FadeInDown.delay(350 + index * 50)}
                  >
                    <Pressable
                      onPress={() => router.push(`/roadmap/${roadmap.id}` as any)}
                      className="active:opacity-70"
                    >
                      <Card className="overflow-hidden">
                        <View className="p-4">
                          <View className="flex-row items-center mb-3">
                            <View className="h-10 w-10 rounded-xl bg-teal-100 dark:bg-teal-950 items-center justify-center mr-3">
                              <BookOpen size={20} className="text-teal-600 dark:text-teal-400" />
                            </View>
                            <Text className="flex-1 text-base font-semibold text-foreground pr-2" numberOfLines={1}>
                              {roadmap.title}
                            </Text>
                            {progressPercentage === 100 && (
                              <Award size={18} className="text-green-600 dark:text-green-400" />
                            )}
                          </View>
                          
                          {/* Progress Bar */}
                          <View className="bg-secondary rounded-full h-2 overflow-hidden mb-2">
                            <View
                              className="bg-teal-500 h-full rounded-full"
                              style={{ width: `${progressPercentage}%` }}
                            />
                          </View>
                          <Text className="text-xs text-muted-foreground">
                            {progressPercentage}% Complete • {roadmap.completedSteps} of {roadmap.stepsCount} steps
                          </Text>
                        </View>
                      </Card>
                    </Pressable>
                  </Animated.View>
                );
              })}
            </View>
          </Animated.View>
        )}

        {/* Empty State for new users */}
        {(!roadmaps || roadmaps.length === 0) && (
          <Animated.View entering={FadeInDown.delay(300)} className="px-6 pb-6">
            <Card className="overflow-hidden">
              <View className="p-8 items-center">
                <View className="h-20 w-20 rounded-full bg-amber-100 dark:bg-amber-950 items-center justify-center mb-4">
                  <Rocket size={40} className="text-amber-600 dark:text-amber-400" />
                </View>
                <Text className="text-xl font-bold text-foreground mb-2 text-center">
                  Start Your Journey
                </Text>
                <Text className="text-sm text-muted-foreground text-center mb-6 px-4">
                  Create your first roadmap and begin your personalized learning adventure
                </Text>
                <Pressable
                  onPress={() => router.push("/(tabs)/roadmap")}
                  className="bg-primary rounded-full px-6 py-3 active:opacity-80"
                >
                  <Text className="text-primary-foreground font-semibold">
                    Get Started
                  </Text>
                </Pressable>
              </View>
            </Card>
          </Animated.View>
        )}

        {/* Bottom spacing */}
        <View className="h-8" />
      </ScrollView>
    </SafeAreaView>
  );
}
