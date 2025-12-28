import React, { useState, useEffect } from 'react';
import { View, Alert } from 'react-native';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ErrorDisplay } from '@/components/ui/error-display';
import { ScrollView } from 'react-native-gesture-handler';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { useUserStore } from '@/hooks/stores/useUserStore';
import { getQuizWithQuestions, submitQuizAttempt } from '@/server/queries/roadmaps';
import { ActivityIndicator } from 'react-native';
import { Check, X, Clock, Brain } from 'lucide-react-native';

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
  const [validationError, setValidationError] = useState<string | null>(null);
  const [currentQuiz, setCurrentQuiz] = useState<{ quiz: any; questions: any[] } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const { currentUser } = useUserStore();

  const loadQuiz = async (quizId: string) => {
    try {
      setIsLoading(true);
      setError(null);
      const quizData = await getQuizWithQuestions(quizId);
      setCurrentQuiz(quizData);
    } catch (err) {
      console.error('Failed to load quiz:', err);
      setError(err instanceof Error ? err.message : 'Failed to load quiz');
    } finally {
      setIsLoading(false);
    }
  };

  const submitQuiz = async (userId: string, quizId: string, answers: Record<string, any>, roadmapId?: string) => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Submit the quiz attempt (server will compute score and result)
      const result = await submitQuizAttempt(userId, quizId, answers, roadmapId);
      
      setIsLoading(false);
      return result;
      
    } catch (err) {
      console.error('Failed to submit quiz:', err);
      setError(err instanceof Error ? err.message : 'Failed to submit quiz');
      setIsLoading(false);
      throw err;
    }
  };

  useEffect(() => {
    if (quizId) {
      loadQuiz(quizId);
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
    if (!currentUser || !currentQuiz) return;

    // Check if all questions are answered
    const unansweredQuestions = currentQuiz.questions.filter(q => !(q.id in answers));
    if (unansweredQuestions.length > 0) {
      setValidationError(`Please answer all questions before submitting. ${unansweredQuestions.length} questions remaining.`);
      return;
    }

    setValidationError(null);
    setSubmitError(null);

    Alert.alert(
      'Submit Quiz',
      'Are you sure you want to submit your answers? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Submit', 
          onPress: async () => {
            try {
              const result = await submitQuiz(
                currentUser.id,
                quizId,
                answers,
                roadmapId
              );
              setQuizResult(result);
              setShowResults(true);
              onQuizComplete?.(result);
            } catch (err) {
              console.error('Failed to submit quiz:', err);
              setSubmitError(err instanceof Error ? err.message : 'Failed to submit quiz. Please try again.');
            }
          }
        }
      ]
    );
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
        <Card key={questionId} className="mb-4">
          <CardHeader>
            <CardTitle className="text-lg">
              Question {index + 1}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ErrorDisplay 
              error="This question is currently unavailable due to a data error."
              variant="inline"
              showIcon={false}
            />
          </CardContent>
        </Card>
      );
    }
    
    return (
      <Card key={questionId} className="mb-4">
        <CardHeader>
          <View className="flex-row items-center justify-between">
            <CardTitle className="text-lg">
              Question {index + 1}
            </CardTitle>
            {question.subtopicName && (
              <View className="bg-primary/10 px-3 py-1 rounded-full">
                <Text className="text-xs font-medium text-primary">
                  {question.subtopicName}
                </Text>
              </View>
            )}
          </View>
        </CardHeader>
        <CardContent className="space-y-4">
          <Text className="text-base leading-6">{question.content}</Text>
          
          <RadioGroup 
            value={answers[questionId]?.toString() || ''}
            onValueChange={(value) => handleAnswerChange(questionId, parseInt(value))}
          >
            {questionData.options.map((option: string, optionIndex: number) => (
              <View key={optionIndex} className="flex-row items-center space-x-2 py-2">
                <RadioGroupItem 
                  value={optionIndex.toString()}
                  aria-labelledby={`question-${questionId}-option-${optionIndex}`}
                />
                <Label 
                  nativeID={`question-${questionId}-option-${optionIndex}`}
                  className="flex-1 text-sm leading-5"
                >
                  {option}
                </Label>
              </View>
            ))}
          </RadioGroup>
        </CardContent>
      </Card>
    );
  };

  const renderResults = () => {
    if (!quizResult || !currentQuiz) return null;

    return (
      <View className="space-y-6">
        <Card className={`border-2 ${quizResult.passed ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
          <CardHeader className="text-center">
            <View className="items-center mb-4">
              {quizResult.passed ? (
                <View className="bg-green-100 p-4 rounded-full">
                  <Check className="h-8 w-8 text-green-600" />
                </View>
              ) : (
                <View className="bg-red-100 p-4 rounded-full">
                  <X className="h-8 w-8 text-red-600" />
                </View>
              )}
            </View>
            <CardTitle className={`text-2xl ${quizResult.passed ? 'text-green-800' : 'text-red-800'}`}>
              {quizResult.passed ? '🎉 Quiz Passed!' : '📚 Keep Learning!'}
            </CardTitle>
            <CardDescription className="text-lg">
              Score: {quizResult.score}%
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Text className="text-center">{quizResult.feedback}</Text>
            
            {quizResult.personalizedFeedback && (
              <View className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <View className="flex-row items-center space-x-2 mb-2">
                  <Brain className="h-5 w-5 text-blue-600" />
                  <Text className="font-medium text-blue-800">Personalized Feedback</Text>
                </View>
                <Text className="text-blue-700 leading-5">{quizResult.personalizedFeedback}</Text>
              </View>
            )}
          </CardContent>
        </Card>

        <View className="flex-row space-x-3">
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
              <Text className="text-white">Try Again</Text>
            </Button>
          )}
        </View>
      </View>
    );
  };

  if (isLoading) {
    return (
      <View className="flex-1 justify-center items-center p-6">
        <ActivityIndicator size="large" />
        <Text className="mt-4 text-center text-muted-foreground">Loading quiz...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <ErrorDisplay
        error={error}
        onRetry={() => loadQuiz(quizId)}
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

  return (
    <ScrollView className="flex-1 p-6 bg-background">
      <View className="space-y-6">
        {/* Validation Error */}
        {validationError && (
          <ErrorDisplay
            error={validationError}
            onDismiss={() => setValidationError(null)}
            variant="inline"
          />
        )}
        
        {/* Submit Error */}
        {submitError && (
          <ErrorDisplay
            error={submitError}
            onDismiss={() => setSubmitError(null)}
            variant="inline"
          />
        )}
        
        {/* Quiz Header */}
        <Card>
          <CardHeader>
            <CardTitle>{currentQuiz.quiz.title || 'Assessment Quiz'}</CardTitle>
            <CardDescription>
              Test your knowledge of the prerequisite concepts. You need 70% or higher to pass.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <View className="flex-row justify-between items-center">
              <View className="flex-row items-center space-x-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <Text className="text-sm text-muted-foreground">
                  {timeElapsed} min elapsed
                </Text>
              </View>
              <Text className="text-sm text-muted-foreground">
                {answeredQuestions}/{totalQuestions} answered
              </Text>
            </View>
            
            <View className="bg-muted rounded-lg p-3">
              <Text className="text-xs text-muted-foreground mb-1">Progress</Text>
              <View className="w-full bg-gray-200 rounded-full h-2">
                <View 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${(answeredQuestions / totalQuestions) * 100}%` }}
                />
              </View>
            </View>
          </CardContent>
        </Card>

        {/* Questions */}
        {currentQuiz.questions.map((question, index) => renderQuestion(question, index))}

        {/* Submit Button */}
        <Card>
          <CardContent className="pt-6">
            <View className="space-y-4">
              {answeredQuestions < totalQuestions && (
                <Text className="text-center text-sm text-muted-foreground">
                  {totalQuestions - answeredQuestions} questions remaining
                </Text>
              )}
              
              <Button 
                onPress={handleSubmitQuiz}
                disabled={isLoading || answeredQuestions < totalQuestions}
                className="w-full"
              >
                <Text className="text-white font-medium">
                  {isLoading ? 'Submitting...' : 'Submit Quiz'}
                </Text>
              </Button>

              {onBack && (
                <Button variant="outline" onPress={onBack} className="w-full">
                  <Text>Back to Roadmap</Text>
                </Button>
              )}
            </View>
          </CardContent>
        </Card>
      </View>
    </ScrollView>
  );
}