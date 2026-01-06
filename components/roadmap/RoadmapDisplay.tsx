import React, { useState, useCallback } from 'react';
import { View, Pressable, ActivityIndicator, Modal, Alert } from 'react-native';
import Animated, { FadeInDown, FadeIn, ZoomIn, FadeOut } from 'react-native-reanimated';
import * as WebBrowser from 'expo-web-browser';
import { Text } from '@/components/ui/text';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorDisplay } from '@/components/ui/error-display';
import { DeleteConfirmationDialog } from '@/components/ui/delete-confirmation-dialog';
import { ScrollView } from 'react-native-gesture-handler';
import { Progress } from '@/components/ui/progress';
import { useCurrentUserId } from '@/hooks/stores/useUserStore';
import { useRoadmapDetails, useDeleteRoadmap, useUpdateStepCompletion, useCheckTopicUpdates, useGenerateQuiz, useGenerateRevision } from '@/hooks/queries/useRoadmapQueries';
import { searchTopicUpdates } from '@/lib/webSearchService';
import { useWebSearchProvider } from '@/hooks/stores/useWebSearchProviderStore';
import type { RoadmapStep } from '@/server/queries/roadmaps';
import { 
  CheckCircle, 
  Circle, 
  Clock, 
  Sparkles, 
  Trophy,
  BookOpen,
  ChevronRight,
  Trash2,
  Rocket,
  RefreshCw,
  Search,
  ExternalLink,
  Brain,
} from 'lucide-react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { cn } from '@/lib/utils';

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

interface RoadmapDisplayProps {
  roadmapId: string;
  onTakeQuiz?: (quizId: string, stepTitle: string) => void;
  onViewResults?: (quizId: string, stepTitle: string) => void;
  onDelete?: () => void;
}

