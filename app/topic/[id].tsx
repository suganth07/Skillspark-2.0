import React, { useState, useEffect } from 'react';
import { View, ActivityIndicator, ScrollView, Pressable, Alert } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ErrorDisplay } from '@/components/ui/error-display';
import { Badge } from '@/components/ui/badge';
import { useCurrentUserId } from '@/hooks/stores/useUserStore';
import { useIsEmotionDetectionEnabled } from '@/hooks/stores/useEmotionStore';
import { useIsGeneratedVideosEnabled } from '@/hooks/stores/useGeneratedVideosStore';
import { useTopicDetail, usePersistTopicContent, useRegenerateSingleTone, type SubtopicPerformance } from '@/hooks/queries/useTopicQueries';
import { searchTopicUpdates } from '@/server/langSearchClient';
import { TopicEmotionDetector } from '@/components/emotion/TopicEmotionDetector';
import { TopicVideoGenerator } from '@/components/topic/TopicVideoGenerator';
import { ChevronDown, ChevronUp, BookOpen, Code, Lightbulb, Sparkles, AlertCircle, RefreshCw, Loader2, Search, ExternalLink } from 'lucide-react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

type ContentVersion = 'default' | 'simplified' | 'story';

// Component to render markdown text with clickable links
function MarkdownText({ text }: { text: string }) {
  const parts: Array<{ text: string; url?: string }> = [];
  
  // Parse markdown links: [text](url)
  const regex = /\[([^\]]+)\]\(([^)]+)\)/g;
  let lastIndex = 0;
  let match;
  
  while ((match = regex.exec(text)) !== null) {
    // Add text before the link
    if (match.index > lastIndex) {
      parts.push({ text: text.substring(lastIndex, match.index) });
    }
    // Add the link
    parts.push({ text: match[1], url: match[2] });
    lastIndex = regex.lastIndex;
  }
  
  // Add remaining text
  if (lastIndex < text.length) {
    parts.push({ text: text.substring(lastIndex) });
  }
  
  if (parts.length === 0) {
    parts.push({ text });
  }
  
  return (
    <View className="flex-row flex-wrap ml-2">
      <Text className="text-sm text-foreground">• </Text>
      {parts.map((part, index) => (
        part.url ? (
          <Pressable
            key={index}
            onPress={async () => {
              try {
                await WebBrowser.openBrowserAsync(part.url!);
              } catch (error) {
                console.error('Error opening URL:', error);
                Alert.alert('Error', 'Could not open link');
              }
            }}
            className="active:opacity-70"
          >
            <Text className="text-sm text-blue-500 underline">
              {part.text}
            </Text>
          </Pressable>
        ) : (
          <Text key={index} className="text-sm text-foreground">
            {part.text}
          </Text>
        )
      ))}
    </View>
  );
}

