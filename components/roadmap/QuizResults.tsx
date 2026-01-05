import React, { useEffect, useState } from 'react';
import { View, ScrollView, ActivityIndicator } from 'react-native';
import { Text } from '@/components/ui/text';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ErrorDisplay } from '@/components/ui/error-display';
import { Check, X, AlertCircle } from 'lucide-react-native';
import { getQuizResults, type QuizResultDetail } from '@/server/queries/roadmaps';

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
    <ScrollView className="flex-1 bg-background">
      <View className="p-4 space-y-4">
        {/* Header Card */}
        <Card>
          <CardHeader>
            <CardTitle>{stepTitle} - Quiz Results</CardTitle>
            <CardDescription>Review your answers and explanations</CardDescription>
          </CardHeader>
          <CardContent>
            <View className="space-y-3">
              <View className="flex-row items-center justify-between">
                <Text className="text-lg font-semibold text-foreground">Score: {score}%</Text>
                <View className={`px-3 py-1.5 rounded-full ${passed ? 'bg-green-100 dark:bg-green-950' : 'bg-red-100 dark:bg-red-950'}`}>
                  <Text className={`text-sm font-semibold ${passed ? 'text-green-800 dark:text-green-400' : 'text-red-800 dark:text-red-400'}`}>
                    {passed ? 'Passed ✓' : 'Failed ✗'}
                  </Text>
                </View>
              </View>
              
              <View className="flex-row items-center justify-between">
                <Text className="text-sm text-muted-foreground">
                  Correct Answers: {correctCount} / {totalCount}
                </Text>
                <Text className="text-sm font-medium text-foreground">{percentage}%</Text>
              </View>
              
              {!passed && (
                <View className="bg-amber-100 dark:bg-amber-950 p-3 rounded-lg flex-row items-start space-x-2">
                  <AlertCircle className="text-amber-600 dark:text-amber-400 mt-0.5" size={20} />
                  <Text className="text-sm text-amber-800 dark:text-amber-300 flex-1">
                    Review the explanations below and try again to improve your score.
                  </Text>
                </View>
              )}
            </View>
          </CardContent>
        </Card>

        {/* Questions and Answers */}
        {results.map((result, index) => (
          <Card key={result.questionId}>
            <CardHeader>
              <View className="flex-row items-start justify-between">
                <View className="flex-1">
                  <CardTitle className="text-lg font-semibold">
                    Question {index + 1}
                  </CardTitle>

                  {result.subtopicName && (
                    <View className="mt-2 px-2 py-1 bg-secondary rounded-md self-start">
                      <Text className="text-xs font-medium text-foreground">
                        {result.subtopicName}
                      </Text>
                    </View>
                  )}
                </View>
                
                <View className="ml-2">
                  {result.isCorrect ? (
                    <View className="bg-green-100 dark:bg-green-950 p-2 rounded-full">
                      <Check size={20} className="text-green-600 dark:text-green-400" />
                    </View>
                  ) : (
                    <View className="bg-red-100 dark:bg-red-950 p-2 rounded-full">
                      <X size={20} className="text-red-600 dark:text-red-400" />
                    </View>
                  )}
                </View>
              </View>
            </CardHeader>
                
            <CardContent>
              <View className="space-y-6">
                {/* Question */}
                <Text className="text-lg font-semibold text-foreground">
                  {result.question}
                </Text>
                
                {/* Options */}
                {/* Options */}
    <View>
  {result.options.map((option, optIndex) => {
    const isUserAnswer = optIndex === result.userAnswer;
    const isCorrectAnswer = optIndex === result.correctAnswer;

    let containerClass =
      'border border-border bg-secondary/50 p-4 rounded-lg mb-4';

    if (isCorrectAnswer) {
      containerClass =
        'border-2 border-green-500 dark:border-green-600 bg-green-50 dark:bg-green-950/30 p-4 rounded-lg mb-4';
    } else if (isUserAnswer && !result.isCorrect) {
      containerClass =
        'border-2 border-red-500 dark:border-red-600 bg-red-50 dark:bg-red-950/30 p-4 rounded-lg mb-4';
    }

    return (
      <View key={optIndex} className={containerClass}>
        <View className="flex-row items-start justify-between gap-3">
          <Text className="flex-1 text-base text-foreground">
            {option}
          </Text>

          <View className="flex-row items-center gap-2">
            {isUserAnswer && (
              <View className="px-2 py-1 bg-blue-100 dark:bg-blue-950 rounded-md">
                <Text className="text-xs font-semibold text-blue-800 dark:text-blue-300">
                  Your Answer
                </Text>
              </View>
            )}

            {isCorrectAnswer && (
              <View className="px-2 py-1 bg-green-100 dark:bg-green-950 rounded-md">
                <Text className="text-xs font-semibold text-green-800 dark:text-green-300">
                  Correct
                </Text>
              </View>
            )}
          </View>
        </View>
      </View>
    );
  })}
</View>


        {/* Divider */}
        <View className="h-px bg-border my-6" />

        {/* Explanation */}
        <View className="bg-blue-100 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-900 p-4 rounded-lg">
          <Text className="text-sm font-bold text-blue-900 dark:text-blue-300 mb-2">
            Explanation
          </Text>
          <Text className="text-sm leading-relaxed text-blue-900 dark:text-blue-200">
            {result.explanation}
          </Text>
        </View>
      </View>
    </CardContent>
  </Card>
))}


        {/* Close Button */}
        {onClose && (
          <Button onPress={onClose} className="mb-6">
            <Text className="text-primary-foreground font-medium">Close Results</Text>
          </Button>
        )}
      </View>
    </ScrollView>
  );
}
