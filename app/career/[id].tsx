import React, { useState, useRef } from 'react';
import { View, ActivityIndicator, Pressable, Modal, Alert, TouchableOpacity } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScrollView } from 'react-native-gesture-handler';
import Animated, { FadeIn, ZoomIn, FadeOut } from 'react-native-reanimated';
import { Text } from '@/components/ui/text';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ErrorDisplay } from '@/components/ui/error-display';
import { LoadingAnimation } from '@/components/ui/loading-animation';
import { useCareerPathDetail, useGenerateCareerTopicRoadmap } from '@/hooks/queries/useCareerQueries';
import { useUserRoadmaps } from '@/hooks/queries/useRoadmapQueries';
import { useCurrentUserId } from '@/hooks/stores/useUserStore';
import { ArrowLeft, CheckCircle2, Circle, Lock, MapIcon, ChevronRight, Sparkles, X } from 'lucide-react-native';
import { useColorScheme } from '@/lib/useColorScheme';

interface CareerTopic {
  id: string;
  name: string;
  description: string | null;
  category: string;
  difficulty: string;
  estimatedHours: number | null;
  isCore: boolean | null;
  isCompleted: boolean | null;
  prerequisites: string[];
  linkedRoadmapId: string | null;
}

export default function CareerPathDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const currentUserId = useCurrentUserId() || '';
  const { isDarkColorScheme } = useColorScheme();
  
  // Refs for scrolling to categories
  const scrollViewRef = useRef<ScrollView>(null);
  const categoryRefs = useRef<Record<string, View | null>>({});
  
  // State for roadmap generation modal
  const [selectedTopic, setSelectedTopic] = useState<CareerTopic | null>(null);
  const [showGenerateModal, setShowGenerateModal] = useState(false);

  // Fetch career path details
  const { 
    data: careerPath, 
    isLoading,
    error,
    refetch 
  } = useCareerPathDetail(id, currentUserId || undefined);

  // Fetch user's roadmaps to check for existing roadmaps
  const { data: userRoadmaps } = useUserRoadmaps(currentUserId);

  // Mutation for generating roadmap from career topic
  const generateRoadmapMutation = useGenerateCareerTopicRoadmap();

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'basic': return 'bg-green-500/20 border border-green-500/50';
      case 'intermediate': return 'bg-yellow-500/20 border border-yellow-500/50';
      case 'advanced': return 'bg-red-500/20 border border-red-500/50';
      default: return 'bg-gray-500/20 border border-gray-500/50';
    }
  };

  const getDifficultyTextColor = (difficulty: string) => {
    switch (difficulty) {
      case 'basic': return 'text-green-700 dark:text-green-400';
      case 'intermediate': return 'text-yellow-700 dark:text-yellow-400';
      case 'advanced': return 'text-red-700 dark:text-red-400';
      default: return 'text-gray-700 dark:text-gray-400';
    }
  };

  const getCategoryColor = (category: string) => {
    const colors = [
      { bg: 'bg-blue-500/20 border border-blue-500/50', text: 'text-blue-700 dark:text-blue-400' },
      { bg: 'bg-purple-500/20 border border-purple-500/50', text: 'text-purple-700 dark:text-purple-400' },
      { bg: 'bg-pink-500/20 border border-pink-500/50', text: 'text-pink-700 dark:text-pink-400' },
      { bg: 'bg-indigo-500/20 border border-indigo-500/50', text: 'text-indigo-700 dark:text-indigo-400' },
      { bg: 'bg-cyan-500/20 border border-cyan-500/50', text: 'text-cyan-700 dark:text-cyan-400' },
    ];
    const index = category.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[index % colors.length];
  };

  const handleTopicPress = (topic: CareerTopic) => {
    if (topic.linkedRoadmapId) {
      // Roadmap already exists and is linked, navigate to it
      router.push(`/roadmap/${topic.linkedRoadmapId}` as any);
    } else {
      // Check if a roadmap for this topic name already exists (but not linked)
      const existingRoadmap = userRoadmaps?.find(roadmap => 
        roadmap.title.toLowerCase().includes(topic.name.toLowerCase()) ||
        topic.name.toLowerCase().includes(roadmap.title.replace(' Learning Path', '').toLowerCase())
      );

      if (existingRoadmap) {
        // Roadmap exists, navigate directly without showing modal
        router.push(`/roadmap/${existingRoadmap.id}` as any);
      } else {
        // No roadmap yet, show generation modal
        setSelectedTopic(topic);
        setShowGenerateModal(true);
      }
    }
  };

  const handleGenerateRoadmap = async () => {
    if (!selectedTopic || !currentUserId || !id) return;

    try {
      const result = await generateRoadmapMutation.mutateAsync({
        userId: currentUserId,
        careerTopicId: selectedTopic.id,
        careerPathId: id,
        topicName: selectedTopic.name,
      });

      setShowGenerateModal(false);
      setSelectedTopic(null);

      // Navigate to the newly created roadmap
      router.push(`/roadmap/${result.roadmapId}` as any);
    } catch (error) {
      console.error('Failed to generate roadmap:', error);
      Alert.alert('Error', 'Failed to generate roadmap. Please try again.');
    }
  };
  // Group topics by category
  const topicsByCategory = careerPath?.topics.reduce((acc, topic) => {
    if (!acc[topic.category]) {
      acc[topic.category] = [];
    }
    acc[topic.category].push(topic);
    return acc;
  }, {} as Record<string, typeof careerPath.topics>);

  // Loading state for roadmap generation
  if (generateRoadmapMutation.isPending) {
    return (
      <SafeAreaView className="flex-1 bg-background" edges={['top']}>
        <Stack.Screen options={{ headerShown: false }} />
        <View className="flex-1 items-center justify-center">
          <LoadingAnimation 
            title={`Creating ${selectedTopic?.name} Roadmap`}
            messages={[
              'Analyzing topic requirements...',
              'Structuring learning modules...',
              'Organizing content...',
              'Creating your roadmap...',
            ]}
          />
        </View>
      </SafeAreaView>
    );
  }

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-background" edges={['top']}>
        <Stack.Screen options={{ headerShown: false }} />
        <View className="flex-row items-center px-4 py-3 border-b border-border">
          <Pressable 
            onPress={() => router.back()}
            className="h-9 w-9 items-center justify-center rounded-lg active:bg-secondary"
          >
            <ArrowLeft size={20} className="text-foreground" />
          </Pressable>
        </View>
        <ScrollView className="flex-1 px-4 py-6">
          {/* Title skeleton */}
          <View className="h-8 w-3/4 bg-muted rounded-lg mb-3 animate-pulse" />
          {/* Description skeleton */}
          <View className="h-4 w-full bg-muted rounded-lg mb-2 animate-pulse" />
          <View className="h-4 w-5/6 bg-muted rounded-lg mb-6 animate-pulse" />
          
          {/* Stats skeleton */}
          <View className="flex-row gap-4 mb-6">
            {[1, 2, 3].map((i) => (
              <View key={i} className="gap-1">
                <View className="h-8 w-16 bg-muted rounded-lg animate-pulse" />
                <View className="h-3 w-12 bg-muted rounded-lg animate-pulse" />
              </View>
            ))}
          </View>
          
          {/* Categories skeleton */}
          <View className="mb-6">
            <View className="h-4 w-24 bg-muted rounded-lg mb-2 animate-pulse" />
            <View className="flex-row gap-2 flex-wrap">
              {[1, 2, 3, 4].map((i) => (
                <View key={i} className="h-7 w-20 bg-muted rounded-full animate-pulse" />
              ))}
            </View>
          </View>
          
          {/* Topics skeleton */}
          {[1, 2, 3].map((cardIndex) => (
            <View key={cardIndex} className="mb-4 p-4 bg-card border border-border rounded-xl">
              <View className="h-5 w-32 bg-muted rounded-lg mb-4 animate-pulse" />
              {[1, 2, 3].map((topicIndex) => (
                <View key={topicIndex} className="p-4 border-2 border-border rounded-xl mb-3">
                  <View className="h-5 w-2/3 bg-muted rounded-lg mb-2 animate-pulse" />
                  <View className="h-4 w-full bg-muted rounded-lg mb-1 animate-pulse" />
                  <View className="h-4 w-4/5 bg-muted rounded-lg mb-3 animate-pulse" />
                  <View className="flex-row gap-2">
                    <View className="h-6 w-16 bg-muted rounded-full animate-pulse" />
                    <View className="h-6 w-12 bg-muted rounded-full animate-pulse" />
                  </View>
                </View>
              ))}
            </View>
          ))}
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView className="flex-1 bg-background" edges={['top']}>
        <Stack.Screen options={{ headerShown: false }} />
        <View className="flex-row items-center px-4 py-3 border-b border-border">
          <Pressable 
            onPress={() => router.back()}
            className="h-9 w-9 items-center justify-center rounded-lg active:bg-secondary"
          >
            <ArrowLeft size={20} color={isDarkColorScheme ? '#fafafa' : '#0a0a0a'} />
          </Pressable>
        </View>
        <ErrorDisplay
          error={error instanceof Error ? error.message : String(error)}
          onRetry={() => refetch()}
          title="Failed to load career path"
        />
      </SafeAreaView>
    );
  }

  if (!careerPath) {
    return (
      <SafeAreaView className="flex-1 bg-background" edges={['top']}>
        <Stack.Screen options={{ headerShown: false }} />
        <View className="flex-row items-center px-4 py-3 border-b border-border">
          <Pressable 
            onPress={() => router.back()}
            className="h-9 w-9 items-center justify-center rounded-lg active:bg-secondary"
          >
            <ArrowLeft size={20} color={isDarkColorScheme ? '#fafafa' : '#0a0a0a'} />
          </Pressable>
        </View>
        <View className="flex-1 justify-center items-center p-6">
          <Text className="text-center text-muted-foreground">Career path not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Calculate roadmaps generated count
  const roadmapsGenerated = careerPath.topics.filter(t => t.linkedRoadmapId).length;

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      
      {/* Generate Roadmap Confirmation Modal */}
      <Modal
        transparent
        visible={showGenerateModal}
        animationType="none"
        onRequestClose={() => setShowGenerateModal(false)}
        statusBarTranslucent
      >
        <Animated.View
          entering={FadeIn.duration(200)}
          exiting={FadeOut.duration(200)}
          className="flex-1 items-center justify-center px-6"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
        >
          <Pressable 
            className="absolute inset-0" 
            onPress={() => setShowGenerateModal(false)}
          />
          
          <Animated.View
            entering={ZoomIn.duration(300).springify()}
            className="bg-card rounded-2xl w-full max-w-sm overflow-hidden"
            style={{
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 10 },
              shadowOpacity: 0.3,
              shadowRadius: 20,
              elevation: 10,
            }}
          >
            <Pressable
              onPress={() => setShowGenerateModal(false)}
              className="absolute top-4 right-4 z-10 h-8 w-8 items-center justify-center rounded-full bg-secondary/80 active:bg-secondary"
            >
              <X size={16} color={isDarkColorScheme ? '#a1a1aa' : '#71717a'} />
            </Pressable>

            <View className="items-center pt-8 pb-4">
              <View 
                className="h-20 w-20 rounded-full bg-violet-50 dark:bg-violet-950 items-center justify-center mb-4"
                style={{
                  shadowColor: '#7c3aed',
                  shadowOffset: { width: 0, height: 0 },
                  shadowOpacity: 0.3,
                  shadowRadius: 20,
                }}
              >
                <Sparkles size={40} color="#7c3aed" />
              </View>
              
              <Text className="text-xl font-bold text-foreground text-center px-6">
                Generate Roadmap
              </Text>
              
              <Text className="text-sm text-muted-foreground text-center px-6 mt-2 leading-relaxed">
                Create a personalized learning roadmap for "{selectedTopic?.name}" with prerequisites, quizzes, and content.
              </Text>
            </View>

            <View className="px-6 pb-6 pt-4">
              <Pressable
                onPress={handleGenerateRoadmap}
                className="w-full h-12 items-center justify-center rounded-lg bg-primary active:opacity-90 mb-3"
              >
                <Text className="text-base font-semibold text-primary-foreground">
                  Generate Roadmap
                </Text>
              </Pressable>
              
              <Pressable
                onPress={() => setShowGenerateModal(false)}
                className="w-full h-12 items-center justify-center rounded-lg border border-border bg-background active:bg-secondary"
              >
                <Text className="text-base font-medium text-foreground">
                  Cancel
                </Text>
              </Pressable>
            </View>
          </Animated.View>
        </Animated.View>
      </Modal>
      
      {/* Header */}
      <View className="flex-row items-center px-4 py-3 border-b border-border bg-background">
        <Pressable 
          onPress={() => router.back()}
          className="h-9 w-9 items-center justify-center rounded-lg active:bg-secondary"
        >
          <ArrowLeft size={20} className="text-foreground" />
        </Pressable>
      </View>

      <ScrollView ref={scrollViewRef} className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="px-4 py-6 gap-6">
          {/* Career Path Overview */}
          <View>
            <Text className="text-2xl font-bold text-foreground mb-2">{careerPath.roleName}</Text>
            {careerPath.roleDescription && (
              <Text className="text-muted-foreground leading-6 mb-6">
                {careerPath.roleDescription}
              </Text>
            )}
            
            <View className="flex-row items-center gap-4 flex-wrap mb-6">
              <View>
                <Text className="text-2xl font-bold text-primary">
                  {careerPath.topics.length}
                </Text>
                <Text className="text-xs text-muted-foreground">Skills</Text>
              </View>
              <View>
                <Text className="text-2xl font-bold text-primary">
                  {roadmapsGenerated}
                </Text>
                <Text className="text-xs text-muted-foreground">
                  {roadmapsGenerated === 1 ? "Roadmap" : "Roadmaps"}
                </Text>
              </View>
              <View>
                <Text className="text-2xl font-bold text-primary">
                  {careerPath.totalEstimatedHours}h
                </Text>
                <Text className="text-xs text-muted-foreground">Est. Time</Text>
              </View>
            </View>

            {/* Categories */}
            {careerPath.categories.length > 0 && (
              <View className="mb-6">
                <Text className="text-sm font-semibold text-foreground mb-2">Categories</Text>
                <View className="flex-row flex-wrap gap-2">
                  {careerPath.categories.map((category) => {
                    const colorScheme = getCategoryColor(category);
                    return (
                      <TouchableOpacity 
                        key={category}
                        activeOpacity={0.7}
                        onPress={() => {
                          const categoryView = categoryRefs.current[category];
                          if (categoryView && scrollViewRef.current) {
                            categoryView.measureLayout(
                              scrollViewRef.current as any,
                              (x, y) => {
                                scrollViewRef.current?.scrollTo({ y: y - 80, animated: true });
                              },
                              () => {}
                            );
                          }
                        }}
                        className={`px-3 py-1.5 rounded-full ${colorScheme.bg}`}
                      >
                        <Text className={`text-xs font-medium ${colorScheme.text}`}>{category}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            {/* Info about clicking topics */}
            <View className="p-3 bg-secondary/50 rounded-lg">
              <Text className="text-xs text-muted-foreground text-center">
                Tap a skill to generate its learning roadmap
              </Text>
            </View>
          </View>

          {/* Topics by Category */}
          {topicsByCategory && Object.entries(topicsByCategory).map(([category, topics]) => {
            const colorScheme = getCategoryColor(category);
            return (
              <Card 
                key={category}
                ref={(ref) => {
                  categoryRefs.current[category] = ref;
                }}
              >
                <CardHeader>
                  <View className="flex-row items-center justify-between gap-3">
                    <CardTitle className="flex-1 flex-shrink">{category}</CardTitle>
                    <View className={`px-3 py-1.5 rounded-full ${colorScheme.bg} flex-shrink-0`}>
                      <Text className={`text-xs font-medium ${colorScheme.text}`}>{topics.length} skills</Text>
                    </View>
                  </View>
                </CardHeader>
                <CardContent>
                  <View className="gap-3">
                    {topics.map((topic) => (
                      <Pressable
                        key={topic.id}
                        onPress={() => handleTopicPress(topic as CareerTopic)}
                        className="border-2 border-border rounded-xl p-4 active:bg-secondary/50 active:border-primary"
                      >
                        <View className="flex-row items-start justify-between">
                          <View className="flex-1">
                            <View className="flex-row items-center gap-2 mb-2">
                              {topic.linkedRoadmapId ? (
                                <MapIcon size={18} color="#22c55e" />
                              ) : topic.isCompleted ? (
                                <CheckCircle2 size={18} color="#22c55e" />
                              ) : (
                                <Circle size={18} color={isDarkColorScheme ? '#71717a' : '#a1a1aa'} />
                              )}
                              <Text className="font-semibold text-foreground flex-1 text-base">
                                {topic.name}
                              </Text>
                              <ChevronRight size={18} color={isDarkColorScheme ? '#a1a1aa' : '#71717a'} />
                            </View>
                            
                            {topic.description && (
                              <Text className="text-sm text-muted-foreground mt-1 mb-3 leading-5">
                                {topic.description}
                              </Text>
                            )}

                            <View className="flex-row items-center gap-2 flex-wrap">
                              <View className={`px-3 py-1.5 rounded-full ${getDifficultyColor(topic.difficulty)}`}>
                                <Text className={`text-xs font-medium ${getDifficultyTextColor(topic.difficulty)}`}>
                                  {topic.difficulty}
                                </Text>
                              </View>
                              <View className="px-3 py-1.5 rounded-full bg-secondary border border-border">
                                <Text className="text-xs font-medium text-foreground">
                                  {topic.estimatedHours}h
                                </Text>
                              </View>
                              {topic.isCore && (
                                <View className="px-3 py-1.5 rounded-full bg-purple-500/20 border border-purple-500/50">
                                  <Text className="text-xs font-medium text-purple-700 dark:text-purple-400">
                                    Core
                                  </Text>
                                </View>
                              )}
                              {topic.linkedRoadmapId && (
                                <View className="px-3 py-1.5 rounded-full bg-green-500/20 border border-green-500/50">
                                  <Text className="text-xs font-medium text-green-700 dark:text-green-400">
                                    Roadmap Ready
                                  </Text>
                                </View>
                              )}
                            </View>

                            {topic.prerequisites.length > 0 && (
                              <View className="flex-row items-center gap-2 mt-3 p-2 bg-secondary/50 rounded-lg">
                                <Lock size={14} color={isDarkColorScheme ? '#a1a1aa' : '#71717a'} />
                                <Text className="text-xs text-muted-foreground flex-1">
                                  Requires: {topic.prerequisites.join(', ')}
                                </Text>
                              </View>
                            )}
                          </View>
                        </View>
                      </Pressable>
                    ))}
                  </View>
                </CardContent>
              </Card>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
