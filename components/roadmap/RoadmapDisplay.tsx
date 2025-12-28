import React, { useState, useEffect, useCallback } from 'react';
import { View, Pressable, ActivityIndicator, Modal, Alert } from 'react-native';
import Animated, { FadeInDown, FadeIn, ZoomIn, FadeOut } from 'react-native-reanimated';
import { Text } from '@/components/ui/text';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorDisplay } from '@/components/ui/error-display';
import { DeleteConfirmationDialog } from '@/components/ui/delete-confirmation-dialog';
import { ScrollView } from 'react-native-gesture-handler';
import { Progress } from '@/components/ui/progress';
import { useUserStore } from '@/hooks/stores/useUserStore';
import { getRoadmapWithSteps, deleteRoadmap, createPrerequisiteQuiz } from '@/server/queries/roadmaps';
import { createSubtopics, getSubtopics } from '@/server/queries/topics';
import { geminiService } from '@/lib/gemini';
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
} from 'lucide-react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { cn } from '@/lib/utils';

interface RoadmapDisplayProps {
  roadmapId: string;
  onTakeQuiz?: (quizId: string, stepTitle: string) => void;
  onViewResults?: (quizId: string, stepTitle: string) => void;
  onDelete?: () => void;
}

export function RoadmapDisplay({ roadmapId, onTakeQuiz, onViewResults, onDelete }: RoadmapDisplayProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showKnowledgeModal, setShowKnowledgeModal] = useState(false);
  const [selectedStep, setSelectedStep] = useState<RoadmapStep | null>(null);
  const [currentRoadmap, setCurrentRoadmap] = useState<{ roadmap: any; steps: RoadmapStep[] } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isGeneratingQuiz, setIsGeneratingQuiz] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const { currentUser } = useUserStore();

  const loadRoadmapDetails = async (roadmapId: string, userId: string) => {
    try {
      setIsLoading(true);
      setError(null);
      const roadmapWithSteps = await getRoadmapWithSteps(roadmapId, userId);
      setCurrentRoadmap(roadmapWithSteps);
    } catch (err) {
      console.error('Failed to load roadmap details:', err);
      setError(err instanceof Error ? err.message : 'Failed to load roadmap');
    } finally {
      setIsLoading(false);
    }
  };

  const generateQuizForPrerequisite = async (userId: string, roadmapId: string, stepId: string, prerequisiteName: string) => {
    try {
      setIsGeneratingQuiz(true);
      setError(null);
      
      // Get the roadmap to find the topic
      const { roadmap, steps } = await getRoadmapWithSteps(roadmapId, userId);
      const step = steps.find(s => s.id === stepId);
      
      if (!step) {
        throw new Error('Step not found');
      }
      
      // Validate that step has a valid topicId
      if (!step.topicId) {
        throw new Error(`Step "${step.title || stepId}" is missing a topicId. Cannot generate quiz for prerequisite without a valid topic reference.`);
      }
      
      // Get subtopics for this topic
      const subtopics = await getSubtopics(step.topicId);
      
      let quizId: string;
      
      if (subtopics.length > 0) {
        // Generate quiz from subtopics (questions covering different subtopics)
        console.log(`🎯 Generating quiz with ${subtopics.length} subtopics for ${prerequisiteName}`);
        
        const subtopicsData = subtopics.map((st: any) => ({
          id: st.id,
          name: st.name,
          description: st.description || ''
        }));
        
        const questions = await geminiService.generateQuizQuestionsFromSubtopics(
          prerequisiteName,
          subtopicsData,
          step.difficulty || 'intermediate',
          roadmap.title
        );
        
        // Create prerequisite object
        const prerequisite = {
          id: `temp-${Date.now()}`,
          name: prerequisiteName,
          description: step.content || `Learn ${prerequisiteName}`,
          difficulty: step.difficulty || 'intermediate',
          estimatedHours: Math.ceil((step.durationMinutes || 120) / 60),
          topics: [],
          order: step.order || 1
        };
        
        quizId = await createPrerequisiteQuiz(
          roadmapId,
          prerequisite,
          step.topicId,
          questions
        );
        
        console.log(`✅ Quiz created with questions from ${subtopics.length} subtopics`);
      } else {
        // Generate subtopics first, then create quiz
        console.log(`⚠️ No subtopics found for ${prerequisiteName}, generating subtopics first`);
        
        // Generate subtopics using AI
        const topicExplanation = await geminiService.generateTopicExplanation(
          prerequisiteName, 
          roadmap.title
        );
        
        // Get topic category (use roadmap title as category fallback)
        const topicCategory = roadmap.title.split(' ')[0] || 'General';
        
        // Store subtopics in database
        await createSubtopics(step.topicId, topicCategory, topicExplanation);
        console.log(`✅ Generated ${topicExplanation.subtopics.length} subtopics for ${prerequisiteName}`);
        
        // Now fetch the newly created subtopics
        const newSubtopics = await getSubtopics(step.topicId);
        
        const subtopicsData = newSubtopics.map((st: any) => ({
          id: st.id,
          name: st.name,
          description: st.description || ''
        }));
        
        // Generate quiz from newly created subtopics
        const questions = await geminiService.generateQuizQuestionsFromSubtopics(
          prerequisiteName,
          subtopicsData,
          step.difficulty || 'intermediate',
          roadmap.title
        );
        
        const prerequisite = {
          id: `temp-${Date.now()}`,
          name: prerequisiteName,
          description: step.content || `Learn ${prerequisiteName}`,
          difficulty: step.difficulty || 'intermediate',
          estimatedHours: Math.ceil((step.durationMinutes || 120) / 60),
          topics: [],
          order: step.order || 1
        };
        
        quizId = await createPrerequisiteQuiz(
          roadmapId,
          prerequisite,
          step.topicId,
          questions
        );
        
        console.log(`✅ Quiz created with questions from ${newSubtopics.length} newly generated subtopics`);
      }
      
      setIsGeneratingQuiz(false);
      
      // Refresh roadmap data to show the new quiz
      await loadRoadmapDetails(roadmapId, userId);
      
      return quizId;
      
    } catch (err) {
      console.error('Failed to generate quiz for prerequisite:', err);
      
      let errorMessage = 'Failed to generate quiz';
      if (err instanceof Error) {
        if (err.message.toLowerCase().includes('overloaded') || 
            err.message.toLowerCase().includes('quota') ||
            err.message.toLowerCase().includes('rate limit')) {
          errorMessage = 'AI service is temporarily overloaded. Please try again in a few minutes.';
        } else {
          errorMessage = err.message;
        }
      }
      
      setError(errorMessage);
      setIsGeneratingQuiz(false);
      throw new Error(errorMessage);
    }
  };

  useEffect(() => {
    if (currentUser && roadmapId) {
      loadRoadmapDetails(roadmapId, currentUser.id);
    }
  }, [roadmapId, currentUser]);

  // Reload roadmap details when returning from quiz
  useFocusEffect(
    useCallback(() => {
      if (currentUser && roadmapId) {
        loadRoadmapDetails(roadmapId, currentUser.id);
      }
    }, [roadmapId, currentUser])
  );

  const handleTakeQuiz = async (step: RoadmapStep) => {
    if (!currentUser || !step.quizId) return;
    
    onTakeQuiz?.(step.quizId, step.title);
  };

  const handleTopicPress = (step: RoadmapStep) => {
    if (!step.topicId) return;

    if (step.hasAttempt) {
      router.push(`/topic/${step.topicId}`);
      return;
    }

    setSelectedStep(step);
    setShowKnowledgeModal(true);
  };

  const handleConfirmDelete = async () => {
    if (!currentUser) return;

    try {
      await deleteRoadmap(currentUser.id, roadmapId);
      onDelete?.();
    } catch (error) {
      console.error('Failed to delete roadmap:', error);
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
        error={error}
        onRetry={() => currentUser && loadRoadmapDetails(roadmapId, currentUser.id)}
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
                onPress={() => {
                  setShowKnowledgeModal(false);
                  if (selectedStep) {
                    if (selectedStep.quizId) {
                      onTakeQuiz?.(selectedStep.quizId, selectedStep.title);
                    } else {
                      Alert.alert(
                        'Quiz Not Available',
                        'No quiz is available for this step yet. Please try selecting "Totally New" to generate learning content.',
                        [{ text: 'OK' }]
                      );
                    }
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
          </View>
          <Pressable
            onPress={() => setShowDeleteDialog(true)}
            className="h-10 w-10 items-center justify-center rounded-lg active:bg-secondary"
          >
            <Trash2 size={20} className="text-red-600 dark:text-red-400" />
          </Pressable>
        </View>

        {/* Progress Card */}
        <Card className="overflow-hidden">
          <View className="p-4">
            <View className="flex-row items-center justify-between mb-3">
              <View className="flex-row items-center gap-2">
                <Trophy size={18} className="text-primary" />
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
  onViewResults?: () => void;
}

function RoadmapStepItem({
  step,
  index,
  isLast,
  onPress,
  onTakeQuiz,
  onViewResults,
}: RoadmapStepItemProps) {
  const isCompleted = step.isCompleted;
  const hasQuiz = Boolean(step.quizId);

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

                {isCompleted && (
                  <View className="px-3 py-1.5 rounded-full bg-green-100 dark:bg-green-950">
                    <Text className="text-xs font-semibold text-green-700 dark:text-green-400">
                      ✓ Completed
                    </Text>
                  </View>
                )}
              </View>
            </View>
          </Card>
        </Pressable>
      </View>
    </Animated.View>
  );
}