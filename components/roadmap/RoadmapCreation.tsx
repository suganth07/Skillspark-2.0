import React, { useState } from 'react';
import { View, Alert } from 'react-native';
import { Text } from '@/components/ui/text';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ErrorDisplay } from '@/components/ui/error-display';
import { ScrollView } from 'react-native-gesture-handler';
import { useUserStore } from '@/hooks/stores/useUserStore';
import { useRoadmapStore } from '@/hooks/stores/useRoadmapStore';
import { ActivityIndicator } from 'react-native';

interface RoadmapCreationProps {
  onRoadmapCreated?: (roadmapId: string) => void;
}

export function RoadmapCreation({ onRoadmapCreated }: RoadmapCreationProps) {
  const [topic, setTopic] = useState('');
  const { currentUser } = useUserStore();
  const { isGenerating, generationProgress, generateCompleteRoadmap, error, clearError } = useRoadmapStore();

  const handleGenerateRoadmap = async () => {
    if (!topic.trim()) {
      Alert.alert('Error', 'Please enter a topic to learn');
      return;
    }

    if (!currentUser) {
      Alert.alert('Error', 'Please select a user account first');
      return;
    }

    clearError(); // Clear any previous errors
    
    try {
      const roadmapId = await generateCompleteRoadmap(currentUser.id, topic.trim());
      
      Alert.alert(
        'Success!', 
        `🎉 Successfully created learning roadmap for ${topic}! Click on prerequisites to generate quizzes.`,
        [
          {
            text: 'Start Learning',
            onPress: () => {
              onRoadmapCreated?.(roadmapId);
            }
          }
        ]
      );
      
      setTopic('');
      
    } catch (error) {
      // Error is already handled in the store, just log it
      console.error('Failed to generate roadmap:', error);
    }
  };

  const suggestedTopics = [
    'React', 'Python', 'Machine Learning', 'Node.js', 'Flutter', 
    'Data Science', 'Web Development', 'Mobile Development', 'DevOps',
    'Database Design', 'UI/UX Design', 'Cybersecurity'
  ];

  return (
    <ScrollView className="flex-1 p-6 bg-background">
      <View className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Create Learning Roadmap</CardTitle>
            <CardDescription>
              Enter any topic you want to learn, and we'll create a personalized roadmap with prerequisites, quizzes, and progress tracking.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <View>
              <Text className="text-sm font-medium mb-2">What do you want to learn?</Text>
              <Input
                value={topic}
                onChangeText={setTopic}
                placeholder="e.g., React, Machine Learning, Python..."
                editable={!isGenerating}
              />
            </View>

            {isGenerating && (
              <View className="space-y-3 p-4 bg-muted rounded-lg">
                <View className="flex-row items-center space-x-2">
                  <ActivityIndicator size="small" />
                  <Text className="text-sm text-muted-foreground">Creating your roadmap...</Text>
                </View>
                {generationProgress && (
                  <Text className="text-xs text-muted-foreground">{generationProgress}</Text>
                )}
              </View>
            )}

            {error && (
              <ErrorDisplay
                error={error}
                onRetry={() => handleGenerateRoadmap()}
                variant="inline"
              />
            )}

            <Button 
              onPress={handleGenerateRoadmap}
              disabled={isGenerating || !topic.trim()}
              className="w-full"
            >
              <Text className="text-white font-medium">
                {isGenerating ? 'Generating...' : '🚀 Generate Roadmap'}
              </Text>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Popular Topics</CardTitle>
            <CardDescription>
              Need inspiration? Try one of these popular learning topics:
            </CardDescription>
          </CardHeader>
          <CardContent>
            <View className="flex-row flex-wrap gap-2">
              {suggestedTopics.map((suggestedTopic) => (
                <Button
                  key={suggestedTopic}
                  variant="outline"
                  size="sm"
                  onPress={() => setTopic(suggestedTopic)}
                  disabled={isGenerating}
                >
                  <Text className="text-sm">{suggestedTopic}</Text>
                </Button>
              ))}
            </View>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>How it works</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <View className="flex-row items-start space-x-3">
              <Text className="text-lg">📊</Text>
              <View className="flex-1">
                <Text className="font-medium">Knowledge Analysis</Text>
                <Text className="text-sm text-muted-foreground">
                  AI analyzes your topic and identifies all prerequisites
                </Text>
              </View>
            </View>
            
            <View className="flex-row items-start space-x-3">
              <Text className="text-lg">📚</Text>
              <View className="flex-1">
                <Text className="font-medium">Structured Learning Path</Text>
                <Text className="text-sm text-muted-foreground">
                  Prerequisites organized by difficulty (Basic → Intermediate → Advanced)
                </Text>
              </View>
            </View>
            
            <View className="flex-row items-start space-x-3">
              <Text className="text-lg">🧩</Text>
              <View className="flex-1">
                <Text className="font-medium">On-Demand Quizzes</Text>
                <Text className="text-sm text-muted-foreground">
                  Click on any prerequisite to instantly generate a personalized quiz
                </Text>
              </View>
            </View>
            
            <View className="flex-row items-start space-x-3">
              <Text className="text-lg">🎯</Text>
              <View className="flex-1">
                <Text className="font-medium">Progress Tracking</Text>
                <Text className="text-sm text-muted-foreground">
                  Unlock new topics as you master prerequisites
                </Text>
              </View>
            </View>
          </CardContent>
        </Card>
      </View>
    </ScrollView>
  );
}