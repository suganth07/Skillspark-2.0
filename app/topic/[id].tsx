import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, ScrollView } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ErrorDisplay } from '@/components/ui/error-display';
import { Badge } from '@/components/ui/badge';
import { useTopicStore } from '@/hooks/stores/useTopicStore';
import { useUserStore } from '@/hooks/stores/useUserStore';
import { ChevronDown, ChevronUp, BookOpen, Code, Lightbulb } from 'lucide-react-native';

export default function TopicDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { currentUser } = useUserStore();
  const { 
    currentTopicDetail, 
    isLoading, 
    error, 
    loadTopicDetail,
    clearError 
  } = useTopicStore();

  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (currentUser && id) {
      loadTopicDetail(id, currentUser.id);
    }
  }, [id, currentUser]);

  const toggleSection = (sectionId: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(sectionId)) {
      newExpanded.delete(sectionId);
    } else {
      newExpanded.add(sectionId);
    }
    setExpandedSections(newExpanded);
  };

  if (isLoading) {
    return (
      <View className="flex-1 bg-background">
        <Stack.Screen 
          options={{ 
            title: 'Loading...',
            headerBackTitle: 'Back'
          }} 
        />
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" />
          <Text className="mt-4 text-muted-foreground">Loading topic details...</Text>
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View className="flex-1 bg-background">
        <Stack.Screen 
          options={{ 
            title: 'Error',
            headerBackTitle: 'Back'
          }} 
        />
        <ErrorDisplay
          error={error}
          onRetry={() => currentUser && id && loadTopicDetail(id, currentUser.id)}
          title="Failed to load topic details"
        />
      </View>
    );
  }

  if (!currentTopicDetail) {
    return (
      <View className="flex-1 bg-background justify-center items-center p-6">
        <Stack.Screen 
          options={{ 
            title: 'Topic Not Found',
            headerBackTitle: 'Back'
          }} 
        />
        <Text className="text-center text-muted-foreground">Topic details not available</Text>
        <Button onPress={() => router.back()} className="mt-4">
          <Text className="text-white">Go Back</Text>
        </Button>
      </View>
    );
  }

  const { topic, explanation } = currentTopicDetail;
  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'basic': return 'bg-green-100 text-green-800';
      case 'intermediate': return 'bg-yellow-100 text-yellow-800';
      case 'advanced': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <View className="flex-1 bg-background">
      <Stack.Screen 
        options={{ 
          title: topic.name,
          headerBackTitle: 'Back'
        }} 
      />
      
      <ScrollView className="flex-1">
        <View className="p-6 space-y-6">
          {/* Header */}
          <Card>
            <CardHeader>
              <View className="flex-row items-center justify-between mb-2">
                <CardTitle className="flex-1">{topic.name}</CardTitle>
                {explanation.difficulty && (
                  <Badge className={getDifficultyColor(explanation.difficulty)}>
                    <Text className="text-xs font-medium">
                      {explanation.difficulty}
                    </Text>
                  </Badge>
                )}
              </View>
              <Text className="text-muted-foreground mt-2 leading-6">
                {explanation.overview}
              </Text>
            </CardHeader>
          </Card>

        

          {/* Subtopics */}
          <Card>
            <CardHeader>
              <View className="flex-row items-center space-x-2 mb-2">
                <BookOpen className="h-5 w-5 text-blue-600" />
                <CardTitle>Key Concepts</CardTitle>
              </View>
              <Text className="text-sm text-muted-foreground">
                Tap each concept to learn more
              </Text>
            </CardHeader>
            <CardContent>
              <View className="space-y-3">
                {explanation.subtopics.map((subtopic, index) => {
                  const isExpanded = expandedSections.has(subtopic.id);
                  
                  return (
                    <View 
                      key={subtopic.id}
                      className="border border-border rounded-lg overflow-hidden"
                    >
                      {/* Accordion Header */}
                      <Button
                        variant="ghost"
                        onPress={() => toggleSection(subtopic.id)}
                        className="w-full flex-row items-center justify-between p-4 rounded-none"
                      >
                        <View className="flex-1">
                          <Text className="font-semibold text-base text-left">
                            {index + 1}. {subtopic.title}
                          </Text>
                        </View>
                        {isExpanded ? (
                          <ChevronUp className="h-5 w-5 text-muted-foreground ml-2" />
                        ) : (
                          <ChevronDown className="h-5 w-5 text-muted-foreground ml-2" />
                        )}
                      </Button>

                      {/* Accordion Content */}
                      {isExpanded && (
                        <View className="px-4 pb-4 pt-2 border-t border-border bg-muted/30">
                          <Text className="text-muted-foreground leading-6 mb-4">
                            {subtopic.explanation}
                          </Text>

                          {subtopic.example && (
                            <View className="mt-3">
                              <View className="flex-row items-center space-x-2 mb-2">
                                <Code className="h-4 w-4 text-green-600" />
                                <Text className="text-sm font-semibold text-green-600">
                                  Example:
                                </Text>
                              </View>
                              <View className="bg-slate-900 rounded-lg p-4">
                                <Text className="text-slate-100 font-mono text-sm leading-6">
                                  {subtopic.example}
                                </Text>
                              </View>
                              
                              {subtopic.exampleExplanation && (
                                <Text className="text-sm text-muted-foreground mt-2 italic">
                                  💡 {subtopic.exampleExplanation}
                                </Text>
                              )}
                            </View>
                          )}

                          {subtopic.keyPoints && subtopic.keyPoints.length > 0 && (
                            <View className="mt-3">
                              <Text className="text-sm font-semibold mb-2">Key Points:</Text>
                              {subtopic.keyPoints.map((point, idx) => (
                                <View key={idx} className="flex-row items-start space-x-2 mb-1">
                                  <Text className="text-muted-foreground">•</Text>
                                  <Text className="flex-1 text-sm text-muted-foreground">
                                    {point}
                                  </Text>
                                </View>
                              ))}
                            </View>
                          )}
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
            </CardContent>
          </Card>

          {/* Best Practices */}
          {explanation.bestPractices && explanation.bestPractices.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Best Practices</CardTitle>
              </CardHeader>
              <CardContent>
                <View className="space-y-2">
                  {explanation.bestPractices.map((practice, index) => (
                    <View key={index} className="flex-row items-start space-x-3">
                      <View className="bg-green-100 rounded-full w-6 h-6 items-center justify-center mt-0.5">
                        <Text className="text-green-700 font-bold text-xs">{index + 1}</Text>
                      </View>
                      <Text className="flex-1 text-muted-foreground leading-6">
                        {practice}
                      </Text>
                    </View>
                  ))}
                </View>
              </CardContent>
            </Card>
          )}

          {/* Common Pitfalls */}
          {explanation.commonPitfalls && explanation.commonPitfalls.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Common Pitfalls to Avoid</CardTitle>
              </CardHeader>
              <CardContent>
                <View className="space-y-2">
                  {explanation.commonPitfalls.map((pitfall, index) => (
                    <View key={index} className="flex-row items-start space-x-3">
                      <View className="bg-red-100 rounded-full w-6 h-6 items-center justify-center mt-0.5">
                        <Text className="text-red-700 font-bold text-xs">!</Text>
                      </View>
                      <Text className="flex-1 text-muted-foreground leading-6">
                        {pitfall}
                      </Text>
                    </View>
                  ))}
                </View>
              </CardContent>
            </Card>
          )}

          {/* Additional Resources */}
          {explanation.resources && explanation.resources.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Learn More</CardTitle>
              </CardHeader>
              <CardContent>
                <View className="space-y-2">
                  {explanation.resources.map((resource, index) => (
                    <Text key={index} className="text-sm text-blue-600">
                      • {resource}
                    </Text>
                  ))}
                </View>
              </CardContent>
            </Card>
          )}
        </View>
      </ScrollView>
    </View>
  );
}
