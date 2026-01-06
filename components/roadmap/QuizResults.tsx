import React, { useEffect, useState } from 'react';
import { View, ScrollView, ActivityIndicator } from 'react-native';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { ErrorDisplay } from '@/components/ui/error-display';
import { getQuizResults, type QuizResultDetail } from '@/server/queries/roadmaps';
import { cn } from '@/lib/utils';

interface QuizResultsProps {
  userId: string;
  quizId: string;
  stepTitle: string;
  onClose?: () => void;
}

export function QuizResults({ userId, quizId, stepTitle, onClose }: QuizResultsProps) {
  const [results, setResults] = useState<QuizResultDetail[] | null>(null);
  const [score, setScore] = useState<number>(0);
  const [passed, setPassed] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadResults();
  }, [userId, quizId]);

  const loadResults = async () => {
    try {
      setIsLoading(true);
      setError(null);
      console.log('🔄 Loading quiz results for:', { userId, quizId });
      const data = await getQuizResults(userId, quizId);
      console.log('✅ Quiz results loaded:', { 
        score: data.score, 
        passed: data.passed,
        resultCount: data.results.length 
      });
      setResults(data.results);
      setScore(data.score);
      setPassed(data.passed);
    } catch (err) {
      console.error('❌ Failed to load quiz results:', err);
      setError(err instanceof Error ? err.message : 'Failed to load quiz results');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center p-6">
        <ActivityIndicator size="large" />
        <Text className="text-muted-foreground mt-4">Loading results...</Text>
      </View>
    );
  }

  if (error) {
    return <ErrorDisplay error={error} onRetry={loadResults} />;
  }

  if (!results || results.length === 0) {
    return (
      <View className="flex-1 items-center justify-center p-6">
        <Text className="text-muted-foreground">No results found</Text>
      </View>
    );
  }

  const correctCount = results.filter(r => r.isCorrect).length;
  const totalCount = results.length;
  const percentage = Math.round((correctCount / totalCount) * 100);

  return (
    <ScrollView className="flex-1 bg-background" showsVerticalScrollIndicator={false}>
      <View className="px-6 pt-6 pb-4">
        {/* Header Section */}
        <View className="mb-6">
          <Text className="text-2xl font-bold text-foreground mb-2">{stepTitle} - Results</Text>
          <Text className="text-sm text-muted-foreground leading-relaxed">
            Review your answers and explanations below.
          </Text>
        </View>

        {/* Score Stats */}
        <View className="mb-6 p-4 rounded-xl bg-card border border-border">
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-lg font-semibold text-foreground">Score: {score}%</Text>
            <View className={cn(
              "px-3 py-1.5 rounded-lg",
              passed ? "bg-green-100 dark:bg-green-900/30" : "bg-red-100 dark:bg-red-900/30"
            )}>
              <Text className={cn(
                "text-sm font-semibold",
                passed ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400"
              )}>
                {passed ? 'Passed' : 'Failed'}
              </Text>
            </View>
          </View>
          
          <View className="flex-row items-center justify-between">
            <Text className="text-sm text-muted-foreground">
              Correct Answers: {correctCount} / {totalCount}
            </Text>
            <Text className="text-sm font-medium text-foreground">{percentage}%</Text>
          </View>
        </View>

        {/* Questions and Answers */}
        {results.map((result, index) => (
          <View key={result.questionId} className="mb-6">
            <View className="flex-row items-start justify-between mb-3">
              <Text className="text-base font-semibold text-foreground flex-1">
                Question {index + 1}
              </Text>
              
              {result.isCorrect ? (
                <View className="bg-green-100 dark:bg-green-900/30 px-3 py-1 rounded-lg">
                  <Text className="text-xs font-semibold text-green-600 dark:text-green-400">Correct</Text>
                </View>
              ) : (
                <View className="bg-red-100 dark:bg-red-900/30 px-3 py-1 rounded-lg">
                  <Text className="text-xs font-semibold text-red-600 dark:text-red-400">Incorrect</Text>
                </View>
              )}
            </View>

            <Text className="text-base text-foreground leading-6 mb-4">
              {result.question}
            </Text>
            
            {/* Options */}
            <View className="gap-2 mb-4">
              {result.options.map((option, optIndex) => {
                const isUserAnswer = optIndex === result.userAnswer;
                const isCorrectAnswer = optIndex === result.correctAnswer;

                return (
                  <View
                    key={optIndex}
                    className={cn(
                      "flex-row items-start gap-3 p-4 rounded-lg border",
                      isCorrectAnswer
                        ? "border-green-500 dark:border-green-600 bg-green-50 dark:bg-green-950/20"
                        : isUserAnswer && !result.isCorrect
                        ? "border-red-500 dark:border-red-600 bg-red-50 dark:bg-red-950/20"
                        : "border-border bg-card"
                    )}
                  >
                    <Text 
                      className={cn(
                        "flex-1 text-sm",
                        isCorrectAnswer
                          ? "text-green-700 dark:text-green-400"
                          : isUserAnswer && !result.isCorrect
                          ? "text-red-700 dark:text-red-400"
                          : "text-foreground"
                      )}
                      style={{ flexShrink: 1 }}
                    >
                      {option}
                    </Text>

                    {isUserAnswer && (
                      <View className="px-2 py-1 bg-blue-100 dark:bg-blue-900/40 rounded">
                        <Text className="text-xs font-medium text-blue-700 dark:text-blue-300">
                          Your Answer
                        </Text>
                      </View>
                    )}
                  </View>
                );
              })}
            </View>

            {/* Explanation */}
            <View className="p-4 rounded-lg bg-muted border border-border">
              <Text className="text-xs font-semibold text-muted-foreground mb-1">
                Explanation
              </Text>
              <Text className="text-sm leading-relaxed text-foreground">
                {result.explanation}
              </Text>
            </View>
          </View>
        ))}


        {/* Close Button */}
        {onClose && (
          <Button onPress={onClose} className="mb-6 w-full">
            <Text className="text-primary-foreground font-medium">Close Results</Text>
          </Button>
        )}
      </View>
    </ScrollView>
  );
}
