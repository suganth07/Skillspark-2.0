import { View, ScrollView, Pressable, Dimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useRouter } from "expo-router";
import * as React from "react";
import { LinearGradient } from "expo-linear-gradient";
import { Text } from "@/components/ui/text";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  BookOpen, 
  ChevronRight, 
  Brain, 
  Award,
  GraduationCap,
  Clock,
  CheckCircle,
  ArrowRight,
} from "lucide-react-native";
import { useCurrentUserId } from "@/hooks/stores/useUserStore";
import { useCurrentUser } from "@/hooks/queries/useUserQueries";
import { useUserRoadmaps } from "@/hooks/queries/useRoadmapQueries";
import { XPProgressBar } from "@/components/gamification/XPProgress";
import type { RoadmapWithProgress } from "@/server/queries/roadmaps";

const { width } = Dimensions.get('window');
const CARD_WIDTH = width * 0.7;
const CARD_SPACING = 16;

type FilterTab = 'all' | 'in-progress' | 'completed';

export default function Home() {
  const router = useRouter();
  const currentUserId = useCurrentUserId();
  const { data: currentUser, isLoading: isLoadingUser } = useCurrentUser(currentUserId || undefined);
  const { data: roadmaps, isLoading: isLoadingRoadmaps } = useUserRoadmaps(currentUserId || undefined);
  const [selectedFilter, setSelectedFilter] = React.useState<FilterTab>('all');

  const userName = currentUser?.name || "Student";
  const totalRoadmaps = roadmaps?.length || 0;
  const completedRoadmaps = roadmaps?.filter((r: RoadmapWithProgress) => r.status === 'completed')?.length || 0;
  const inProgressRoadmaps = roadmaps?.filter((r: RoadmapWithProgress) => 
    r.status === 'active' && r.completedSteps > 0
  )?.length || 0;
  const totalProgress = roadmaps?.reduce((sum: number, r: RoadmapWithProgress) => sum + (r.completedSteps || 0), 0) || 0;

  const filteredRoadmaps = React.useMemo(() => {
    if (!roadmaps) return [];
    
    switch (selectedFilter) {
      case 'in-progress':
        return roadmaps.filter((r: RoadmapWithProgress) => 
          // r.status === 'in-progress' || (r.completedSteps > 0 && r.status !== 'completed')
        r.status === 'active' && r.completedSteps > 0  
      );
      case 'completed':
        return roadmaps.filter((r: RoadmapWithProgress) => r.status === 'completed');
      default:
        return roadmaps;
    }
  }, [roadmaps, selectedFilter]);

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      <Stack.Screen options={{ title: "Home", headerShown: false }} />

      <ScrollView showsVerticalScrollIndicator={false} className="flex-1">
        {/* Header Section */}
        <View className="px-6 pt-6 pb-4">
          <View className="flex-row items-center justify-between mb-4">
            <View className="flex-1">
              <Text className="text-base text-muted-foreground mb-1">
                Hello,
              </Text>
              <Text className="text-3xl font-bold text-foreground tracking-tight">
                {userName}!
              </Text>
              <Text className="text-sm text-muted-foreground mt-1">
                Have a nice day.
              </Text>
            </View>
            <Pressable 
              onPress={() => router.push("/(tabs)/settings")}
              className="h-14 w-14 rounded-full bg-primary items-center justify-center shadow-lg active:opacity-70"
              style={{
                shadowColor: '#7c3aed',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.3,
                shadowRadius: 8,
                elevation: 8,
              }}
            >
              <Text className="text-xl font-bold text-primary-foreground">
                {userName.charAt(0).toUpperCase()}
              </Text>
            </Pressable>
          </View>

          {/* XP Progress Bar */}
          {currentUser && (
            <View className="mt-2">
              <XPProgressBar 
                xp={currentUser.xp || 0}
                showDetails={true}
                size="md"
              />
            </View>
          )}
        </View>

        {/* Filter Tabs */}
        {roadmaps && roadmaps.length > 0 && (
          <View className="px-6 pb-6">
            <View className="flex-row gap-3">
              <Pressable
                onPress={() => setSelectedFilter('all')}
                className={`px-5 py-2.5 rounded-full ${
                  selectedFilter === 'all' 
                    ? 'bg-foreground' 
                    : 'bg-secondary'
                }`}
              >
                <Text className={`font-semibold ${
                  selectedFilter === 'all'
                    ? 'text-background'
                    : 'text-muted-foreground'
                }`}>
                  My Roadmaps
                </Text>
              </Pressable>
              
              <Pressable
                onPress={() => setSelectedFilter('in-progress')}
                className={`px-5 py-2.5 rounded-full ${
                  selectedFilter === 'in-progress' 
                    ? 'bg-foreground' 
                    : 'bg-secondary'
                }`}
              >
                <Text className={`font-semibold ${
                  selectedFilter === 'in-progress'
                    ? 'text-background'
                    : 'text-muted-foreground'
                }`}>
                  In-Progress
                </Text>
              </Pressable>
              
              <Pressable
                onPress={() => setSelectedFilter('completed')}
                className={`px-5 py-2.5 rounded-full ${
                  selectedFilter === 'completed' 
                    ? 'bg-foreground' 
                    : 'bg-secondary'
                }`}
              >
                <Text className={`font-semibold ${
                  selectedFilter === 'completed'
                    ? 'text-background'
                    : 'text-muted-foreground'
                }`}>
                  Completed
                </Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* Roadmap Cards Carousel */}
        <View className="pb-6">
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            snapToInterval={CARD_WIDTH + CARD_SPACING}
            decelerationRate="fast"
            contentContainerStyle={{
              paddingHorizontal: 24,
              gap: CARD_SPACING,
            }}
          >
            {roadmaps && roadmaps.length > 0 && filteredRoadmaps.map((roadmap: RoadmapWithProgress, index: number) => {
              const progressPercentage = roadmap.stepsCount > 0 
                ? Math.round((roadmap.completedSteps / roadmap.stepsCount) * 100) 
                : 0;
              
              const isCompleted = roadmap.status === 'completed';
              
              const gradientColors = isCompleted
                ? ['#10b981', '#059669', '#047857'] as const // Green gradient for completed
                : ['#7c3aed', '#6d28d9', '#5b21b6'] as const; // Purple gradient for in-progress
              
              return (
                <View
                  key={roadmap.id}
                  style={{ width: CARD_WIDTH }}
                >
                  <Pressable
                    onPress={() => router.push(`/roadmap/${roadmap.id}` as any)}
                    className="active:opacity-90"
                  >
                    <LinearGradient
                      colors={gradientColors}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      className="p-6 min-h-[220px]"
                      style={{
                        borderRadius: 24,
                        shadowColor: gradientColors[0],
                        shadowOffset: { width: 0, height: 8 },
                        shadowOpacity: 0.3,
                        shadowRadius: 16,
                        elevation: 10,
                      }}
                    >
                      {/* Card Header */}
                      <View className="flex-row items-center mb-4">
                        <View className="h-12 w-12 rounded-xl bg-white/30 items-center justify-center mr-3 backdrop-blur">
                          <BookOpen size={24} className="text-white" />
                        </View>
                        <View className="flex-1">
                          <Text className="text-xs text-white/80 font-medium mb-1">
                            Roadmap {index + 1}
                          </Text>
                          <Text className="text-base font-bold text-white" numberOfLines={1}>
                            {roadmap.title}
                          </Text>
                        </View>
                      </View>

                      {/* Description or Status */}
                      <Text className="text-white/90 text-sm mb-6 leading-5" numberOfLines={2}>
                        {isCompleted 
                          ? `Completed! You've mastered all ${roadmap.stepsCount} steps.`
                          : roadmap.description || `${roadmap.stepsCount} steps to master this skill`
                        }
                      </Text>

                      {/* Progress Section */}
                      <View className="mt-auto">
                        <View className="bg-white/20 rounded-full h-2 overflow-hidden mb-3">
                          <View
                            className="bg-white h-full rounded-full"
                            style={{ width: `${progressPercentage}%` }}
                          />
                        </View>
                        
                        <View className="flex-row items-center justify-between">
                          <Text className="text-white/90 text-sm font-semibold">
                            {progressPercentage}% Complete
                          </Text>
                          <Text className="text-white/80 text-xs">
                            {roadmap.completedSteps}/{roadmap.stepsCount} steps
                          </Text>
                        </View>
                      </View>

                      {/* Completion Badge */}
                      {isCompleted && (
                        <View className="absolute top-4 right-4">
                          <View className="bg-white/30 rounded-full p-2 backdrop-blur">
                            <Award size={20} className="text-white" />
                          </View>
                        </View>
                      )}
                    </LinearGradient>
                  </Pressable>
                </View>
              );
            })}
            
            {/* Create New Roadmap Card - Always show */}
            <View style={{ width: CARD_WIDTH }}>
              <Pressable
                onPress={() => router.push("/(tabs)/roadmap")}
                className="active:opacity-90"
              >
                <LinearGradient
                  colors={['#7c3aed', '#6d28d9', '#5b21b6']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  className="p-6 min-h-[220px] items-center justify-center"
                  style={{
                    borderRadius: 24,
                    shadowColor: '#7c3aed',
                    shadowOffset: { width: 0, height: 8 },
                    shadowOpacity: 0.3,
                    shadowRadius: 16,
                    elevation: 10,
                  }}
                >
                  <View className="h-16 w-16 rounded-full bg-white/20 items-center justify-center mb-4 backdrop-blur">
                    <Brain size={32} className="text-white" />
                  </View>
                  <Text className="text-lg font-bold text-white mb-2">
                    Create New Roadmap
                  </Text>
                  <Text className="text-sm text-white/90 text-center">
                    Start your next learning journey
                  </Text>
                </LinearGradient>
              </Pressable>
            </View>
            
            {/* Explore Career Paths Card - Always show */}
            <View style={{ width: CARD_WIDTH }}>
              <Pressable
                onPress={() => router.push("/(tabs)/career")}
                className="active:opacity-90"
              >
                <LinearGradient
                  colors={['#8b5cf6', '#7c3aed', '#6d28d9']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  className="p-6 min-h-[220px] items-center justify-center"
                  style={{
                    borderRadius: 24,
                    shadowColor: '#8b5cf6',
                    shadowOffset: { width: 0, height: 8 },
                    shadowOpacity: 0.3,
                    shadowRadius: 16,
                    elevation: 10,
                  }}
                >
                  <View className="h-16 w-16 rounded-full bg-white/20 items-center justify-center mb-4 backdrop-blur">
                    <GraduationCap size={32} className="text-white" />
                  </View>
                  <Text className="text-lg font-bold text-white mb-2">
                    Explore Career Paths
                  </Text>
                  <Text className="text-sm text-white/90 text-center">
                    Plan your professional journey
                  </Text>
                </LinearGradient>
              </Pressable>
            </View>
          </ScrollView>
        </View>

        {/* Continue Learning Section */}
        {roadmaps && roadmaps.length > 0 && (
          <View className="px-6 pb-6">
            <View className="flex-row items-center justify-between mb-4">
              <Text className="text-xl font-bold text-foreground">Continue Learning</Text>
              <Pressable 
                onPress={() => router.push("/(tabs)/roadmap")}
                className="flex-row items-center active:opacity-70"
              >
                <Text className="text-sm font-medium text-primary mr-1">See all</Text>
                <ArrowRight size={14} className="text-primary" />
              </Pressable>
            </View>
            
            <View className="gap-3">
              {roadmaps.slice(0, 3).map((roadmap: RoadmapWithProgress) => {
                const progressPercentage = roadmap.stepsCount > 0 
                  ? Math.round((roadmap.completedSteps / roadmap.stepsCount) * 100) 
                  : 0;
                const isCompleted = roadmap.status === 'completed';
                
                return (
                  <Pressable 
                    key={roadmap.id}
                    onPress={() => router.push(`/roadmap/${roadmap.id}` as any)}
                    className="active:opacity-70"
                  >
                    <Card className="overflow-hidden">
                      <View className="p-4 flex-row items-center">
                        <View className={`h-12 w-12 rounded-xl items-center justify-center mr-4 ${
                          isCompleted ? 'bg-green-100 dark:bg-green-950' : 'bg-primary/10'
                        }`}>
                          {isCompleted ? (
                            <CheckCircle size={22} className="text-green-600 dark:text-green-400" />
                          ) : (
                            <BookOpen size={22} className="text-primary" />
                          )}
                        </View>
                        
                        <View className="flex-1 mr-3">
                          <Text className="text-base font-semibold text-foreground mb-2" numberOfLines={1}>
                            {roadmap.title}
                          </Text>
                          <View className="flex-row items-center">
                            <Text className="text-xs text-muted-foreground">
                              {roadmap.completedSteps} / {roadmap.stepsCount} steps
                            </Text>
                            <View className="h-1 w-1 rounded-full bg-muted-foreground mx-3" />
                            <Text className={`text-xs font-medium ${
                              isCompleted ? 'text-green-600 dark:text-green-400' : 'text-primary'
                            }`}>
                              {isCompleted ? 'Completed' : `${progressPercentage}%`}
                            </Text>
                          </View>
                        </View>
                        
                        <ChevronRight size={20} className="text-muted-foreground" />
                      </View>
                    </Card>
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}

        {/* Quick Actions */}
        <View className="px-6 pb-6">
          <Text className="text-xl font-bold text-foreground mb-4">Quick Actions</Text>
          
          <View className="flex-row gap-3">
            <Pressable
              onPress={() => router.push("/(tabs)/roadmap")}
              className="flex-1 active:opacity-70"
            >
              <Card className="overflow-hidden">
                <View className="p-4 items-center h-[100px] justify-center">
                  <View className="h-12 w-12 rounded-xl bg-primary/10 items-center justify-center mb-3">
                    <Brain size={24} className="text-primary" />
                  </View>
                  <Text className="text-xs font-semibold text-foreground text-center">
                    New Roadmap
                  </Text>
                </View>
              </Card>
            </Pressable>

            <Pressable
              onPress={() => router.push("/(tabs)/career")}
              className="flex-1 active:opacity-70"
            >
              <Card className="overflow-hidden">
                <View className="p-4 items-center h-[100px] justify-center">
                  <View className="h-12 w-12 rounded-xl bg-primary/10 items-center justify-center mb-3">
                    <GraduationCap size={24} className="text-primary" />
                  </View>
                  <Text className="text-xs font-semibold text-foreground text-center">
                    Career Paths
                  </Text>
                </View>
              </Card>
            </Pressable>

            <Pressable
              onPress={() => router.push("/(tabs)/settings")}
              className="flex-1 active:opacity-70"
            >
              <Card className="overflow-hidden">
                <View className="p-4 items-center h-[100px] justify-center">
                  <View className="h-12 w-12 rounded-xl bg-primary/10 items-center justify-center mb-3">
                    <Clock size={24} className="text-primary" />
                  </View>
                  <Text className="text-xs font-semibold text-foreground text-center">
                    Activity
                  </Text>
                </View>
              </Card>
            </Pressable>
          </View>
        </View>

        {/* Stats Summary - Only show when there are roadmaps */}
        {roadmaps && roadmaps.length > 0 && (
          <View className="px-6 pb-6">
            <Card className="overflow-hidden border-primary/20">
              <View className="p-5">
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center">
                    <View className="h-10 w-10 rounded-xl bg-primary/10 items-center justify-center mr-3">
                      <Award size={20} className="text-primary" />
                    </View>
                    <View>
                      <Text className="text-sm font-medium text-muted-foreground">Your Progress</Text>
                      <Text className="text-lg font-bold text-foreground">
                        {completedRoadmaps} of {totalRoadmaps} completed
                      </Text>
                    </View>
                  </View>
                  <Text className="text-2xl font-bold text-primary">
                    {totalRoadmaps > 0 ? Math.round((completedRoadmaps / totalRoadmaps) * 100) : 0}%
                  </Text>
                </View>
                
                {/* Progress bar */}
                <View className="mt-4 h-2 bg-secondary rounded-full overflow-hidden">
                  <View 
                    className="h-full bg-primary rounded-full"
                    style={{ 
                      width: `${totalRoadmaps > 0 ? (completedRoadmaps / totalRoadmaps) * 100 : 0}%` 
                    }}
                  />
                </View>
              </View>
            </Card>
          </View>
        )}

        {/* Empty State - Clean but inviting */}
        {(!roadmaps || roadmaps.length === 0) && (
          <View className="px-6 pb-6">
            <Card className="overflow-hidden border-primary/20">
              <View className="p-8 items-center">
                <View className="h-20 w-20 rounded-2xl bg-primary/10 items-center justify-center mb-5">
                  <Brain size={40} className="text-primary" />
                </View>
                <Text className="text-xl font-bold text-foreground mb-2 text-center">
                  Start Your Learning Journey
                </Text>
                <Text className="text-sm text-muted-foreground text-center mb-6 leading-5">
                  Create personalized roadmaps and master{'\n'}new skills at your own pace
                </Text>
                <Pressable
                  onPress={() => router.push("/(tabs)/roadmap")}
                  className="bg-primary rounded-xl px-8 py-4 active:opacity-80"
                >
                  <Text className="text-primary-foreground font-semibold text-base">
                    Create Your First Roadmap
                  </Text>
                </Pressable>
              </View>
            </Card>
          </View>
        )}

        {/* Bottom spacing */}
        <View className="h-8" />
      </ScrollView>
    </SafeAreaView>
  );
}
