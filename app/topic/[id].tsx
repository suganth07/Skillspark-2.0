import React, { useState } from 'react';
import { View, ActivityIndicator, ScrollView } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ErrorDisplay } from '@/components/ui/error-display';
import { Badge } from '@/components/ui/badge';
import { useCurrentUserId } from '@/hooks/stores/useUserStoreV2';
import { useTopicDetail, type SubtopicPerformance } from '@/hooks/queries/useTopicQueries';
import { ChevronDown, ChevronUp, BookOpen, Code, Lightbulb } from 'lucide-react-native';

export default function TopicDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const currentUserId = useCurrentUserId();
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

  // TanStack Query hook - automatic caching, loading, and error states
  const { 
    data: currentTopicDetail, 
    isLoading, 
    error,
    refetch 
  } = useTopicDetail(id, currentUserId || undefined);

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
          error={error instanceof Error ? error.message : String(error)}
          onRetry={() => refetch()}
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

  const { topic, explanation, subtopicPerformance } = currentTopicDetail;
  
  console.log('📊 Subtopic Performance Map:', subtopicPerformance);
  console.log('📊 Performance Map size:', subtopicPerformance?.size);
  
  const getPerformanceForSubtopic = (subtopicId: string) => {
    const perf = subtopicPerformance?.get(subtopicId);
    console.log(`📊 Getting performance for subtopic ${subtopicId}:`, perf);
    return perf;
  };
  
  const getPerformanceColor = (status: string) => {
    switch (status) {
      case 'strong': return 'text-green-600';
      case 'weak': return 'text-red-600';
      case 'neutral': return 'text-yellow-600';
      default: return 'text-gray-600';
    }
  };
  
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
                  const performance = getPerformanceForSubtopic(subtopic.id);
                  
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
                        <View className="flex-1 flex-row items-center space-x-2">
                          <Text className="font-semibold text-base text-left flex-1">
                            {index + 1}. {subtopic.title}
                          </Text>
                          <View className={`px-2 py-1 rounded ${
                            performance 
                              ? (performance.status === 'strong' ? 'bg-green-100' :
                                 performance.status === 'weak' ? 'bg-red-100' :
                                 'bg-yellow-100')
                              : 'bg-gray-100'
                          }`}>
                            <Text className={`text-xs font-bold ${
                              performance
                                ? (performance.status === 'strong' ? 'text-green-700' :
                                   performance.status === 'weak' ? 'text-red-700' :
                                   'text-yellow-700')
                                : 'text-gray-600'
                            }`}>
                              {performance 
                                ? `${performance.correctCount}/${performance.totalAttempts}` 
                                : 'No quiz'}
                            </Text>
                          </View>
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
        </View>
      </ScrollView>
    </View>
  );
}