export default function TopicDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const currentUserId = useCurrentUserId();
  const isEmotionDetectionEnabled = useIsEmotionDetectionEnabled();
  const isGeneratedVideosEnabled = useIsGeneratedVideosEnabled();
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [subtopicVersions, setSubtopicVersions] = useState<Record<string, ContentVersion>>({});
  const [hasPersistedContent, setHasPersistedContent] = useState(false);
  const [webSearchResults, setWebSearchResults] = useState<string[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);

  // TanStack Query hook - automatic caching, loading, and error states
  const { 
    data: currentTopicDetail, 
    isLoading,
    isFetching,
    error,
    refetch 
  } = useTopicDetail(id, currentUserId || undefined);

  // Mutation to persist content to database
  const persistContentMutation = usePersistTopicContent();
  
  // Mutation to regenerate a single failed tone
  const regenerateToneMutation = useRegenerateSingleTone();

  // Show regeneration loading when fetching but already have data (refetching/regenerating)
  const isRegenerating = isFetching && !isLoading;

  // Persist content to database when it's generated (idempotent via server check)
  useEffect(() => {
    if (!currentTopicDetail || !currentUserId) {
      console.log('⏭️ Skipping persistence: missing topicDetail or userId');
      return;
    }

    const { topic, explanation, subtopicPerformance } = currentTopicDetail;
    
    // Log subtopic IDs for debugging
    console.log('🔍 Checking subtopic IDs:', explanation.subtopics.map(st => ({ id: st.id, title: st.title })));
    
    // Check if content was loaded from database vs freshly generated
    // Database content has CUID IDs (from createId()) which are 24-25 chars starting with 'c'
    // Fresh AI content has slugified IDs like "variables-and-expressions" or "subtopic-1"
    const isCUID = (id: string): boolean => {
      // CUIDs are 24-25 characters long and start with 'c' followed by alphanumeric
      return id.length >= 24 && /^c[a-z0-9]+$/.test(id);
    };
    
    const isFromDatabase = explanation.subtopics.some(st => st.id && isCUID(st.id));
    
    console.log(`🔍 Persistence check:
      - Subtopics count: ${explanation.subtopics.length}
      - Has persisted already: ${hasPersistedContent}
      - Is from database: ${isFromDatabase}
      - Sample ID: ${explanation.subtopics[0]?.id}
    `);
    
    // Only persist if:
    // 1. Content was generated (subtopics exist)
    // 2. NOT already saved locally this session (hasPersistedContent guard)
    // 3. Content is freshly generated from AI (not from database)
    const needsPersistence = explanation.subtopics.length > 0 && 
                             !hasPersistedContent && 
                             !isFromDatabase;
    
    // Derive regeneration from server state (subtopicPerformance exists = came from quiz)
    const isRegeneration = subtopicPerformance.size > 0;
    
    console.log(`🎯 Persistence decision: ${needsPersistence ? 'YES - will persist' : 'NO - skipping'}`);
    
    if (needsPersistence) {
      console.log('🔄 Persisting generated content to database...');
      console.log('📦 Payload:', {
        topicId: topic.id,
        userId: currentUserId,
        category: topic.category,
        subtopicsCount: explanation.subtopics.length,
        isRegeneration,
      });
      
      persistContentMutation.mutate({
        topicId: topic.id,
        userId: currentUserId,
        category: topic.category,
        explanation,
        isRegeneration,
      }, {
        onSuccess: () => {
          console.log('✅ Content successfully persisted to database!');
          setHasPersistedContent(true);
        },
        onError: (err) => {
          console.error('❌ Failed to persist content:', err);
          console.error('Error details:', JSON.stringify(err, null, 2));
        }
      });
    }
  }, [currentTopicDetail, currentUserId, hasPersistedContent, persistContentMutation]);

  const toggleSection = (sectionId: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(sectionId)) {
      newExpanded.delete(sectionId);
    } else {
      newExpanded.add(sectionId);
    }
    setExpandedSections(newExpanded);
  };

  const setSubtopicVersion = (subtopicId: string, version: ContentVersion) => {
    setSubtopicVersions(prev => ({
      ...prev,
      [subtopicId]: version
    }));
  };

  const getSubtopicVersion = (subtopicId: string): ContentVersion => {
    return subtopicVersions[subtopicId] || 'default';
  };

  const handleWebSearch = async () => {
    if (!currentTopicDetail) return;
    
    setIsSearching(true);
    setShowSearchResults(true);
    
    try {
      console.log(`🔍 Starting web search for topic: ${topic.name}`);
      const result = await searchTopicUpdates(topic.name);
      
      console.log(`✅ Web search complete. Found ${result.newSubtopics.length} updates`);
      setWebSearchResults(result.newSubtopics);
      
      if (result.newSubtopics.length === 0) {
        Alert.alert(
          'No Updates Found',
          `No recent updates or changes were found for ${topic.name}.`,
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('❌ Web search failed:', error);
      Alert.alert(
        'Search Failed',
        error instanceof Error ? error.message : 'Failed to search for updates. Please try again.',
        [{ text: 'OK' }]
      );
      setShowSearchResults(false);
    } finally {
      setIsSearching(false);
    }
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
        <View className="flex-1 justify-center items-center px-6">
          <ActivityIndicator size="large" />
          <Text className="mt-4 text-muted-foreground text-center">Loading topic details...</Text>
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

  // Get content based on selected version for a specific subtopic
  const getSubtopicContent = (subtopic: any, subtopicId: string) => {
    const version = getSubtopicVersion(subtopicId);
    
    switch (version) {
      case 'simplified':
        return {
          explanation: subtopic.explanationSimplified || subtopic.explanationDefault || '',
          example: subtopic.exampleSimplified || subtopic.example,
        };
      case 'story':
        return {
          explanation: subtopic.explanationStory || subtopic.explanationDefault || '',
          example: subtopic.exampleStory || subtopic.example,
        };
      default:
        return {
          explanation: subtopic.explanationDefault || '',
          example: subtopic.example,
        };
    }
  };

  // Check if a specific content tone failed to generate
  const isContentFailed = (version: ContentVersion): boolean => {
    if (!explanation.failedTones) return false;
    return explanation.failedTones[version] || false;
  };

  // Check if a specific tone is currently being regenerated
  const isRegeneratingTone = (tone: ContentVersion): boolean => {
    return regenerateToneMutation.isPending && 
           regenerateToneMutation.variables?.tone === tone;
  };

  // Handler for regenerating a specific content tone
  const handleRegenerateContent = async (tone: ContentVersion) => {
    if (!currentUserId || !currentTopicDetail) return;
    
    console.log(`🔄 Regenerating ${tone} content...`);
    
    // Get canonical titles from existing subtopics
    const canonicalTitles = explanation.subtopics.map(st => st.title);
    
    // Get context from roadmap or category
    const context = topic.category;
    
    regenerateToneMutation.mutate({
      topicId: topic.id,
      userId: currentUserId,
      topicName: topic.name,
      context,
      tone,
      canonicalTitles,
    });
  };

  return (
    <View className="flex-1 bg-background">
      <Stack.Screen 
        options={{ 
          title: topic.name,
          headerBackTitle: 'Back'
        }} 
      />
      
      {/* Regeneration Loading Overlay */}
      {isRegenerating && (
        <Animated.View 
          entering={FadeIn.duration(200)}
          exiting={FadeOut.duration(200)}
          className="absolute inset-0 z-50 bg-background/90 justify-center items-center"
          style={{ zIndex: 50 }}
        >
          <Card className="mx-8 p-6">
            <View className="items-center">
              <View className="bg-primary/10 rounded-full p-4 mb-4">
                <Sparkles size={32} className="text-primary" />
              </View>
              <ActivityIndicator size="large" className="mb-4" />
              <Text className="text-lg font-semibold text-foreground text-center mb-2">
                Personalizing Content
              </Text>
              <Text className="text-sm text-muted-foreground text-center leading-relaxed">
                Regenerating learning material based on your quiz performance...
              </Text>
              <View className="flex-row flex-wrap justify-center gap-2 mt-4">
                <Badge className="bg-green-100">
                  <Text className="text-xs text-green-700">Strengthening weak areas</Text>
                </Badge>
                <Badge className="bg-blue-100">
                  <Text className="text-xs text-blue-700">Adapting to your level</Text>
                </Badge>
              </View>
            </View>
          </Card>
        </Animated.View>
      )}
      
      <ScrollView className="flex-1">
        <View className="p-6 space-y-6">
          {/* Content Generation Warning Banner */}
          {explanation.failedTones && (explanation.failedTones.default || explanation.failedTones.simplified || explanation.failedTones.story) && (
            <Card className="bg-yellow-50 border-yellow-200">
              <CardContent className="p-4">
                <View className="flex-row items-start space-x-3">
                  <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
                  <View className="flex-1">
                    <Text className="text-sm font-semibold text-yellow-900 mb-2">
                      Some content failed to generate
                    </Text>
                    
                    {/* Regenerate buttons for each failed tone */}
                    <View className="space-y-2">
                      {explanation.failedTones.default && (
                        <View className="flex-row items-center justify-between bg-yellow-100 rounded-lg p-2">
                          <Text className="text-xs text-yellow-800">Default content failed</Text>
                          <Button 
                            size="sm" 
                            variant="outline" 
                            className="h-7 px-2"
                            onPress={() => handleRegenerateContent('default')}
                            disabled={isRegeneratingTone('default')}
                          >
                            {isRegeneratingTone('default') ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <RefreshCw className="h-3 w-3 mr-1" />
                            )}
                            <Text className="text-xs">
                              {isRegeneratingTone('default') ? 'Regenerating...' : 'Regenerate'}
                            </Text>
                          </Button>
                        </View>
                      )}
                      
                      {explanation.failedTones.simplified && (
                        <View className="flex-row items-center justify-between bg-yellow-100 rounded-lg p-2">
                          <Text className="text-xs text-yellow-800">Simplified content failed</Text>
                          <Button 
                            size="sm" 
                            variant="outline" 
                            className="h-7 px-2"
                            onPress={() => handleRegenerateContent('simplified')}
                            disabled={isRegeneratingTone('simplified')}
                          >
                            {isRegeneratingTone('simplified') ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <RefreshCw className="h-3 w-3 mr-1" />
                            )}
                            <Text className="text-xs">
                              {isRegeneratingTone('simplified') ? 'Regenerating...' : 'Regenerate'}
                            </Text>
                          </Button>
                        </View>
                      )}
                      
                      {explanation.failedTones.story && (
                        <View className="flex-row items-center justify-between bg-yellow-100 rounded-lg p-2">
                          <Text className="text-xs text-yellow-800">Story content failed</Text>
                          <Button 
                            size="sm" 
                            variant="outline" 
                            className="h-7 px-2"
                            onPress={() => handleRegenerateContent('story')}
                            disabled={isRegeneratingTone('story')}
                          >
                            {isRegeneratingTone('story') ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <RefreshCw className="h-3 w-3 mr-1" />
                            )}
                            <Text className="text-xs">
                              {isRegeneratingTone('story') ? 'Regenerating...' : 'Regenerate'}
                            </Text>
                          </Button>
                        </View>
                      )}
                    </View>
                    
                    <Text className="text-xs text-yellow-600 mt-2">
                      Switch to working styles or regenerate failed content above.
                    </Text>
                  </View>
                </View>
              </CardContent>
            </Card>
          )}

          {/* Emotion Detection Card */}
          {isEmotionDetectionEnabled && (
            <TopicEmotionDetector 
              onEmotionDetected={(emotion, confidence) => {
                console.log(`📊 User emotion: ${emotion} (${(confidence * 100).toFixed(1)}%)`);
                // TODO: Store emotion data for analytics
              }}
            />
          )}

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

          {/* Video Generation Section */}
          {isGeneratedVideosEnabled && currentUserId && (
            <TopicVideoGenerator
              topicId={id!}
              topicName={topic.name}
              userId={currentUserId}
              subtopics={explanation.subtopics}
            />
          )}

          {/* Web Search for Latest Updates */}
          <Card>
            <CardHeader>
              <View className="flex-row items-center space-x-2 mb-2">
                <Search className="h-5 w-5 text-purple-600" />
                <CardTitle>Search Web for Updates</CardTitle>
              </View>
              <Text className="text-sm text-muted-foreground">
                Find the latest information, changes, and best practices about this topic from across the web.
              </Text>
            </CardHeader>
            <CardContent>
              <Button
                onPress={handleWebSearch}
                disabled={isSearching}
                className="w-full flex-row items-center justify-center space-x-2"
              >
                {isSearching ? (
                  <>
                    <ActivityIndicator size="small" color="white" />
                    <Text className="text-white font-medium ml-2">Searching...</Text>
                  </>
                ) : (
                  <>
                    <Search className="h-4 w-4 text-white" />
                    <Text className="text-white font-medium">Search Latest Updates</Text>
                  </>
                )}
              </Button>

              {/* Search Results */}
              {showSearchResults && webSearchResults.length > 0 && (
                <Animated.View
                  entering={FadeIn.duration(300)}
                  className="mt-4 p-4 bg-secondary/50 rounded-lg"
                >
                  <View className="flex-row items-center space-x-2 mb-3">
                    <ExternalLink className="h-4 w-4 text-primary" />
                    <Text className="text-sm font-semibold text-foreground">
                      Latest Updates Found ({webSearchResults.length})
                    </Text>
                  </View>
                  <View className="space-y-2">
                    {webSearchResults.map((update, idx) => (
                      <View key={idx} className="mb-2">
                        <MarkdownText text={update} />
                      </View>
                    ))}
                  </View>
                  <Pressable
                    onPress={() => setShowSearchResults(false)}
                    className="mt-3 py-2 px-3 bg-background rounded-lg active:opacity-70"
                  >
                    <Text className="text-xs text-center text-muted-foreground">
                      Hide Results
                    </Text>
                  </Pressable>
                </Animated.View>
              )}
            </CardContent>
          </Card>

          {/* Subtopics */}
          <Card>
            <CardHeader>
              <View className="flex-row items-center space-x-2 mb-2">
                <BookOpen className="h-5 w-5 text-blue-600" />
                <CardTitle>Key Concepts</CardTitle>
              </View>
              <Text className="text-sm text-muted-foreground">
                Tap each concept to learn more • Switch learning style per concept
              </Text>
            </CardHeader>
            <CardContent>
              <View className="space-y-3">
                {explanation.subtopics.map((subtopic, index) => {
                  const isExpanded = expandedSections.has(subtopic.id);
                  const performance = getPerformanceForSubtopic(subtopic.id);
                  const content = getSubtopicContent(subtopic, subtopic.id);
                  const currentVersion = getSubtopicVersion(subtopic.id);
                  
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
                        <View className="border-t border-border bg-muted/30">
                          {/* Per-Subtopic Style Switcher */}
                          <View className="px-4 pt-3 pb-2">
                            <View className="flex-row gap-2 mb-3">
                              <Button
                                variant={currentVersion === 'default' ? 'default' : 'outline'}
                                onPress={() => setSubtopicVersion(subtopic.id, 'default')}
                                className="flex-1 py-2"
                                size="sm"
                              >
                                <Text className={`text-xs ${currentVersion === 'default' ? 'text-white' : 'text-foreground'}`}>
                                  📚 Default
                                </Text>
                              </Button>
                              <Button
                                variant={currentVersion === 'simplified' ? 'default' : 'outline'}
                                onPress={() => setSubtopicVersion(subtopic.id, 'simplified')}
                                className="flex-1 py-2"
                                size="sm"
                              >
                                <Text className={`text-xs ${currentVersion === 'simplified' ? 'text-white' : 'text-foreground'}`}>
                                  🎯 Simplified
                                </Text>
                              </Button>
                              <Button
                                variant={currentVersion === 'story' ? 'default' : 'outline'}
                                onPress={() => setSubtopicVersion(subtopic.id, 'story')}
                                className="flex-1 py-2"
                                size="sm"
                              >
                                <Text className={`text-xs ${currentVersion === 'story' ? 'text-white' : 'text-foreground'}`}>
                                  📖 Story
                                </Text>
                              </Button>
                            </View>
                          </View>

                          {/* Content */}
                          <Animated.View 
                            key={`${subtopic.id}-${currentVersion}`}
                            entering={FadeIn.duration(300)}
                            className="px-4 pb-4"
                          >
                            {/* Show error if this specific tone failed */}
                            {isContentFailed(currentVersion) ? (
                              <View className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                                <View className="flex-row items-start space-x-3">
                                  <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
                                  <View className="flex-1">
                                    <Text className="text-sm font-semibold text-red-900 mb-1">
                                      Failed to generate {currentVersion} content
                                    </Text>
                                    <Text className="text-xs text-red-700 mb-3">
                                      An error occurred while generating this learning style. Try regenerating or switch to another style.
                                    </Text>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onPress={() => handleRegenerateContent(currentVersion)}
                                      className="border-red-300 self-start"
                                    >
                                      <View className="flex-row items-center space-x-2">
                                        <RefreshCw className="h-4 w-4 text-red-700" />
                                        <Text className="text-red-700 text-xs font-medium">
                                          Regenerate {currentVersion} content
                                        </Text>
                                      </View>
                                    </Button>
                                  </View>
                                </View>
                              </View>
                            ) : (
                              <>
                                <Text className="text-muted-foreground leading-6 mb-4">
                                  {content.explanation}
                                </Text>

                                {content.example && (
                                  <View className="mt-3">
                                    <View className="flex-row items-center space-x-2 mb-2">
                                      <Code className="h-4 w-4 text-green-600" />
                                      <Text className="text-sm font-semibold text-green-600">
                                        Example:
                                      </Text>
                                    </View>
                                    <View className="bg-slate-900 rounded-lg p-4">
                                      <Text className="text-slate-100 font-mono text-sm leading-6">
                                        {content.example}
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
                              </>
                            )}
                          </Animated.View>
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