export function RoadmapDisplay({ roadmapId, onTakeQuiz, onViewResults, onDelete }: RoadmapDisplayProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showKnowledgeModal, setShowKnowledgeModal] = useState(false);
  const [showUpdatesModal, setShowUpdatesModal] = useState(false);
  const [topicUpdates, setTopicUpdates] = useState<any[]>([]);
  const [selectedStep, setSelectedStep] = useState<RoadmapStep | null>(null);
  const [showRevisionModal, setShowRevisionModal] = useState(false);
  const [revisionSummary, setRevisionSummary] = useState<any>(null);
  const [revisionQuizId, setRevisionQuizId] = useState<string | null>(null);
  const [revisionStep, setRevisionStep] = useState<'summary' | 'quiz'>('summary');
  const [generatingRevision, setGeneratingRevision] = useState(false);
  
  const userId = useCurrentUserId();
  const provider = useWebSearchProvider();
  const [generatingQuizForStep, setGeneratingQuizForStep] = useState<string | null>(null);
  const [webSearchResults, setWebSearchResults] = useState<string[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showWebSearchModal, setShowWebSearchModal] = useState(false);
  const router = useRouter();

  // TanStack Query hooks - automatic caching and refetching
  const { 
    data: currentRoadmap, 
    isLoading, 
    error,
    refetch 
  } = useRoadmapDetails(roadmapId, userId || undefined);
  
  const deleteRoadmapMutation = useDeleteRoadmap();
  const updateStepCompletionMutation = useUpdateStepCompletion();
  const checkTopicUpdatesMutation = useCheckTopicUpdates();
  const generateQuizMutation = useGenerateQuiz();
  const generateRevisionMutation = useGenerateRevision();

  // Reload roadmap details when returning from quiz
  useFocusEffect(
    useCallback(() => {
      if (userId && roadmapId) {
        refetch();
      }
    }, [roadmapId, userId, refetch])
  );

  const handleTakeQuiz = async (step: RoadmapStep) => {
    if (!userId) return;
    
    try {
      let quizId = step.quizId;
      
      // If no quiz exists, generate one
      if (!quizId) {
        setGeneratingQuizForStep(step.id);
        const result = await generateQuizMutation.mutateAsync({
          userId: userId,
          roadmapId,
          stepId: step.id,
          prerequisiteName: step.title
        });
        quizId = result.quizId;
        setGeneratingQuizForStep(null);
      }
      
      if (quizId) {
        onTakeQuiz?.(quizId, step.title);
      }
    } catch (error) {
      setGeneratingQuizForStep(null);
      console.error('Failed to generate/load quiz:', error);
      Alert.alert(
        'Error',
        'Failed to generate quiz. Please try again.',
        [{ text: 'OK' }]
      );
    }
  };

  const handleTopicPress = (step: RoadmapStep) => {
    if (!step.topicId) return;

    // If content already exists, go directly to content page (skip knowledge assessment)
    if (step.hasContent) {
      router.push(`/topic/${step.topicId}`);
      return;
    }

    // If user has attempted quiz, go directly to content
    if (step.hasAttempt) {
      router.push(`/topic/${step.topicId}`);
      return;
    }

    // Otherwise, show knowledge assessment modal for new topics
    setSelectedStep(step);
    setShowKnowledgeModal(true);
  };

  const handleConfirmDelete = async () => {
    if (!userId) return;

    try {
      await deleteRoadmapMutation.mutateAsync({ 
        userId: userId, 
        roadmapId 
      });
      onDelete?.();
    } catch (err) {
      console.error('Failed to delete roadmap:', err);
    }
  };

  const handleToggleCompletion = async (step: RoadmapStep) => {
    if (!userId) return;

    try {
      await updateStepCompletionMutation.mutateAsync({
        stepId: step.id,
        userId: userId,
        roadmapId: roadmapId,
        isCompleted: !step.isCompleted,
      });
    } catch (err) {
      console.error('Failed to update step completion:', err);
      Alert.alert(
        'Error',
        'Failed to update completion status. Please try again.',
        [{ text: 'OK' }]
      );
    }
  };

  const handleCheckUpdates = async () => {
    if (!userId) return;

    try {
      const result = await checkTopicUpdatesMutation.mutateAsync({
        roadmapId,
        userId: userId,
      });

      if (result.hasUpdates) {
        setTopicUpdates(result.updates);
        setShowUpdatesModal(true);
      } else {
        Alert.alert(
          'No Updates',
          'All your completed topics are up to date! 🎉',
          [{ text: 'OK' }]
        );
      }
    } catch (err) {
      console.error('Failed to check updates:', err);
      
      // Handle rate limit error specifically
      if (err instanceof Error && err.message === 'RATE_LIMIT_EXCEEDED') {
        Alert.alert(
          'Rate Limit Reached',
          'You\'ve reached the API request limit. Please try again later or upgrade your plan.',
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert(
          'Error',
          'Failed to check for updates. Please try again.',
          [{ text: 'OK' }]
        );
      }
    }
  };

  const handleStartRevision = async (step: RoadmapStep) => {
    if (!userId || !currentRoadmap) return;

    if (!step.topicId) {
      Alert.alert('Error', 'Cannot start revision: Topic ID missing');
      return;
    }

    try {
      setSelectedStep(step);
      setGeneratingRevision(true);
      setShowRevisionModal(true);
      setRevisionStep('summary');

      const result = await generateRevisionMutation.mutateAsync({
        userId: userId,
        roadmapId: roadmapId,
        stepId: step.id,
        topicId: step.topicId,
        topicName: step.title,
        context: currentRoadmap.roadmap.title,
        difficulty: step.difficulty || 'intermediate'
      });

      setRevisionSummary(result.summary);
      setRevisionQuizId(result.quizId);
      setGeneratingRevision(false);
    } catch (error) {
      setGeneratingRevision(false);
      setShowRevisionModal(false);
      console.error('Failed to generate revision:', error);
      Alert.alert(
        'Error',
        'Failed to generate revision content. Please try again.',
        [{ text: 'OK' }]
      );
    }
  };

  const handleRevisionQuizStart = () => {
    if (!revisionQuizId || !selectedStep) return;
    
    setShowRevisionModal(false);
    onTakeQuiz?.(revisionQuizId, `${selectedStep.title} - Revision`);
  };

  const handleWebSearch = async () => {
    if (!roadmap) return;

    setIsSearching(true);
    setShowWebSearchModal(true);

    try {
      console.log(`🔍 Starting web search for roadmap: ${roadmap.title}`);
      const result = await searchTopicUpdates(roadmap.title, provider);

      console.log(`✅ Web search complete. Found ${result.newSubtopics.length} updates`);
      setWebSearchResults(result.newSubtopics);

      if (result.newSubtopics.length === 0) {
        Alert.alert(
          'No Updates Found',
          `No recent updates or changes were found for ${roadmap.title}.`,
          [{ text: 'OK' }]
        );
        setShowWebSearchModal(false);
      }
    } catch (error) {
      console.error('❌ Web search failed:', error);
      Alert.alert(
        'Search Failed',
        error instanceof Error ? error.message : 'Failed to search for updates. Please try again.',
        [{ text: 'OK' }]
      );
      setShowWebSearchModal(false);
    } finally {
      setIsSearching(false);
    }
  };

  if (isLoading) {
    return (
      <View className="flex-1 bg-background p-6">
        {/* Header Skeleton */}
        <View className="flex-row items-start mb-6">
          <Skeleton className="h-8 w-8 rounded-full mr-3" />
          <View className="flex-1">
            <Skeleton className="h-7 w-3/4 mb-2" />
            <Skeleton className="h-4 w-full" />
          </View>
          <Skeleton className="h-10 w-10 rounded-lg ml-4" />
        </View>

        {/* Progress Card Skeleton */}
        <View className="mb-6">
          <Skeleton className="h-32 w-full rounded-xl" />
        </View>

        {/* Timeline Skeletons */}
        <Skeleton className="h-5 w-32 mb-2" />
        <Skeleton className="h-3 w-48 mb-6" />

        {[1, 2, 3].map((i) => (
          <View key={i} className="flex-row mb-6">
            <View className="items-center mr-4">
              <Skeleton className="h-10 w-10 rounded-full" />
              {i !== 3 && <View className="w-0.5 flex-1 my-1" style={{ minHeight: 60, backgroundColor: 'rgba(128, 128, 128, 0.2)' }} />}
            </View>
            <View className="flex-1">
              <Skeleton className="h-40 w-full rounded-xl" />
            </View>
          </View>
        ))}
      </View>
    );
  }

  if (error) {
    return (
      <ErrorDisplay
        error={error instanceof Error ? error.message : String(error)}
        onRetry={() => refetch()}
        title="Failed to load roadmap"
      />
    );
  }

  if (!currentRoadmap) {
    return (
      <View className="flex-1 justify-center items-center p-6 bg-background">
        <Text className="text-center text-muted-foreground">No roadmap data available</Text>
      </View>
    );
  }

  const { roadmap, steps } = currentRoadmap;
  const completedSteps = steps.filter(step => step.isCompleted).length;
  const totalSteps = steps.length;
  const progressPercentage = totalSteps > 0 ? (completedSteps / totalSteps) * 100 : 0;
  const isCompleted = completedSteps === totalSteps && totalSteps > 0;

  // Format date helper
  const formatDate = (date: Date | string | null | undefined) => {
    if (!date) return null;
    try {
      const d = typeof date === 'string' ? new Date(date) : date;
      if (isNaN(d.getTime())) return null;
      
      const now = new Date();
      const diff = now.getTime() - d.getTime();
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      
      if (days === 0) return 'Today';
      if (days === 1) return 'Yesterday';
      if (days < 7) return `${days} days ago`;
      if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
      if (days < 365) return `${Math.floor(days / 30)} months ago`;
      return d.toLocaleDateString();
    } catch {
      return null;
    }
  };

  return (
    <>
      {/* Delete Confirmation Dialog */}
      <DeleteConfirmationDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        title="Delete Roadmap"
        description="Are you sure you want to delete this roadmap? This action cannot be undone."
        confirmLabel="Delete"
        onConfirm={handleConfirmDelete}
      />

      {/* Knowledge Assessment Modal */}
      <Modal
        transparent
        visible={showKnowledgeModal}
        animationType="none"
        onRequestClose={() => setShowKnowledgeModal(false)}
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
            onPress={() => setShowKnowledgeModal(false)}
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
            <View className="p-6">
              <Text className="text-xl font-bold text-foreground mb-2">
                Knowledge Assessment
              </Text>
              <Text className="text-sm text-muted-foreground mb-6 leading-relaxed">
                Are you totally new to this topic or have a little idea about it?
              </Text>

              <Pressable
                onPress={() => {
                  if (selectedStep?.topicId) {
                    router.push(`/topic/${selectedStep.topicId}`);
                  }
                  setShowKnowledgeModal(false);
                }}
                className="w-full h-12 items-center justify-center rounded-lg bg-primary active:opacity-90 mb-3"
              >
                <Text className="text-base font-semibold text-primary-foreground">
                  Totally New
                </Text>
              </Pressable>

              <Pressable
                onPress={async () => {
                  setShowKnowledgeModal(false);
                  if (selectedStep) {
                    await handleTakeQuiz(selectedStep);
                  }
                }}
                className="w-full h-12 items-center justify-center rounded-lg border border-border bg-background active:bg-secondary mb-3"
              >
                <Text className="text-base font-medium text-foreground">
                  Have Little Idea
                </Text>
              </Pressable>

              <Pressable
                onPress={() => setShowKnowledgeModal(false)}
                className="w-full h-12 items-center justify-center rounded-lg active:opacity-70"
              >
                <Text className="text-base font-medium text-muted-foreground">
                  Cancel
                </Text>
              </Pressable>
            </View>
          </Animated.View>
        </Animated.View>
      </Modal>

      {/* Topic Updates Modal */}
      <Modal
        transparent
        visible={showUpdatesModal}
        animationType="none"
        onRequestClose={() => setShowUpdatesModal(false)}
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
            onPress={() => setShowUpdatesModal(false)}
          />
          
          <Animated.View
            entering={ZoomIn.duration(300).springify()}
            className="bg-card rounded-2xl w-full max-w-md overflow-hidden max-h-[80%]"
            style={{
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 10 },
              shadowOpacity: 0.3,
              shadowRadius: 20,
              elevation: 10,
            }}
          >
            <View className="p-6">
              <View className="flex-row items-center gap-2 mb-2">
                <Sparkles size={24} className="text-primary" />
                <Text className="text-xl font-bold text-foreground">
                  New Updates Found!
                </Text>
              </View>
              <Text className="text-sm text-muted-foreground mb-6 leading-relaxed">
                These topics have new updates since you completed them. Would you like to explore what's new?
              </Text>

              <ScrollView className="max-h-64 mb-6" showsVerticalScrollIndicator={false}>
                {topicUpdates.map((update, index) => (
                  <View key={index} className="mb-4 p-4 bg-secondary/50 rounded-lg">
                    <Text className="text-base font-semibold text-foreground mb-2">
                      {update.topicName}
                    </Text>
                    {update.newSubtopics.length > 0 && (
                      <View>
                        <Text className="text-xs text-muted-foreground mb-2">
                          Latest updates:
                        </Text>
                        {update.newSubtopics.slice(0, 5).map((subtopic: string, idx: number) => (
                          <View key={idx} className="mb-2">
                            <MarkdownText text={subtopic} />
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                ))}
              </ScrollView>

              <Pressable
                onPress={() => {
                  setShowUpdatesModal(false);
                  // Use topicId directly from the update
                  if (topicUpdates.length > 0 && topicUpdates[0].topicId) {
                    // Pass web search results as route params with topicId
                    router.push({
                      pathname: '/topic/[id]',
                      params: {
                        id: topicUpdates[0].topicId,
                        webSearchResults: JSON.stringify(topicUpdates[0].newSubtopics),
                        topicName: topicUpdates[0].topicName,
                        generateWebContent: 'true'
                      }
                    });
                  } else {
                    Alert.alert(
                      'Error',
                      'Could not find topic ID. Please try again.',
                      [{ text: 'OK' }]
                    );
                  }
                }}
                className="w-full h-12 items-center justify-center rounded-lg bg-primary active:opacity-90 mb-3"
              >
                <Text className="text-base font-semibold text-primary-foreground">
                  Generate Content
                </Text>
              </Pressable>

              <Pressable
                onPress={() => setShowUpdatesModal(false)}
                className="w-full h-12 items-center justify-center rounded-lg active:opacity-70"
              >
                <Text className="text-base font-medium text-muted-foreground">
                  Maybe Later
                </Text>
              </Pressable>
            </View>
          </Animated.View>
        </Animated.View>
      </Modal>

      {/* Web Search Results Modal */}
      <Modal
        transparent
        visible={showWebSearchModal}
        animationType="none"
        onRequestClose={() => setShowWebSearchModal(false)}
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
            onPress={() => setShowWebSearchModal(false)}
          />
          
          <Animated.View
            entering={ZoomIn.duration(300).springify()}
            className="bg-card rounded-2xl w-full max-w-md overflow-hidden max-h-[80%]"
            style={{
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 10 },
              shadowOpacity: 0.3,
              shadowRadius: 20,
              elevation: 10,
            }}
          >
            <View className="p-6">
              <View className="flex-row items-center gap-2 mb-2">
                <Search size={24} className="text-purple-600" />
                <Text className="text-xl font-bold text-foreground">
                  Web Search Results
                </Text>
              </View>
              <Text className="text-sm text-muted-foreground mb-6 leading-relaxed">
                Latest updates and information about {roadmap?.title}
              </Text>

              {isSearching ? (
                <View className="items-center py-8">
                  <ActivityIndicator size="large" />
                  <Text className="mt-4 text-sm text-muted-foreground">Searching the web...</Text>
                </View>
              ) : (
                <ScrollView className="max-h-96 mb-6" showsVerticalScrollIndicator={false}>
                  {webSearchResults.length > 0 ? (
                    <View className="space-y-3">
                      <View className="flex-row items-center space-x-2 mb-3">
                        <ExternalLink className="h-4 w-4 text-primary" />
                        <Text className="text-sm font-semibold text-foreground">
                          Found {webSearchResults.length} Updates
                        </Text>
                      </View>
                      {webSearchResults.map((update, idx) => (
                        <View key={idx} className="mb-2 p-3 bg-secondary/50 rounded-lg">
                          <MarkdownText text={update} />
                        </View>
                      ))}
                    </View>
                  ) : (
                    <View className="items-center py-8">
                      <Text className="text-sm text-muted-foreground text-center">
                        No updates found
                      </Text>
                    </View>
                  )}
                </ScrollView>
              )}

              <Pressable
                onPress={() => setShowWebSearchModal(false)}
                className="w-full h-12 items-center justify-center rounded-lg bg-primary active:opacity-90"
              >
                <Text className="text-base font-semibold text-primary-foreground">
                  Close
                </Text>
              </Pressable>
            </View>
          </Animated.View>
        </Animated.View>
      </Modal>

      {/* Quiz Generation Loading Modal */}
      <Modal
        transparent
        visible={generatingQuizForStep !== null}
        animationType="none"
        statusBarTranslucent
      >
        <Animated.View
          entering={FadeIn.duration(200)}
          className="flex-1 items-center justify-center px-6"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.7)' }}
        >
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
            <View className="p-8 items-center">
              <View className="mb-6 items-center">
                <ActivityIndicator size="large" color="#3b82f6" />
              </View>
              
              <View className="items-center mb-2">
                <Text className="text-xl font-bold text-foreground mb-2">
                  Generating Quiz
                </Text>
                <Text className="text-sm text-muted-foreground text-center leading-relaxed">
                  Creating personalized questions to test your knowledge. This will only take a moment...
                </Text>
              </View>

              <View className="mt-4 px-4 py-3 bg-primary/10 rounded-lg">
                <Text className="text-xs text-primary text-center font-medium">
                  🎯 Preparing your assessment
                </Text>
              </View>
            </View>
          </Animated.View>
        </Animated.View>
      </Modal>

      {/* Revision Modal */}
      <Modal
        transparent
        visible={showRevisionModal}
        animationType="none"
        onRequestClose={() => !generatingRevision && setShowRevisionModal(false)}
        statusBarTranslucent
      >
        <Animated.View
          entering={FadeIn.duration(200)}
          exiting={FadeOut.duration(200)}
          className="flex-1 items-center justify-center px-6"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.7)' }}
        >
          <Pressable 
            className="absolute inset-0" 
            onPress={() => !generatingRevision && setShowRevisionModal(false)}
          />
          
          <Animated.View
            entering={ZoomIn.duration(300).springify()}
            className="bg-card rounded-2xl w-full max-w-md overflow-hidden max-h-[80%]"
            style={{
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 10 },
              shadowOpacity: 0.3,
              shadowRadius: 20,
              elevation: 10,
            }}
          >
            {generatingRevision ? (
              <View className="p-8 items-center">
                <View className="mb-6 items-center">
                  <ActivityIndicator size="large" color="#8b5cf6" />
                </View>
                
                <View className="items-center mb-2">
                  <Text className="text-xl font-bold text-foreground mb-2">
                    Generating Revision Content
                  </Text>
                  <Text className="text-sm text-muted-foreground text-center leading-relaxed">
                    Creating a quick summary and 5 quiz questions to help you revise...
                  </Text>
                </View>

                <View className="mt-4 px-4 py-3 bg-purple-100 dark:bg-purple-950 rounded-lg">
                  <Text className="text-xs text-purple-700 dark:text-purple-400 text-center font-medium">
                    🧠 Preparing your revision
                  </Text>
                </View>
              </View>
            ) : revisionStep === 'summary' && revisionSummary ? (
              <ScrollView className="max-h-[600px]" showsVerticalScrollIndicator={false}>
                <View className="p-6">
                  <View className="flex-row items-center gap-2 mb-4">
                    <Brain size={24} className="text-purple-600" />
                    <Text className="text-xl font-bold text-foreground">
                      Quick Revision Summary
                    </Text>
                  </View>
                  
                  <Text className="text-base font-semibold text-foreground mb-2">
                    {revisionSummary.topicName}
                  </Text>

                  {/* Key Points */}
                  <View className="mb-4">
                    <Text className="text-sm font-semibold text-foreground mb-2">
                      🎯 Key Points
                    </Text>
                    {revisionSummary.keyPoints.map((point: string, idx: number) => (
                      <View key={idx} className="mb-2">
                        <MarkdownText text={point} />
                      </View>
                    ))}
                  </View>

                  {/* Important Concepts */}
                  <View className="mb-4">
                    <Text className="text-sm font-semibold text-foreground mb-2">
                      💡 Important Concepts
                    </Text>
                    {revisionSummary.importantConcepts.map((concept: string, idx: number) => (
                      <View key={idx} className="mb-2">
                        <MarkdownText text={concept} />
                      </View>
                    ))}
                  </View>

                  {/* Practical Applications */}
                  {revisionSummary.practicalApplications && revisionSummary.practicalApplications.length > 0 && (
                    <View className="mb-4">
                      <Text className="text-sm font-semibold text-foreground mb-2">
                        🚀 Practical Applications
                      </Text>
                      {revisionSummary.practicalApplications.map((app: string, idx: number) => (
                        <View key={idx} className="mb-2">
                          <MarkdownText text={app} />
                        </View>
                      ))}
                    </View>
                  )}

                  {/* Review Tips */}
                  {revisionSummary.reviewTips && revisionSummary.reviewTips.length > 0 && (
                    <View className="mb-6">
                      <Text className="text-sm font-semibold text-foreground mb-2">
                        💭 Review Tips
                      </Text>
                      {revisionSummary.reviewTips.map((tip: string, idx: number) => (
                        <View key={idx} className="mb-2">
                          <MarkdownText text={tip} />
                        </View>
                      ))}
                    </View>
                  )}

                  {/* Actions */}
                  <View className="space-y-3">
                    <Pressable
                      onPress={handleRevisionQuizStart}
                      className="w-full h-12 items-center justify-center rounded-lg bg-purple-600 active:opacity-90"
                    >
                      <Text className="text-base font-semibold text-white">
                        Take Revision Quiz (5 Questions)
                      </Text>
                    </Pressable>

                    <Pressable
                      onPress={() => setShowRevisionModal(false)}
                      className="w-full h-12 items-center justify-center rounded-lg border border-border bg-background active:bg-secondary"
                    >
                      <Text className="text-base font-medium text-foreground">
                        Close
                      </Text>
                    </Pressable>
                  </View>
                </View>
              </ScrollView>
            ) : null}
          </Animated.View>
        </Animated.View>
      </Modal>

      <ScrollView className="flex-1 bg-background" showsVerticalScrollIndicator={false}>
      {/* Header Section */}
      <Animated.View entering={FadeIn.duration(400)} className="px-6 pt-6 pb-4">
        <View className="flex-row items-start justify-between mb-4">
          
          <View className="flex-1 mr-4">
            <Text className="text-2xl font-bold text-foreground mb-2">{roadmap.title}</Text>
            {roadmap.description && (
              <Text className="text-sm text-muted-foreground leading-relaxed">
                {roadmap.description}
              </Text>
            )}
            {roadmap.createdAt && formatDate(roadmap.createdAt) && (
              <Text className="text-xs text-muted-foreground mt-2">
                Created {formatDate(roadmap.createdAt)}
              </Text>
            )}
          </View>
          
          <View className="flex-row gap-2">
            <Pressable
              onPress={handleWebSearch}
              disabled={isSearching}
              className="h-10 w-10 items-center justify-center rounded-lg bg-purple-500/20 dark:bg-purple-500/30 border-2 border-purple-500/50 dark:border-purple-500/70 active:opacity-70"
            >
              {isSearching ? (
                <ActivityIndicator size="small" color="#a855f7" />
              ) : (
                <Search size={20} className="text-white-500 dark:text-white" />
              )}
            </Pressable>
            {completedSteps > 0 && (
              <Pressable
                onPress={handleCheckUpdates}
                disabled={checkTopicUpdatesMutation.isPending}
                className="h-10 w-10 items-center justify-center rounded-lg bg-blue-500/20 dark:bg-blue-500/30 border-2 border-blue-500/50 dark:border-blue-500/70 active:opacity-70"
              >
                {checkTopicUpdatesMutation.isPending ? (
                  <ActivityIndicator size="small" color="#3b82f6" />
                ) : (
                  <RefreshCw size={20} className="text-blue-500 dark:text-blue-400" />
                )}
              </Pressable>
            )}
            <Pressable
              onPress={() => setShowDeleteDialog(true)}
              className="h-10 w-10 items-center justify-center rounded-lg bg-red-500/20 dark:bg-red-500/30 border-2 border-red-500/50 dark:border-red-500/70 active:opacity-70"
            >
              <Trash2 size={20} className="text-red-500 dark:text-red-400" />
            </Pressable>
          </View>
        </View>

        {/* Progress Card */}
        <Card className="overflow-hidden">
          <View className="p-4">
            <View className="flex-row items-center justify-between mb-3">
              <View className="flex-row items-center gap-2">
                <Text className="text-sm font-semibold text-foreground">Your Progress</Text>
              </View>
              <Text className="text-sm font-bold text-primary">
                {completedSteps}/{totalSteps}
              </Text>
            </View>
            <Progress value={progressPercentage} className="h-2 mb-2" />
            <Text className="text-xs text-muted-foreground">
              {Math.round(progressPercentage)}% complete
            </Text>
          </View>
          
          {isCompleted && (
            <View 
              className="px-4 pb-4 pt-2"
              style={{
                backgroundColor: 'rgba(34, 197, 94, 0.1)',
                borderTopWidth: 1,
                borderTopColor: 'rgba(34, 197, 94, 0.2)',
              }}
            >
              <View className="flex-row items-center gap-2">
                <Sparkles size={16} className="text-green-600 dark:text-green-400" />
                <Text className="text-sm font-semibold text-green-600 dark:text-green-400">
                  Roadmap Completed! Congratulations!
                </Text>
              </View>
            </View>
          )}
        </Card>
      </Animated.View>

      {/* Roadmap Timeline */}
      <View className="px-6 pb-8">
        <View className="mb-4">
          <Text className="text-base font-semibold text-foreground">Learning Path</Text>
          <Text className="text-xs text-muted-foreground mt-1">
            Complete each step to master the topic
          </Text>
        </View>

        {steps.map((step, index) => (
          <RoadmapStepItem
            key={step.id}
            step={step}
            index={index}
            isLast={index === steps.length - 1}
            onPress={() => handleTopicPress(step)}
            onTakeQuiz={() => handleTakeQuiz(step)}
            onToggleCompletion={() => handleToggleCompletion(step)}
            onRevise={() => handleStartRevision(step)}
            onViewResults={
              step.quizId && step.hasAttempt && onViewResults
                ? () => onViewResults(step.quizId!, step.title)
                : undefined
            }
          />
        ))}
      </View>
    </ScrollView>
    </>
  );
}

