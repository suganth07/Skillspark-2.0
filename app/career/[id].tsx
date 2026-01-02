import React, { useState } from 'react';
import { View, ActivityIndicator, Pressable, Modal, Alert } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScrollView } from 'react-native-gesture-handler';
import Animated, { FadeIn, ZoomIn, FadeOut } from 'react-native-reanimated';
import { Text } from '@/components/ui/text';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ErrorDisplay } from '@/components/ui/error-display';
import { RocketLoadingAnimation } from '@/components/roadmap/RocketLoadingAnimation';
import { useCareerPathDetail, useGenerateCareerTopicRoadmap } from '@/hooks/queries/useCareerQueries';
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
  const currentUserId = useCurrentUserId();
  const { isDarkColorScheme } = useColorScheme();
  
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

  // Mutation for generating roadmap from career topic
  const generateRoadmapMutation = useGenerateCareerTopicRoadmap();

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'basic': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
      case 'intermediate': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
      case 'advanced': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400';
    }
  };

  const getCategoryColor = (category: string) => {
    const colors = [
      'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
      'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
      'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-400',
      'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400',
      'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-400',
    ];
    const index = category.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[index % colors.length];
  };

  const handleTopicPress = (topic: CareerTopic) => {
    if (topic.linkedRoadmapId) {
      // Roadmap already exists, navigate to it
      router.push(`/roadmap/${topic.linkedRoadmapId}` as any);
    } else {
      // No roadmap yet, show generation modal
      setSelectedTopic(topic);
      setShowGenerateModal(true);
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
          <RocketLoadingAnimation />
          <Text className="mt-4 text-muted-foreground text-center px-6">
            Generating roadmap for {selectedTopic?.name}...
          </Text>
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
            <ArrowLeft size={20} color={isDarkColorScheme ? '#fafafa' : '#0a0a0a'} />
          </Pressable>
          <Text className="text-lg font-semibold flex-1 ml-3">Loading...</Text>
        </View>
        <View className="flex-1 justify-center items-center px-6">
          <ActivityIndicator size="large" />
          <Text className="mt-4 text-muted-foreground text-center">Loading career path...</Text>
        </View>
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
          <ArrowLeft size={20} color={isDarkColorScheme ? '#fafafa' : '#0a0a0a'} />
        </Pressable>
        <Text className="text-lg font-semibold flex-1 ml-3" numberOfLines={1}>
          {careerPath.roleName}
        </Text>
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="p-6 gap-6">
          {/* Career Path Overview */}
          <Card>
            <CardHeader>
              <CardTitle>{careerPath.roleName}</CardTitle>
              {careerPath.roleDescription && (
                <Text className="text-muted-foreground mt-2 leading-6">
                  {careerPath.roleDescription}
                </Text>
              )}
            </CardHeader>
            <CardContent>
              <View className="flex-row items-center gap-4 flex-wrap">
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
                  <Text className="text-xs text-muted-foreground">Roadmaps</Text>
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
                <View className="mt-4">
                  <Text className="text-sm font-semibold mb-2">Categories</Text>
                  <View className="flex-row flex-wrap gap-2">
                    {careerPath.categories.map((category) => (
                      <Badge key={category} className={getCategoryColor(category)}>
                        <Text className="text-xs">{category}</Text>
                      </Badge>
                    ))}
                  </View>
                </View>
              )}

              {/* Info about clicking topics */}
              <View className="mt-4 p-3 bg-secondary/50 rounded-lg">
                <Text className="text-xs text-muted-foreground text-center">
                  Tap a skill to generate its learning roadmap
                </Text>
              </View>
            </CardContent>
          </Card>

          {/* Topics by Category */}
          {topicsByCategory && Object.entries(topicsByCategory).map(([category, topics]) => (
            <Card key={category}>
              <CardHeader>
                <View className="flex-row items-center justify-between">
                  <CardTitle>{category}</CardTitle>
                  <Badge className={getCategoryColor(category)}>
                    <Text className="text-xs">{topics.length} skills</Text>
                  </Badge>
                </View>
              </CardHeader>
              <CardContent>
                <View className="gap-3">
                  {topics.map((topic) => (
                    <Pressable
                      key={topic.id}
                      onPress={() => handleTopicPress(topic as CareerTopic)}
                      className="border border-border rounded-lg p-4 active:bg-secondary/50"
                    >
                      <View className="flex-row items-start justify-between">
                        <View className="flex-1">
                          <View className="flex-row items-center gap-2 mb-1">
                            {topic.linkedRoadmapId ? (
                              <MapIcon size={16} color="#22c55e" />
                            ) : topic.isCompleted ? (
                              <CheckCircle2 size={16} color="#22c55e" />
                            ) : (
                              <Circle size={16} color={isDarkColorScheme ? '#71717a' : '#a1a1aa'} />
                            )}
                            <Text className="font-semibold text-foreground flex-1">
                              {topic.name}
                            </Text>
                            <ChevronRight size={16} color={isDarkColorScheme ? '#71717a' : '#a1a1aa'} />
                          </View>
                          
                          {topic.description && (
                            <Text className="text-sm text-muted-foreground mt-1 leading-5">
                              {topic.description}
                            </Text>
                          )}

                          <View className="flex-row items-center gap-2 mt-2 flex-wrap">
                            <Badge className={getDifficultyColor(topic.difficulty)}>
                              <Text className="text-xs">{topic.difficulty}</Text>
                            </Badge>
                            <Text className="text-xs text-muted-foreground">
                              {topic.estimatedHours}h
                            </Text>
                            {topic.isCore && (
                              <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400">
                                <Text className="text-xs">Core</Text>
                              </Badge>
                            )}
                            {topic.linkedRoadmapId && (
                              <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                                <Text className="text-xs">Roadmap Ready</Text>
                              </Badge>
                            )}
                          </View>

                          {topic.prerequisites.length > 0 && (
                            <View className="flex-row items-center gap-1 mt-2">
                              <Lock size={12} color={isDarkColorScheme ? '#71717a' : '#a1a1aa'} />
                              <Text className="text-xs text-muted-foreground">
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
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
