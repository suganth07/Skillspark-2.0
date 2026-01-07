import React, { useState, useEffect } from 'react';
import { View, Alert, Pressable, Modal, ActivityIndicator } from 'react-native';
import Animated, { FadeInDown, FadeIn, ZoomIn, FadeOut } from 'react-native-reanimated';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { ErrorDisplay } from '@/components/ui/error-display';
import { ScrollView } from 'react-native-gesture-handler';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { useUserManagement } from '@/hooks/stores/useUserStore';
import { useQuiz, useSubmitQuiz } from '@/hooks/queries/useRoadmapQueries';
import { Skeleton } from '@/components/ui/skeleton';
import { Check, X, Clock } from '@/components/Icons';
import { Brain } from '@/lib/icons/Brain';
import { cn } from '@/lib/utils';

interface QuizComponentProps {
  quizId: string;
  roadmapId?: string;
  onQuizComplete?: (result: {
    score: number;
    passed: boolean;
    feedback: string;
    personalizedFeedback?: string;
  }) => void;
  onBack?: () => void;
}

export function QuizComponent({ quizId, roadmapId, onQuizComplete, onBack }: QuizComponentProps) {
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [quizResult, setQuizResult] = useState<any>(null);
  const [showResults, setShowResults] = useState(false);
  const [timeStarted, setTimeStarted] = useState<Date>(new Date());
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  
  const { currentUser, currentUserId } = useUserManagement();
  
  // TanStack Query hooks - automatic caching
  const { 
    data: currentQuiz, 
    isLoading, 
    error,
    refetch 
  } = useQuiz(quizId);
  
  const submitQuizMutation = useSubmitQuiz();

  useEffect(() => {
    if (quizId) {
      setTimeStarted(new Date());
    }
  }, [quizId]);

  const handleAnswerChange = (questionId: string, answer: any) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: answer
    }));
  };

  const handleSubmitQuiz = async () => {
    if (!currentUserId || !currentQuiz) return;
    setShowSubmitModal(true);
  };

  const handleConfirmSubmit = async () => {
    if (!currentUserId || !currentQuiz) return;

    setSubmitError(null);
    setShowSubmitModal(false);

    try {
      const { result } = await submitQuizMutation.mutateAsync({
        userId: currentUserId,
        quizId,
        answers,
        roadmapId
      });
      setQuizResult(result);
      setShowResults(true);
      onQuizComplete?.(result);
    } catch (err) {
      console.error('Failed to submit quiz:', err);
      setSubmitError(err instanceof Error ? err.message : 'Failed to submit quiz. Please try again.');
    }
  };

  const renderQuestion = (question: any, index: number) => {
    const questionId = question.id;
    let questionData: { options: string[] } | null = null;
    
    try {
      questionData = JSON.parse(question.data as string);
    } catch (error) {
      console.error(`Failed to parse question data for question ${questionId}:`, error);
      questionData = null;
    }
    
    // Render fallback UI if question data is malformed
    if (!questionData || !questionData.options || questionData.options.length === 0) {
      return (
        <Animated.View
          key={questionId}
          entering={FadeInDown.delay(index * 100)}
          className="mb-6 p-4 rounded-xl bg-card border border-border"
        >
          <Text className="text-base font-semibold text-foreground mb-2">
            Question {index + 1}
          </Text>
          <ErrorDisplay 
            error="This question is currently unavailable due to a data error."
            variant="inline"
            showIcon={false}
          />
        </Animated.View>
      );
    }
    
    return (
      <Animated.View
        key={questionId}
        entering={FadeInDown.delay(index * 100)}
        className="mb-6"
      >
        <Text className="text-base font-semibold text-foreground mb-3">
          Question {index + 1}
        </Text>
        <Text className="text-base text-foreground leading-6 mb-4">{question.content}</Text>
        
        <RadioGroup 
          value={answers[questionId]?.toString() || ''}
          onValueChange={() => {}} // No-op: selection handled by Pressable onPress
          className="gap-2"
        >
          {questionData.options.map((option: string, optionIndex: number) => (
            <Pressable
              key={optionIndex}
              onPress={() => handleAnswerChange(questionId, optionIndex)}
              className={cn(
                "flex-row items-center gap-3 p-4 rounded-lg border",
                answers[questionId] === optionIndex
                  ? "border-primary bg-primary/10"
                  : "border-border bg-card"
              )}
            >
              <RadioGroupItem 
                value={optionIndex.toString()}
                aria-labelledby={`question-${questionId}-option-${optionIndex}`}
              />
              <Text 
                nativeID={`question-${questionId}-option-${optionIndex}`}
                className="flex-1 text-sm leading-5 text-foreground"
                style={{ flexShrink: 1 }}
              >
                {option}
              </Text>
            </Pressable>
          ))}
        </RadioGroup>
      </Animated.View>
    );
  };

  const renderResults = () => {
    if (!quizResult || !currentQuiz) return null;

    return (
      <View className="gap-6">
        {/* Result Header */}
        <View className="items-center py-8">
          <View className={cn(
            "p-6 rounded-full mb-4",
            quizResult.passed ? "bg-green-100 dark:bg-green-900/30" : "bg-red-100 dark:bg-red-900/30"
          )}>
            {quizResult.passed ? (
              <Check size={48} className="text-green-600 dark:text-green-400" />
            ) : (
              <X size={48} className="text-red-600 dark:text-red-400" />
            )}
          </View>
          <Text className={cn(
            "text-3xl font-bold mb-2",
            quizResult.passed ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
          )}>
            {quizResult.passed ? 'Quiz Passed!' : 'Keep Learning!'}
          </Text>
          <Text className="text-4xl font-bold text-foreground mb-2">
            {quizResult.score}%
          </Text>
          <Text className="text-base text-muted-foreground text-center px-6">
            {quizResult.feedback}
          </Text>
        </View>
        
        {/* Personalized Feedback */}
        {quizResult.personalizedFeedback && (
          <View className="p-4 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
            <View className="flex-row items-center gap-2 mb-2">
              <Brain size={20} className="text-blue-600 dark:text-blue-400" />
              <Text className="font-semibold text-blue-900 dark:text-blue-200">Personalized Feedback</Text>
            </View>
            <Text className="text-sm text-blue-800 dark:text-blue-300 leading-5">
              {quizResult.personalizedFeedback}
            </Text>
          </View>
        )}

        {/* Action Buttons */}
        <View className="flex-row gap-3 mt-4">
          {onBack && (
            <Button
              variant="outline"
              className="flex-1"
              onPress={onBack}
            >
              <Text>Back to Roadmap</Text>
            </Button>
          )}
          
          {!quizResult.passed && (
            <Button
              className="flex-1"
              onPress={() => {
                setShowResults(false);
                setQuizResult(null);
                setAnswers({});
                setTimeStarted(new Date());
              }}
            >
              <Text className="text-primary-foreground">Try Again</Text>
            </Button>
          )}
        </View>
      </View>
    );
  };

  if (isLoading) {
    return (
      <View className="flex-1 bg-background px-6 pt-6">
        {/* Header Skeleton */}
        <Skeleton className="h-8 w-3/4 mb-2" />
        <Skeleton className="h-4 w-full mb-6" />
        
        {/* Progress Card Skeleton */}
        <Skeleton className="h-32 w-full rounded-xl mb-6" />
        
        {/* Question Skeletons */}
        {[1, 2, 3].map((i) => (
          <View key={i} className="mb-6">
            <Skeleton className="h-5 w-32 mb-3" />
            <Skeleton className="h-12 w-full mb-4" />
            <View className="gap-2">
              <Skeleton className="h-14 w-full rounded-lg" />
              <Skeleton className="h-14 w-full rounded-lg" />
              <Skeleton className="h-14 w-full rounded-lg" />
              <Skeleton className="h-14 w-full rounded-lg" />
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
        onRetry={() => refetch()}
        title="Failed to load quiz"
      />
    );
  }

  if (!currentQuiz) {
    return (
      <View className="flex-1 justify-center items-center p-6">
        <Text className="text-center text-muted-foreground">No quiz data available</Text>
      </View>
    );
  }

  if (showResults) {
    return (
      <ScrollView className="flex-1 p-6 bg-background">
        {renderResults()}
      </ScrollView>
    );
  }

  const timeElapsed = Math.round((new Date().getTime() - timeStarted.getTime()) / 1000 / 60);
  const answeredQuestions = Object.keys(answers).length;
  const totalQuestions = currentQuiz.questions.length;
  const progressPercentage = totalQuestions > 0 ? (answeredQuestions / totalQuestions) * 100 : 0;

  return (
    <>
      {/* Submit Confirmation Modal */}
      <Modal
        transparent
        visible={showSubmitModal}
        animationType="none"
        onRequestClose={() => setShowSubmitModal(false)}
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
            onPress={() => setShowSubmitModal(false)}
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
                <View className="bg-orange-100 dark:bg-orange-950 p-4 rounded-full mb-4">
                  <Check size={32} className="text-orange-600" />
                </View>
                <Text className="text-xl font-bold text-foreground text-center mb-2">
                  Submit Quiz?
                </Text>
                <Text className="text-sm text-muted-foreground text-center leading-relaxed">
                  Are you sure you want to submit your answers? This action cannot be undone.
                </Text>
              </View>

              <View className="space-y-3">
                <Pressable
                  onPress={handleConfirmSubmit}
                  disabled={submitQuizMutation.isPending}
                  className={cn(
                    "w-full h-12 items-center justify-center rounded-lg flex-row gap-2",
                    submitQuizMutation.isPending
                      ? "bg-orange-500/30"
                      : "bg-orange-500 active:bg-orange-600"
                  )}
                >
                  {submitQuizMutation.isPending ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Check size={20} className="text-white" />
                      <Text className="text-base font-semibold text-white">
                        Submit Quiz
                      </Text>
                    </>
                  )}
                </Pressable>

                <Pressable
                  onPress={() => setShowSubmitModal(false)}
                  disabled={submitQuizMutation.isPending}
                  className="w-full h-12 items-center justify-center rounded-lg border border-border bg-background active:bg-secondary"
                >
                  <Text className="text-base font-medium text-foreground">
                    Cancel
                  </Text>
                </Pressable>
              </View>
            </View>
          </Animated.View>
        </Animated.View>
      </Modal>

    <ScrollView className="flex-1 bg-background" showsVerticalScrollIndicator={false}>
      <View className="px-6 pt-6 pb-4">
        {/* Submit Error */}
        {submitError && (
          <View className="mb-4">
            <ErrorDisplay
              error={submitError}
              onDismiss={() => setSubmitError(null)}
              variant="inline"
            />
          </View>
        )}
        
        {/* Header Section */}
        <View className="mb-6">
          <Text className="text-2xl font-bold text-foreground mb-2">
            {currentQuiz.quiz.title || 'Assessment Quiz'}
          </Text>
          <Text className="text-sm text-muted-foreground leading-relaxed">
            Test your knowledge of the prerequisite concepts. You need 70% or higher to pass.
          </Text>
        </View>

        {/* Progress Stats */}
        <View className="mb-6 p-4 rounded-xl bg-card border border-border">
          <View className="flex-row justify-between items-center mb-3">
            <View className="flex-row items-center gap-2">
              <Clock size={16} className="text-muted-foreground" />
              <Text className="text-sm text-muted-foreground">
                {timeElapsed} min elapsed
              </Text>
            </View>
            <Text className="text-sm font-semibold text-foreground">
              {answeredQuestions}/{totalQuestions} answered
            </Text>
          </View>
          
          <View className="mb-2">
            <Text className="text-xs text-muted-foreground mb-1">Progress</Text>
            <Progress value={progressPercentage} className="h-2" />
          </View>
          <Text className="text-xs text-muted-foreground">
            {Math.round(progressPercentage)}% complete
          </Text>
        </View>

        {/* Questions */}
        {currentQuiz.questions.map((question, index) => renderQuestion(question, index))}

        {/* Submit Section */}
        <View className="mt-4 pb-6 gap-3">
          {answeredQuestions < totalQuestions && (
            <Text className="text-center text-sm text-muted-foreground">
              {totalQuestions - answeredQuestions} questions remaining
            </Text>
          )}
          
          <Button 
            onPress={handleSubmitQuiz}
            disabled={submitQuizMutation.isPending || answeredQuestions < totalQuestions}
            className="w-full"
          >
            <Text className="text-primary-foreground font-medium">
              {submitQuizMutation.isPending ? 'Submitting...' : 'Submit Quiz'}
            </Text>
          </Button>

          {onBack && (
            <Button variant="outline" onPress={onBack} className="w-full">
              <Text>Back to Roadmap</Text>
            </Button>
          )}
        </View>
      </View>
    </ScrollView>
    </>
  );
}