interface RoadmapStepItemProps {
  step: RoadmapStep;
  index: number;
  isLast: boolean;
  onPress: () => void;
  onTakeQuiz: () => void;
  onToggleCompletion: () => void;
  onRevise: () => void;
  onViewResults?: () => void;
}

function RoadmapStepItem({
  step,
  index,
  isLast,
  onPress,
  onTakeQuiz,
  onToggleCompletion,
  onRevise,
  onViewResults,
}: RoadmapStepItemProps) {
  const isCompleted = step.isCompleted;
  const hasQuiz = Boolean(step.quizId);

  // Format date helper
  const formatDate = (date: Date | string | null | undefined) => {
    if (!date) return null;
    try {
      const d = typeof date === 'string' ? new Date(date) : date;
      if (isNaN(d.getTime())) return null;
      
      const now = new Date();
      const diff = now.getTime() - d.getTime();
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      
      if (days === 0) return 'Today';
      if (days === 1) return 'Yesterday';
      if (days < 7) return `${days} days ago`;
      if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
      if (days < 365) return `${Math.floor(days / 30)} months ago`;
      return d.toLocaleDateString();
    } catch {
      return null;
    }
  };

  return (
    <Animated.View
      entering={FadeInDown.delay(index * 50).duration(400).springify()}
      className="flex-row"
    >
      {/* Timeline */}
      <View className="items-center mr-4 pt-1">
        {/* Node */}
        <View
          className={cn(
            'h-10 w-10 rounded-full items-center justify-center border-2',
            isCompleted
              ? 'bg-green-50 dark:bg-green-900/20 border-green-500'
              : 'bg-background border-primary'
          )}
        >
          {isCompleted ? (
            <CheckCircle size={20} color="#22c55e" />
          ) : (
            <Circle size={20} className="text-primary" />
          )}
        </View>

        {/* Connecting Line */}
        {!isLast && (
          <View
            className={cn(
              'w-0.5 flex-1 my-1',
              isCompleted ? 'bg-green-500/30' : 'bg-border'
            )}
            style={{ minHeight: 60 }}
          />
        )}
      </View>

      {/* Content */}
      <View className="flex-1 pb-6">
        <Pressable onPress={onPress} className="active:opacity-70">
          <Card className="overflow-hidden">
            <View className="p-4">
              {/* Title */}
              <View className="flex-row items-start justify-between mb-2">
                <View className="flex-1 mr-2">
                  <Text className="text-base font-semibold text-foreground mb-1">
                    {step.title}
                  </Text>
                  <View className="flex-row items-center gap-1 flex-wrap">
                    <View className="flex-row items-center gap-1">
                      <Text className="text-xs text-muted-foreground">Step {step.order}</Text>
                    </View>
                    {step.difficulty && (
                      <View
                        className={cn(
                          'px-2 py-0.5 rounded-full',
                          step.difficulty === 'basic'
                            ? 'bg-green-100 dark:bg-green-950'
                            : step.difficulty === 'intermediate'
                            ? 'bg-yellow-100 dark:bg-yellow-950'
                            : 'bg-red-100 dark:bg-red-950'
                        )}
                      >
                        <Text
                          className={cn(
                            'text-xs font-medium',
                            step.difficulty === 'basic'
                              ? 'text-green-700 dark:text-green-400'
                              : step.difficulty === 'intermediate'
                              ? 'text-yellow-700 dark:text-yellow-400'
                              : 'text-red-700 dark:text-red-400'
                          )}
                        >
                          {step.difficulty}
                        </Text>
                      </View>
                    )}
                    {step.durationMinutes && (
                      <View className="flex-row items-center gap-1">
                        <Clock size={12} color="#6b7280" />
                        <Text className="text-xs text-muted-foreground">
                          {step.durationMinutes < 60 
                            ? `${step.durationMinutes}m` 
                            : `${Math.round(step.durationMinutes / 60)}h`}
                        </Text>
                      </View>
                    )}
                  </View>
                  {isCompleted && step.lastCompletedAt && formatDate(step.lastCompletedAt) && (
                    <Text className="text-xs text-green-600 dark:text-green-400 mt-1">
                      Completed {formatDate(step.lastCompletedAt)}
                    </Text>
                  )}
                </View>
                <ChevronRight size={18} className="text-muted-foreground mt-1" />
              </View>

              {/* Actions */}
              <View className="flex-row items-center gap-2 flex-wrap">
                {!isCompleted && hasQuiz && (
                  <Pressable
                    onPress={(e) => {
                      e.stopPropagation();
                      onTakeQuiz();
                    }}
                    className="px-4 py-2 rounded-lg flex-row items-center gap-2 bg-primary active:opacity-90"
                  >
                    <BookOpen size={14} className="text-primary-foreground" />
                    <Text className="text-sm font-medium text-primary-foreground">
                      Take Quiz
                    </Text>
                  </Pressable>
                )}

                {onViewResults && (
                  <Pressable
                    onPress={(e) => {
                      e.stopPropagation();
                      onViewResults();
                    }}
                    className="px-4 py-2 rounded-lg border border-border bg-background active:bg-secondary"
                  >
                    <Text className="text-sm font-medium text-foreground">View Results</Text>
                  </Pressable>
                )}

                {/* Revision Button - Only shown for completed topics */}
                {isCompleted && step.topicId && (
                  <Pressable
                    onPress={(e) => {
                      e.stopPropagation();
                      onRevise();
                    }}
                    className="px-4 py-2 rounded-lg flex-row items-center gap-2 bg-purple-600 active:opacity-90"
                  >
                    <Brain size={14} className="text-white" />
                    <Text className="text-sm font-medium text-white">
                      Revise
                    </Text>
                  </Pressable>
                )}

                {!isCompleted ? (
                  <Pressable
                    onPress={(e) => {
                      e.stopPropagation();
                      onToggleCompletion();
                    }}
                    className="px-4 py-2 rounded-lg border border-border bg-background active:bg-secondary flex-row items-center gap-2"
                  >
                    <CheckCircle size={14} className="text-foreground" />
                    <Text className="text-sm font-medium text-foreground">
                      Mark as Completed
                    </Text>
                  </Pressable>
                ) : (
                  <Pressable
                    onPress={(e) => {
                      e.stopPropagation();
                      onToggleCompletion();
                    }}
                    className="px-3 py-1.5 rounded-full bg-green-100 dark:bg-green-950 active:opacity-70"
                  >
                    <Text className="text-xs font-semibold text-green-700 dark:text-green-400">
                      ✓ Completed
                    </Text>
                  </Pressable>
                )}
              </View>
            </View>
          </Card>
        </Pressable>
      </View>
    </Animated.View>
  );
}