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
                <Text className="text-lg font-semibold">Score: {score}%</Text>
                <Badge className={passed ? 'bg-green-100' : 'bg-red-100'}>
                  <Text className={passed ? 'text-green-800' : 'text-red-800'}>
                    {passed ? 'Passed ✓' : 'Failed ✗'}
                  </Text>
                </Badge>
              </View>
              
              <View className="flex-row items-center justify-between">
                <Text className="text-sm text-muted-foreground">
                  Correct Answers: {correctCount} / {totalCount}
                </Text>
                <Text className="text-sm font-medium">{percentage}%</Text>
              </View>
              
              {!passed && (
                <View className="bg-amber-50 p-3 rounded-lg flex-row items-start space-x-2">
                  <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5" />
                  <Text className="text-sm text-amber-800 flex-1">
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
                  <CardTitle className="text-base">Question {index + 1}</CardTitle>
                  {result.subtopicName && (
                    <Badge variant="outline" className="mt-1 self-start">
                      <Text className="text-xs">{result.subtopicName}</Text>
                    </Badge>
                  )}
                </View>
                <View className="ml-2">
                  {result.isCorrect ? (
                    <View className="bg-green-100 p-2 rounded-full">
                      <Check className="h-5 w-5 text-green-600" />
                    </View>
                  ) : (
                    <View className="bg-red-100 p-2 rounded-full">
                      <X className="h-5 w-5 text-red-600" />
                    </View>
                  )}
                </View>
              </View>
            </CardHeader>
            <CardContent>
              <View className="space-y-4">
                {/* Question */}
                <Text className="text-base font-medium">{result.question}</Text>
                
                {/* Options */}
                <View className="space-y-2">
                  {result.options.map((option, optIndex) => {
                    const isUserAnswer = optIndex === result.userAnswer;
                    const isCorrectAnswer = optIndex === result.correctAnswer;
                    
                    let bgColor = 'bg-gray-50';
                    let borderColor = 'border-gray-200';
                    let textColor = 'text-foreground';
                    
                    if (isCorrectAnswer) {
                      bgColor = 'bg-green-50';
                      borderColor = 'border-green-500';
                    } else if (isUserAnswer && !result.isCorrect) {
                      bgColor = 'bg-red-50';
                      borderColor = 'border-red-500';
                    }
                    
                    return (
                      <View
                        key={optIndex}
                        className={`border ${borderColor} ${bgColor} p-3 rounded-lg`}
                      >
                        <View className="flex-row items-center justify-between">
                          <Text className={`flex-1 ${textColor}`}>{option}</Text>
                          <View className="flex-row items-center space-x-2">
                            {isUserAnswer && (
                              <Badge variant="outline" className="bg-blue-50">
                                <Text className="text-xs text-blue-700">Your Answer</Text>
                              </Badge>
                            )}
                            {isCorrectAnswer && (
                              <Badge className="bg-green-100">
                                <Text className="text-xs text-green-700">Correct</Text>
                              </Badge>
                            )}
                          </View>
                        </View>
                      </View>
                    );
                  })}
                </View>
                
                {/* Explanation */}
                <View className="bg-blue-50 p-3 rounded-lg">
                  <Text className="text-xs font-semibold text-blue-900 mb-1">
                    Explanation:
                  </Text>
                  <Text className="text-sm text-blue-800">{result.explanation}</Text>
                </View>
              </View>
            </CardContent>
          </Card>
        ))}

        {/* Close Button */}
        {onClose && (
          <Button onPress={onClose} className="mb-6">
            <Text className="text-white font-medium">Close Results</Text>
          </Button>
        )}
      </View>
    </ScrollView>
  );
}
