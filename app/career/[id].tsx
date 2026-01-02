import React, { useState } from 'react';
import { View, ActivityIndicator, Pressable } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScrollView } from 'react-native-gesture-handler';
import { Text } from '@/components/ui/text';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ErrorDisplay } from '@/components/ui/error-display';
import { useCareerPathDetail } from '@/hooks/queries/useCareerQueries';
import { useCurrentUserId } from '@/hooks/stores/useUserStore';
import { ArrowLeft, CheckCircle2, Circle, Lock } from 'lucide-react-native';
import { useColorScheme } from '@/lib/useColorScheme';

export default function CareerPathDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const currentUserId = useCurrentUserId();
  const { isDarkColorScheme } = useColorScheme();
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch career path details
  const { 
    data: careerPath, 
    isLoading,
    error,
    refetch 
  } = useCareerPathDetail(id, currentUserId || undefined);

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'basic': return 'bg-green-100 text-green-800';
      case 'intermediate': return 'bg-yellow-100 text-yellow-800';
      case 'advanced': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getCategoryColor = (category: string) => {
    const colors = [
      'bg-blue-100 text-blue-800',
      'bg-purple-100 text-purple-800',
      'bg-pink-100 text-pink-800',
      'bg-indigo-100 text-indigo-800',
      'bg-cyan-100 text-cyan-800',
    ];
    const index = category.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[index % colors.length];
  };

  // Group topics by category
  const topicsByCategory = careerPath?.topics.reduce((acc, topic) => {
    if (!acc[topic.category]) {
      acc[topic.category] = [];
    }
    acc[topic.category].push(topic);
    return acc;
  }, {} as Record<string, typeof careerPath.topics>);

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-background" edges={['top']}>
        <Stack.Screen 
          options={{ 
            headerShown: false,
          }} 
        />
        <View className="flex-row items-center px-4 py-3 border-b border-border">
          <Pressable 
            onPress={() => router.back()}
            className="h-9 w-9 items-center justify-center rounded-lg active:bg-secondary"
          >
            <ArrowLeft size={20} color={isDarkColorScheme ? '#fafafa' : '#0a0a0a'} />
          </Pressable>
          <Text className="text-lg font-semibold flex-1 ml-3">
            Loading...
          </Text>
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
        <Stack.Screen 
          options={{ 
            headerShown: false,
          }} 
        />
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
        <Stack.Screen 
          options={{ 
            headerShown: false,
          }} 
        />
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

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <Stack.Screen 
        options={{ 
          headerShown: false,
        }} 
      />
      
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
        <View className="p-6 space-y-6">
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
              <View className="flex-row items-center gap-4">
                <View>
                  <Text className="text-2xl font-bold text-primary">
                    {careerPath.topics.length}
                  </Text>
                  <Text className="text-xs text-muted-foreground">Topics</Text>
                </View>
                <View>
                  <Text className="text-2xl font-bold text-primary">
                    {careerPath.totalEstimatedHours}h
                  </Text>
                  <Text className="text-xs text-muted-foreground">Est. Time</Text>
                </View>
                <View>
                  <Text className="text-2xl font-bold text-primary">
                    {careerPath.progress}%
                  </Text>
                  <Text className="text-xs text-muted-foreground">Complete</Text>
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
            </CardContent>
          </Card>

          {/* Topics by Category */}
          {topicsByCategory && Object.entries(topicsByCategory).map(([category, topics]) => (
            <Card key={category}>
              <CardHeader>
                <View className="flex-row items-center justify-between">
                  <CardTitle>{category}</CardTitle>
                  <Badge className={getCategoryColor(category)}>
                    <Text className="text-xs">{topics.length} topics</Text>
                  </Badge>
                </View>
              </CardHeader>
              <CardContent>
                <View className="space-y-3">
                  {topics.map((topic, index) => (
                    <Pressable
                      key={topic.id}
                      // TODO: Navigate to topic detail when implemented
                      onPress={() => {
                        alert('Topic content generation coming soon!');
                      }}
                      className="border border-border rounded-lg p-4 active:bg-secondary/50"
                    >
                      <View className="flex-row items-start justify-between">
                        <View className="flex-1">
                          <View className="flex-row items-center gap-2 mb-1">
                            {topic.isCompleted ? (
                              <CheckCircle2 size={16} className="text-green-600" />
                            ) : (
                              <Circle size={16} className="text-muted-foreground" />
                            )}
                            <Text className="font-semibold text-foreground flex-1">
                              {topic.name}
                            </Text>
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
                              <Badge className="bg-purple-100 text-purple-800">
                                <Text className="text-xs">Core</Text>
                              </Badge>
                            )}
                          </View>

                          {topic.prerequisites.length > 0 && (
                            <View className="flex-row items-center gap-1 mt-2">
                              <Lock size={12} className="text-muted-foreground" />
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
