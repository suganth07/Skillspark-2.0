import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, ScrollView } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ErrorDisplay } from '@/components/ui/error-display';
import { Badge } from '@/components/ui/badge';
import { useUserStore } from '@/hooks/stores/useUserStore';
import { getTopicById, getRoadmapByTopicId, createSubtopics, getSubtopics, getUserSubtopicPerformance } from '@/server/queries/topics';
import { geminiService, type TopicExplanation } from '@/lib/gemini';
import { ChevronDown, ChevronUp, BookOpen, Code, Lightbulb } from 'lucide-react-native';

interface SubtopicPerformance {
  subtopicId: string;
  correctCount: number;
  incorrectCount: number;
  totalAttempts: number;
  status: 'weak' | 'strong' | 'neutral';
  accuracy: number;
}

interface TopicDetail {
  topic: {
    id: string;
    name: string;
    description: string | null;
    category: string;
  };
  explanation: TopicExplanation;
  subtopicPerformance: Map<string, SubtopicPerformance>;
}

export default function TopicDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { currentUser } = useUserStore();
  const [currentTopicDetail, setCurrentTopicDetail] = useState<TopicDetail | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

  const clearError = () => setError(null);

  const loadTopicDetail = async (topicId: string, userId: string) => {
    try {
      setIsLoading(true);
      setError(null);

      // Get topic from database
      const topic = await getTopicById(topicId);
      
      if (!topic) {
        throw new Error('Topic not found');
      }

      // Get roadmap context for better explanation
      const roadmap = await getRoadmapByTopicId(topicId, userId);
      const context = roadmap?.title || topic.category;

      // Get user's performance for subtopics
      const performanceData = await getUserSubtopicPerformance(userId, topicId);
      const performanceMap = new Map<string, SubtopicPerformance>();
      
      performanceData.forEach(perf => {
        const totalAttempts = perf.totalAttempts ?? 0;
        const correctCount = perf.correctCount ?? 0;
        const incorrectCount = perf.incorrectCount ?? 0;
        
        const accuracy = totalAttempts > 0 
          ? Math.round((correctCount / totalAttempts) * 100) 
          : 0;
        const validStatuses = ['weak', 'strong', 'neutral'] as const;
        const status = validStatuses.includes(perf.status as any) 
          ? (perf.status as 'weak' | 'strong' | 'neutral')
          : 'neutral';
        
        performanceMap.set(perf.subtopicId, {
          subtopicId: perf.subtopicId,
          correctCount,
          incorrectCount,
          totalAttempts,
          status,
          accuracy
        });
      });

      console.log(`📊 Loaded performance data for ${performanceMap.size} subtopics`);

      // Check if subtopics already exist in database
      const existingSubtopics = await getSubtopics(topicId);
      
      if (existingSubtopics.length > 0) {
        console.log(`📚 Loading ${existingSubtopics.length} subtopics from database`);
        
        // If user has performance data, regenerate content with adaptive explanations
        if (performanceMap.size > 0) {
          console.log(`🔄 Regenerating content with performance-based adaptations`);

          // Prepare subtopic guidance with names
          const subtopicGuidance = existingSubtopics.map(st => {
            const perf = performanceMap.get(st.id);
            return {
              subtopicName: st.name,
              status: perf?.status || 'neutral',
              accuracy: perf?.accuracy || 0
            };
          });
          
          // Regenerate explanation with performance guidance
          const explanation = await geminiService.generateTopicExplanation(
            topic.name,
            context,
            subtopicGuidance
          );
          
          // Map AI-generated subtopics back to database IDs
          const dbSubtopicsByName = new Map(
            existingSubtopics.map(st => [st.name.toLowerCase(), st.id])
          );
          explanation.subtopics = explanation.subtopics.map((aiSubtopic) => {
            const dbId = dbSubtopicsByName.get(aiSubtopic.title.toLowerCase());
            return {
              ...aiSubtopic,
              id: dbId || aiSubtopic.id
            };
          });
          
          setCurrentTopicDetail({ topic, explanation, subtopicPerformance: performanceMap });
          setIsLoading(false);
          return;
        }
        
        // No performance data, load from database as-is
        const topicMetadata = JSON.parse(topic.metadata as string || '{}');
        
        const explanation: TopicExplanation = {
          topicName: topic.name,
          overview: topic.description || '',
          difficulty: topicMetadata.difficulty || 'intermediate',
          subtopics: existingSubtopics.map(st => {
            let metadata: Record<string, any> = {};
            try {
              metadata = JSON.parse(st.metadata as string || '{}');
            } catch {
              console.warn(`Failed to parse subtopic metadata for ${st.id}`);
            }
            return {
              id: st.id,
              title: st.name,
              explanation: st.description || '',
              example: metadata.example,
              exampleExplanation: metadata.exampleExplanation,
              keyPoints: metadata.keyPoints
            };
          }),
          bestPractices: topicMetadata.bestPractices,
          commonPitfalls: topicMetadata.commonPitfalls,
          whyLearn: topicMetadata.whyLearn
        };
        
        setCurrentTopicDetail({ topic, explanation, subtopicPerformance: performanceMap });
        setIsLoading(false);
        return;
      }

      // Generate explanation using Gemini
      console.log(`🤖 Generating explanation for topic: ${topic.name}`);
      
      const explanation = await geminiService.generateTopicExplanation(
        topic.name,
        context
      );

      // Store subtopics in database
      console.log(`💾 Storing ${explanation.subtopics.length} subtopics in database...`);
      await createSubtopics(topicId, topic.category, explanation);

      setCurrentTopicDetail({ topic, explanation, subtopicPerformance: performanceMap });
      setIsLoading(false);

      console.log(`✅ Topic explanation loaded with ${explanation.subtopics.length} subtopics`);
    } catch (err) {
      console.error('Failed to load topic detail:', err);
      
      let errorMessage = 'Failed to load topic details';
      if (err instanceof Error) {
        if (err.message.toLowerCase().includes('overloaded') || 
            err.message.toLowerCase().includes('quota') ||
            err.message.toLowerCase().includes('rate limit')) {
          errorMessage = 'AI service is temporarily overloaded. Please try again in a few minutes.';
        } else if (err.message.toLowerCase().includes('network') || 
                   err.message.toLowerCase().includes('fetch')) {
          errorMessage = 'Failed to connect. Please check your internet connection.';
        } else {
          errorMessage = err.message;
        }
      }
      
      setError(errorMessage);
      setIsLoading(false);
      setCurrentTopicDetail(null);
    }
  };

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
