import React, { useState, useCallback, useRef } from 'react';
import { View, Pressable, ActivityIndicator, Modal, Alert, TextInput } from 'react-native';
import Animated, { FadeInDown, FadeIn, ZoomIn, FadeOut } from 'react-native-reanimated';
import * as WebBrowser from 'expo-web-browser';
import { Text } from '@/components/ui/text';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorDisplay } from '@/components/ui/error-display';
import { DeleteConfirmationDialog } from '@/components/ui/delete-confirmation-dialog';
import { LoadingAnimation } from '@/components/ui/loading-animation';
import { ScrollView } from 'react-native-gesture-handler';
import { Progress } from '@/components/ui/progress';
import { useCurrentUserId } from '@/hooks/stores/useUserStore';
import { useRoadmapDetails, useDeleteRoadmap, useUpdateStepCompletion, useCheckTopicUpdates, useGenerateQuiz, useGenerateRevision } from '@/hooks/queries/useRoadmapQueries';
import { searchTopicUpdates } from '@/lib/webSearchService';
import { useWebSearchProvider } from '@/hooks/stores/useWebSearchProviderStore';
import { geminiService } from '@/lib/gemini';
import { regenerateRoadmap } from '@/server/queries/roadmaps';
import { TopicUpdatesModal } from '@/components/roadmap/TopicUpdatesModal';
import { WebSearchResultsModal } from '@/components/roadmap/WebSearchResultsModal';
import { BottomSheet } from '@/components/primitives/bottomSheet/bottom-sheet.native';
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
  Wand2,
  X,
  RotateCcw,
  AlertTriangle,
} from 'lucide-react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { cn } from '@/lib/utils';

// Component to render markdown text with clickable links
function MarkdownText({ text }: { text: string }) {
  // Filter out "read more" text (case insensitive)
  const cleanedText = text.replace(/\s*read more\s*/gi, '').trim();
  
  const parts: Array<{ text: string; url?: string }> = [];
  
  // Parse markdown links: [text](url)
  const regex = /\[([^\]]+)\]\(([^)]+)\)/g;
  let lastIndex = 0;
  let match;
  
  while ((match = regex.exec(cleanedText)) !== null) {
    // Add text before the link
    if (match.index > lastIndex) {
      parts.push({ text: cleanedText.substring(lastIndex, match.index) });
    }
    // Add the link
    parts.push({ text: match[1], url: match[2] });
    lastIndex = regex.lastIndex;
  }
  
  // Add remaining text
  if (lastIndex < cleanedText.length) {
    parts.push({ text: cleanedText.substring(lastIndex) });
  }
  
  if (parts.length === 0) {
    parts.push({ text: cleanedText });
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
  onRevisionQuizComplete?: () => void;
  onDelete?: () => void;
}

export function RoadmapDisplay({ roadmapId, onTakeQuiz, onViewResults, onRevisionQuizComplete, onDelete }: RoadmapDisplayProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showKnowledgeModal, setShowKnowledgeModal] = useState(false);
  const [topicUpdates, setTopicUpdates] = useState<any[]>([]);
  const [isLoadingUpdates, setIsLoadingUpdates] = useState(false);
  const updatesSheetRef = useRef<any>(null);
  const webSearchSheetRef = useRef<any>(null);
  const [selectedStep, setSelectedStep] = useState<RoadmapStep | null>(null);
  const [showRevisionModal, setShowRevisionModal] = useState(false);
  const [revisionSummary, setRevisionSummary] = useState<any>(null);
  const [revisionQuizId, setRevisionQuizId] = useState<string | null>(null);
  const [revisionStep, setRevisionStep] = useState<'summary' | 'quiz'>('summary');
  const [generatingRevision, setGeneratingRevision] = useState(false);
  const [revisionError, setRevisionError] = useState<string | null>(null);
  const [revisionReminderQueue, setRevisionReminderQueue] = useState<RoadmapStep[]>([]);
  const [showRevisionReminder, setShowRevisionReminder] = useState(false);
  const [currentReminderStep, setCurrentReminderStep] = useState<RoadmapStep | null>(null);
  const [showRegenerateModal, setShowRegenerateModal] = useState(false);
  const [regeneratePreferences, setRegeneratePreferences] = useState('');
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [showSearchUpdateModal, setShowSearchUpdateModal] = useState(false);
  const [searchUpdateType, setSearchUpdateType] = useState<'all' | 'completed' | null>(null);
  const pendingRevisionCompletion = useRef(false);
  
  const userId = useCurrentUserId();
  const provider = useWebSearchProvider();
  const [generatingQuizForStep, setGeneratingQuizForStep] = useState<string | null>(null);
  const [webSearchResults, setWebSearchResults] = useState<string[]>([]);
  const [isSearching, setIsSearching] = useState(false);
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

  // Handle revision quiz completion
  const handleRevisionQuizComplete = useCallback(() => {
    // After quiz completes, show next reminder if any
    if (revisionReminderQueue.length > 1) {
      const nextQueue = revisionReminderQueue.slice(1);
      setRevisionReminderQueue(nextQueue);
      setCurrentReminderStep(nextQueue[0]);
      setShowRevisionReminder(true);
    } else {
      setRevisionReminderQueue([]);
      setCurrentReminderStep(null);
    }
    // Call parent callback if provided
    onRevisionQuizComplete?.();
  }, [revisionReminderQueue, onRevisionQuizComplete]);

  // Reload roadmap details when returning from quiz
  useFocusEffect(
    useCallback(() => {
      if (userId && roadmapId) {
        refetch();
        // If we just completed a revision quiz, handle the completion
        if (pendingRevisionCompletion.current) {
          pendingRevisionCompletion.current = false;
          handleRevisionQuizComplete();
        }
      }
    }, [roadmapId, userId, refetch, handleRevisionQuizComplete])
  );

  // Check for topics needing revision (completed >= REVISION_THRESHOLD ago)
  const checkForRevisionReminders = React.useCallback(() => {
    if (!currentRoadmap?.steps || showRevisionReminder || revisionReminderQueue.length > 0) return;

    const REVISION_THRESHOLD = 7 * 24 * 60 * 60 * 1000; // 1 week
    // For testing with 30 seconds, use: const REVISION_THRESHOLD = 30 * 1000;
    
    const now = new Date().getTime();
    const stepsNeedingRevision = currentRoadmap.steps.filter(step => {
      if (!step.isCompleted || !step.lastCompletedAt || !step.topicId) return false;
      
      const completedTime = new Date(step.lastCompletedAt).getTime();
      const timeSinceCompletion = now - completedTime;
      
      return timeSinceCompletion >= REVISION_THRESHOLD;
    });

    if (stepsNeedingRevision.length > 0) {
      console.log(`📅 Found ${stepsNeedingRevision.length} topics needing revision`);
      setRevisionReminderQueue(stepsNeedingRevision);
      setCurrentReminderStep(stepsNeedingRevision[0]);
      setShowRevisionReminder(true);
    }
  }, [currentRoadmap?.steps, showRevisionReminder, revisionReminderQueue.length]);

  // Initial check on mount and data change
  React.useEffect(() => {
    checkForRevisionReminders();
  }, [checkForRevisionReminders]);

  // Periodic check every 10 seconds while roadmap is open
  React.useEffect(() => {
    const interval = setInterval(() => {
      checkForRevisionReminders();
    }, 10000); // Check every 10 seconds

    return () => clearInterval(interval);
  }, [checkForRevisionReminders]);

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

  const handleRegenerateRoadmap = async () => {
    if (!userId || !currentRoadmap?.roadmap.title) return;

    if (!regeneratePreferences.trim()) {
      Alert.alert('Preferences Required', 'Please enter your customization preferences to regenerate the roadmap.');
      return;
    }

    // Extract the topic from title (remove " Learning Path")
    const topic = currentRoadmap.roadmap.title.replace(' Learning Path', '');

    try {
      setIsRegenerating(true);
      console.log(`🔄 Regenerating roadmap for: ${topic}`);
      console.log(`📝 User preferences: ${regeneratePreferences}`);

      // Step 1: Generate knowledge graph with preferences
      const knowledgeGraph = await geminiService.generateKnowledgeGraph(
        topic,
        regeneratePreferences.trim()
      );
      console.log(`✅ Knowledge graph generated with ${knowledgeGraph.prerequisites.length} prerequisites`);

      // Step 2: Regenerate roadmap in place (keeps same ID)
      await regenerateRoadmap(roadmapId, userId, knowledgeGraph, regeneratePreferences.trim());
      console.log(`✨ Roadmap regenerated successfully`);

      // Close modal and reset state
      setShowRegenerateModal(false);
      setRegeneratePreferences('');
      setIsRegenerating(false);

      // Refresh the current roadmap data
      refetch();
      
      Alert.alert(
        'Success',
        'Your roadmap has been regenerated with your preferences!',
        [{ text: 'OK' }]
      );
    } catch (error) {
      setIsRegenerating(false);
      console.error('Failed to regenerate roadmap:', error);
      Alert.alert(
        'Error',
        error instanceof Error ? error.message : 'Failed to regenerate roadmap. Please try again.'
      );
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

  // Just open the modal - shows cached data
  const handleShowUpdates = () => {
    updatesSheetRef.current?.present();
  };

  // Actually fetch new updates from the internet
  const handleRefreshUpdates = async () => {
    if (!userId) return;

    setIsLoadingUpdates(true);
    try {
      const result = await checkTopicUpdatesMutation.mutateAsync({
        roadmapId,
        userId: userId,
      });

      if (result.hasUpdates) {
        console.log('✅ Found updates:', result.updates.length, 'topics');
        setTopicUpdates(result.updates);
      } else {
        console.log('ℹ️ No new updates found');
        // Don't clear topicUpdates - let modal show cached data
        // Just show a toast/alert
        Alert.alert(
          'No New Updates',
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
    } finally {
      setIsLoadingUpdates(false);
    }
  };

  const handleStartRevision = async (step: RoadmapStep) => {
    if (!userId || !currentRoadmap) return;

    if (!step.topicId) {
      setRevisionError('Cannot start revision: Topic ID missing');
      setShowRevisionModal(true);
      return;
    }

    try {
      setSelectedStep(step);
      setGeneratingRevision(true);
      setShowRevisionModal(true);
      setRevisionStep('summary');
      setRevisionError(null);

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
      console.error('Failed to generate revision:', error);
      setRevisionError(
        error instanceof Error ? error.message : 'Failed to generate revision content. Please try again.'
      );
    }
  };

  const handleRevisionQuizStart = () => {
    if (!revisionQuizId || !selectedStep) return;
    
    setShowRevisionModal(false);
    // Mark that we're starting a revision quiz
    pendingRevisionCompletion.current = true;
    onTakeQuiz?.(revisionQuizId, `${selectedStep.title} - Revision`);
    // Mark that this is a revision quiz for later completion handling
    setRevisionStep('quiz');
  };

  const handleReminderAccept = async () => {
    if (!currentReminderStep) return;
    
    setShowRevisionReminder(false);
    await handleStartRevision(currentReminderStep);
  };

  const handleReminderDismiss = async () => {
    // Update lastCompletedAt to current time so it won't show again immediately
    if (currentReminderStep && userId) {
      try {
        await updateStepCompletionMutation.mutateAsync({
          stepId: currentReminderStep.id,
          userId: userId,
          roadmapId: roadmapId,
          isCompleted: true, // Keep it completed
        });
        console.log(`✅ Updated lastCompletedAt for "${currentReminderStep.title}" to current time`);
      } catch (err) {
        console.error('Failed to update lastCompletedAt:', err);
      }
    }

    if (revisionReminderQueue.length > 1) {
      // Show next reminder in queue
      const nextQueue = revisionReminderQueue.slice(1);
      setRevisionReminderQueue(nextQueue);
      setCurrentReminderStep(nextQueue[0]);
      setShowRevisionReminder(true);
    } else {
      // No more reminders
      setShowRevisionReminder(false);
      setRevisionReminderQueue([]);
      setCurrentReminderStep(null);
    }
  };

  const handleWebSearch = async () => {
    if (!roadmap) return;

    webSearchSheetRef.current?.present();
  };

  const handleRefreshWebSearch = async () => {
    if (!roadmap) return;

    setIsSearching(true);

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
      }
    } catch (error) {
      console.error('❌ Web search failed:', error);
      Alert.alert(
        'Search Failed',
        error instanceof Error ? error.message : 'Failed to search for updates. Please try again.',
        [{ text: 'OK' }]
      );
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

      {/* Regenerate Roadmap Modal */}
      <Modal
        transparent
        visible={showRegenerateModal}
        animationType="none"
        onRequestClose={() => !isRegenerating && setShowRegenerateModal(false)}
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
            onPress={() => !isRegenerating && setShowRegenerateModal(false)}
          />
          
          <Animated.View
            entering={ZoomIn.duration(300).springify()}
            className="bg-card rounded-2xl w-full max-w-md overflow-hidden"
            style={{
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 10 },
              shadowOpacity: 0.3,
              shadowRadius: 20,
              elevation: 10,
            }}
          >
            <View className="p-6">
              <View className="flex-row items-center justify-between mb-2">
                <View className="flex-row items-center gap-2">
                  <Wand2 size={24} className="text-orange-500" />
                  <Text className="text-xl font-bold text-foreground">
                    Customize Roadmap
                  </Text>
                </View>
                <Pressable
                  onPress={() => {
                    setShowRegenerateModal(false);
                    setRegeneratePreferences('');
                  }}
                  disabled={isRegenerating}
                  className="h-8 w-8 items-center justify-center rounded-lg active:bg-secondary"
                >
                  <X size={20} className="text-muted-foreground" />
                </Pressable>
              </View>
              <Text className="text-sm text-muted-foreground mb-6 leading-relaxed">
                Regenerate your roadmap with custom preferences. Enter what you want to focus on, skip, or prioritize.
              </Text>

              {isRegenerating ? (
                <View className="py-8 items-center">
                  <LoadingAnimation 
                    title="Regenerating Roadmap"
                    messages={[
                      'Creating your personalized learning path...',
                      'Analyzing your progress...',
                      'Organizing topics...',
                      'Almost ready...'
                    ]}
                  />
                </View>
              ) : (
                <>
                  <View className="mb-6">
                    <Text className="text-sm font-medium text-foreground mb-2">
                      Your Preferences
                    </Text>
                    <View className="min-h-[120px] p-3 rounded-lg border border-border bg-background">
                      <TextInput
                        value={regeneratePreferences}
                        onChangeText={setRegeneratePreferences}
                        placeholder="e.g., Skip basics, focus mainly on advanced patterns, include real-world examples..."
                        placeholderTextColor="#9ca3af"
                        multiline
                        editable={!isRegenerating}
                        className="text-sm text-foreground"
                        style={{ minHeight: 100, textAlignVertical: 'top' }}
                      />
                    </View>
                    <Text className="text-xs text-muted-foreground mt-2">
                      Examples: "Skip {'{topic}'}, focus mainly on {'{topic}'}" or "Include interview prep" or "Focus on practical projects"
                    </Text>
                  </View>

                  <View className="flex-col gap-2">
                    <Pressable
                      onPress={handleRegenerateRoadmap}
                      disabled={isRegenerating || !regeneratePreferences.trim()}
                      className={cn(
                        "w-full h-12 items-center justify-center rounded-lg flex-row gap-2",
                        isRegenerating || !regeneratePreferences.trim()
                          ? "bg-orange-500/30"
                          : "bg-orange-500 active:bg-orange-600"
                      )}
                    >
                      <Wand2 size={20} className="text-white" />
                      <Text className="text-base font-semibold text-white">
                        Regenerate Roadmap
                      </Text>
                    </Pressable>

                    <Pressable
                      onPress={() => {
                        setShowRegenerateModal(false);
                        setRegeneratePreferences('');
                      }}
                      disabled={isRegenerating}
                      className="w-full h-12 items-center justify-center rounded-lg active:opacity-70"
                    >
                      <Text className="text-base font-medium text-muted-foreground">
                        Cancel
                      </Text>
                    </Pressable>
                  </View>
                </>
              )}
            </View>
          </Animated.View>
        </Animated.View>
      </Modal>

      {/* Search & Update Modal */}
      <Modal
        transparent
        visible={showSearchUpdateModal}
        animationType="none"
        onRequestClose={() => setShowSearchUpdateModal(false)}
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
            onPress={() => setShowSearchUpdateModal(false)}
          />
          
          <Animated.View
            entering={ZoomIn.duration(300).springify()}
            className="bg-card rounded-2xl w-full max-w-md overflow-hidden"
            style={{
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 10 },
              shadowOpacity: 0.3,
              shadowRadius: 20,
              elevation: 10,
            }}
          >
            <View className="p-6">
              <View className="flex-row items-center justify-between mb-4">
                <View className="flex-row items-center gap-2 flex-1 mr-2">
                  <View className="h-12 w-12 items-center justify-center rounded-full bg-primary/10 flex-shrink-0">
                    <RefreshCw size={24} className="text-primary" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-xl font-bold text-foreground">
                      Check for Updates
                    </Text>
                    <Text className="text-sm text-muted-foreground mt-0.5">
                      Choose which topics to check
                    </Text>
                  </View>
                </View>
                <Pressable
                  onPress={() => setShowSearchUpdateModal(false)}
                  className="h-8 w-8 items-center justify-center rounded-lg active:bg-secondary flex-shrink-0"
                >
                  <X size={20} className="text-muted-foreground" />
                </Pressable>
              </View>

              <View className="gap-3 mb-6">
                <Pressable
                  onPress={() => {
                    setShowSearchUpdateModal(false);
                    handleShowUpdates();
                  }}
                  disabled={completedSteps === 0}
                  className={cn(
                    "p-4 rounded-xl border-2 active:opacity-70",
                    completedSteps === 0 
                      ? "bg-secondary/50 border-border opacity-50" 
                      : "bg-card border-primary/20"
                  )}
                >
                  <View className="flex-row items-center gap-3">
                    <View className="h-10 w-10 items-center justify-center rounded-full bg-green-100 dark:bg-green-950">
                      <CheckCircle size={20} className="text-green-700 dark:text-green-400" />
                    </View>
                    <View className="flex-1">
                      <Text className="text-base font-semibold text-foreground">
                        Completed Topics Only
                      </Text>
                      <Text className="text-sm text-muted-foreground mt-0.5">
                        Check for updates in topics you've completed
                      </Text>
                    </View>
                  </View>
                </Pressable>

                <Pressable
                  onPress={async () => {
                    setShowSearchUpdateModal(false);
                    await handleWebSearch();
                  }}
                  className="p-4 rounded-xl border-2 bg-card border-primary/20 active:opacity-70"
                >
                  <View className="flex-row items-center gap-3">
                    <View className="h-10 w-10 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-950">
                      <Search size={20} className="text-blue-700 dark:text-blue-400" />
                    </View>
                    <View className="flex-1">
                      <Text className="text-base font-semibold text-foreground">
                        All Topics
                      </Text>
                      <Text className="text-sm text-muted-foreground mt-0.5">
                        Search for updates across all topics
                      </Text>
                    </View>
                  </View>
                </Pressable>
              </View>

              <Pressable
                onPress={() => setShowSearchUpdateModal(false)}
                className="w-full h-12 items-center justify-center rounded-lg bg-secondary active:bg-secondary/70"
              >
                <Text className="text-base font-medium text-foreground">
                  Cancel
                </Text>
              </Pressable>
            </View>
          </Animated.View>
        </Animated.View>
      </Modal>

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

      {/* Topic Updates Bottom Sheet */}
      <BottomSheet>
        <TopicUpdatesModal
          visible={true}
          updates={topicUpdates}
          isLoading={isLoadingUpdates}
          onClose={() => updatesSheetRef.current?.dismiss()}
          onRefresh={handleRefreshUpdates}
          roadmapId={roadmapId}
          sheetRef={updatesSheetRef}
        />
      </BottomSheet>

      {/* Web Search Results Modal */}
      <BottomSheet ref={webSearchSheetRef}>
        <WebSearchResultsModal
          sheetRef={webSearchSheetRef}
          results={webSearchResults}
          isSearching={isSearching}
          roadmapTitle={roadmap?.title ?? ''}
          roadmapId={roadmapId}
          onRefresh={handleRefreshWebSearch}
        />
      </BottomSheet>

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
              <LoadingAnimation 
                title="Generating Quiz"
                messages={[
                  'Creating personalized questions...',
                  'Analyzing subtopics...',
                  'Preparing your assessment...',
                  'Almost ready...'
                ]}
              />
            </View>
          </Animated.View>
        </Animated.View>
      </Modal>

      {/* Revision Reminder Modal */}
      <Modal
        transparent
        visible={showRevisionReminder}
        animationType="none"
        onRequestClose={handleReminderDismiss}
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
            onPress={handleReminderDismiss}
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
              <View className="items-center mb-4">
                <View className="bg-purple-100 dark:bg-purple-950 p-4 rounded-full mb-4">
                  <RotateCcw size={32} className="text-purple-600" />
                </View>
                <Text className="text-xl font-bold text-foreground text-center mb-2">
                  Time to Revise!
                </Text>
                {currentReminderStep && (
                  <>
                    <Text className="text-base font-semibold text-foreground text-center mb-2">
                      {currentReminderStep.title}
                    </Text>
                    <Text className="text-sm text-muted-foreground text-center leading-relaxed">
                      You completed this topic {formatDate(currentReminderStep.lastCompletedAt)}. 
                      A quick revision will help reinforce your knowledge!
                    </Text>
                  </>
                )}
              </View>

              {revisionReminderQueue.length > 1 && (
                <View className="mb-4 px-3 py-2 bg-purple-50 dark:bg-purple-950/50 rounded-lg">
                  <Text className="text-xs text-purple-700 dark:text-purple-400 text-center">
                    {revisionReminderQueue.length} topics ready for revision
                  </Text>
                </View>
              )}

              <View className="space-y-3">
                <Pressable
                  onPress={handleReminderAccept}
                  className="w-full h-12 items-center justify-center rounded-lg bg-purple-600 active:opacity-90 flex-row gap-2"
                >
                  <RotateCcw size={16} className="text-white" />
                  <Text className="text-base font-semibold text-white">
                    Start Revision
                  </Text>
                </Pressable>

                <Pressable
                  onPress={handleReminderDismiss}
                  className="w-full h-12 items-center justify-center rounded-lg border border-border bg-background active:bg-secondary"
                >
                  <Text className="text-base font-medium text-foreground">
                    {revisionReminderQueue.length > 1 ? 'Next Topic' : 'Maybe Later'}
                  </Text>
                </Pressable>
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
                <LoadingAnimation 
                  title="Generating Revision"
                  messages={[
                    'Creating quick summary...',
                    'Preparing quiz questions...',
                    'Analyzing key concepts...',
                    'Almost ready...'
                  ]}
                />
              </View>
            ) : revisionError ? (
              <View className="p-6">
                <ErrorDisplay
                  error={revisionError}
                  onRetry={() => {
                    if (selectedStep) {
                      setRevisionError(null);
                      handleStartRevision(selectedStep);
                    }
                  }}
                  onDismiss={() => {
                    setShowRevisionModal(false);
                    setRevisionError(null);
                  }}
                  variant="inline"
                />
              </View>
            ) : revisionStep === 'summary' && revisionSummary ? (
              <ScrollView className="max-h-[600px]" showsVerticalScrollIndicator={false}>
                <View className="p-6">
                  <View className="flex-row items-center gap-2 mb-4">
                    <RotateCcw size={24} className="text-purple-600" />
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
                      Key Points
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
                      Important Concepts
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
                        Practical Applications
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
                        Review Tips
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
        <View className="mb-4">
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

        {/* Action Buttons */}
        <View className="mt-4 flex-row gap-3">
          <Pressable
            onPress={() => setShowRegenerateModal(true)}
            className="flex-1 h-11 flex-row items-center justify-center gap-2 rounded-lg bg-card border border-border active:bg-secondary"
          >
            <Wand2 size={18} className="text-foreground" />
            <Text className="text-sm font-medium text-foreground">
              Regenerate
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setShowSearchUpdateModal(true)}
            disabled={isSearching || checkTopicUpdatesMutation.isPending}
            className="flex-1 h-11 flex-row items-center justify-center gap-2 rounded-lg bg-card border border-border active:bg-secondary"
          >
            {isSearching || checkTopicUpdatesMutation.isPending ? (
              <ActivityIndicator size="small" className="text-foreground" />
            ) : (
              <>
                <RefreshCw size={18} className="text-foreground" />
                <Text className="text-sm font-medium text-foreground">
                  Updates
                </Text>
              </>
            )}
          </Pressable>
          <Pressable
            onPress={() => setShowDeleteDialog(true)}
            className="h-11 w-11 items-center justify-center rounded-lg bg-card border border-border active:bg-secondary"
          >
            <Trash2 size={18} className="text-muted-foreground" />
          </Pressable>
        </View>
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
                    <Text className="text-xs text-muted-foreground mt-1">
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
                    className="px-4 py-2 rounded-lg flex-row items-center gap-2 border border-border bg-card active:bg-secondary"
                  >
                    <RotateCcw size={14} className="text-foreground" />
                    <Text className="text-sm font-medium text-foreground">
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
                    className="px-3 py-1.5 rounded-lg border border-border bg-secondary active:bg-secondary/70"
                  >
                    <Text className="text-xs font-medium text-muted-foreground">
                      Mark Incomplete
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