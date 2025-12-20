import React, { useState, useEffect } from 'react';
import { View, Alert, Pressable } from 'react-native';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ErrorDisplay } from '@/components/ui/error-display';
import { ScrollView } from 'react-native-gesture-handler';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { useUserStore } from '@/hooks/stores/useUserStore';
import { useRoadmapStore } from '@/hooks/stores/useRoadmapStore';
import type { RoadmapStep } from '@/server/queries/roadmaps';
import { ActivityIndicator } from 'react-native';
import { Check, Play, Clock, BookOpen, Zap, ChevronRight, Trash2 } from 'lucide-react-native';
import { useRouter } from 'expo-router';

interface RoadmapDisplayProps {
  roadmapId: string;
  onTakeQuiz?: (quizId: string, stepTitle: string) => void;
  onViewResults?: (quizId: string, stepTitle: string) => void;
  onDelete?: () => void;
}

export function RoadmapDisplay({ roadmapId, onTakeQuiz, onViewResults, onDelete }: RoadmapDisplayProps) {
  const [generatingQuizForStep, setGeneratingQuizForStep] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const router = useRouter();
  const { currentUser } = useUserStore();
  const { 
    currentRoadmap, 
    isLoading, 
    isGeneratingQuiz,
    error, 
    loadRoadmapDetails,
    generateQuizForPrerequisite,
    deleteRoadmap,
    clearError
  } = useRoadmapStore();

  useEffect(() => {
    if (currentUser && roadmapId) {
      loadRoadmapDetails(roadmapId, currentUser.id);
    }
  }, [roadmapId, currentUser]);

  const handleTakeQuiz = async (step: RoadmapStep) => {
    if (!currentUser) return;
    
    try {
      let quizId = step.quizId;
      
      // If no quiz exists, generate one
      if (!quizId) {
        setGeneratingQuizForStep(step.id);
        quizId = await generateQuizForPrerequisite(
          currentUser.id,
          roadmapId,
          step.id,
          step.title
        );
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

    // Show dialog to check user's knowledge level
    Alert.alert(
      'Knowledge Assessment',
      'Are you totally new to this topic or have a little idea about it?',
      [
        {
          text: 'Totally New',
          onPress: () => {
            // User is new, show content directly
            router.push(`/topic/${step.topicId}`);
          }
        },
        {
          text: 'Have Little Idea',
          onPress: () => {
            // User has some knowledge, check if quiz is available
            if (step.quizId) {
              Alert.alert(
                'Take Quiz First',
                'Since you have some prior knowledge, please take the quiz first to assess your understanding. This will help us identify areas where you need more focus.',
                [
                  {
                    text: 'OK',
                    onPress: () => {
                      // Navigate to quiz
                      onTakeQuiz?.(step.quizId!, step.title);
                    }
                  }
                ]
              );
            } else {
              // No quiz available yet, need to generate
              Alert.alert(
                'Generate Quiz',
                'A quiz needs to be generated first. Would you like to generate it now?',
                [
                  {
                    text: 'Cancel',
                    style: 'cancel'
                  },
                  {
                    text: 'Generate Quiz',
                    onPress: () => handleTakeQuiz(step)
                  }
                ]
              );
            }
          }
        },
        {
          text: 'Cancel',
          style: 'cancel'
        }
      ]
    );
  };

  const handleDeleteRoadmap = async () => {
    if (!currentUser) return;

    Alert.alert(
      'Delete Roadmap',
      'Are you sure you want to delete this roadmap? This will permanently delete all quizzes, questions, attempts, and related data. This action cannot be undone.',
      [
        {
          text: 'Cancel',
          style: 'cancel'
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsDeleting(true);
              await deleteRoadmap(currentUser.id, roadmapId);
              Alert.alert(
                'Success',
                'Roadmap deleted successfully',
                [{ 
                  text: 'OK',
                  onPress: () => onDelete?.()
                }]
              );
            } catch (error) {
              console.error('Failed to delete roadmap:', error);
              Alert.alert(
                'Error',
                error instanceof Error ? error.message : 'Failed to delete roadmap',
                [{ text: 'OK' }]
              );
            } finally {
              setIsDeleting(false);
            }
          }
        }
      ]
    );
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'basic': return 'bg-green-100 text-green-800';
      case 'intermediate': return 'bg-yellow-100 text-yellow-800';
      case 'advanced': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStepStatus = (step: RoadmapStep) => {
    if (step.isCompleted) return 'completed';
    return 'available';
  };

  const getStepIcon = (status: string, hasQuiz: boolean) => {
    switch (status) {
      case 'completed':
        return <Check className="h-5 w-5 text-green-600" />;
      case 'available':
        return hasQuiz ? <Play className="h-5 w-5 text-blue-600" /> : <BookOpen className="h-5 w-5 text-gray-600" />;
      default:
        return <Clock className="h-5 w-5 text-gray-400" />;
    }
  };

  if (isLoading) {
    return (
      <View className="flex-1 justify-center items-center p-6">
        <ActivityIndicator size="large" />
        <Text className="mt-4 text-center text-muted-foreground">Loading roadmap...</Text>
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
      <View className="flex-1 justify-center items-center p-6">
        <Text className="text-center text-muted-foreground">No roadmap data available</Text>
      </View>
    );
  }

  const { roadmap, steps } = currentRoadmap;
  const completedSteps = steps.filter(step => step.isCompleted).length;
  const totalSteps = steps.length;
  const progressPercentage = totalSteps > 0 ? (completedSteps / totalSteps) * 100 : 0;

  return (
    <ScrollView className="flex-1 p-6 bg-background">
      <View className="space-y-6">
        {/* Header */}
        <Card>
          <CardHeader>
            <View className="flex-row items-start justify-between ">
              <View className="flex-1">
                <CardTitle>{roadmap.title}</CardTitle>
                <CardDescription>{roadmap.description}</CardDescription>
              </View>
              <Button
                variant="ghost"
                size="sm"
                onPress={handleDeleteRoadmap}
                disabled={isDeleting}
                className="ml-2"
              >
                {isDeleting ? (
                  <ActivityIndicator size="small" />
                ) : (
                  <Trash2 className="h-5 w-5 text-red-600" />
                )}
              </Button>
            </View>
          </CardHeader>
          <CardContent className="space-y-4">
            <View>
              <View className="flex-row justify-between items-center mb-2">
                <Text className="text-sm font-medium">Overall Progress</Text>
                <Text className="text-sm text-muted-foreground">
                  {completedSteps}/{totalSteps} completed
                </Text>
              </View>
              <Progress value={progressPercentage} className="h-3" />
              <Text className="text-xs text-muted-foreground mt-1">
                {Math.round(progressPercentage)}% complete
              </Text>
            </View>

            {roadmap.status === 'completed' && (
              <View className="bg-green-50 p-3 rounded-lg">
                <Text className="text-green-800 font-medium">🎉 Roadmap Completed!</Text>
                <Text className="text-green-700 text-sm">
                  Congratulations! You've mastered all prerequisites for this topic.
                </Text>
              </View>
            )}
          </CardContent>
        </Card>

        {/* Learning Path */}
        <Card>
          <CardHeader>
            <CardTitle>Learning Path</CardTitle>
            <CardDescription>
              Complete each prerequisite in order. Unlock new topics by passing quizzes.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <View className="space-y-3">
              {steps.map((step, index) => {
                const status = getStepStatus(step);
                const hasQuiz = Boolean(step.quizId);
                const isGeneratingThisQuiz = generatingQuizForStep === step.id;
                
                return (
                  <Pressable
                    key={step.id}
                    onPress={() => handleTopicPress(step)}
                    className={`border rounded-lg p-4 ${
                      status === 'completed' ? 'border-green-200 bg-green-50' :
                      'border-blue-200 bg-blue-50'
                    }`}
                  >
                    <View className="flex-row items-start space-x-3">
                      <View className="flex-shrink-0 mt-1">
                        {getStepIcon(status, hasQuiz)}
                      </View>
                      
                      <View className="flex-1">
                        <View className="flex-row items-center justify-between mb-2">
                          <View className="flex-1 flex-row items-center space-x-2">
                            <Text className="font-medium text-lg">{step.title}</Text>
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          </View>
                          <View className="flex-row items-center space-x-2">
                            <Badge className={getDifficultyColor(step.difficulty || 'basic')}>
                              <Text className="text-xs font-medium">
                                {step.difficulty || 'basic'}
                              </Text>
                            </Badge>
                            <Text className="text-xs text-muted-foreground">
                              Step {step.order}
                            </Text>
                          </View>
                        </View>
                        
                        {step.content && (
                          <Text className="text-sm text-muted-foreground mb-3 leading-5">
                            {step.content.replace(/#{1,6}\s/g, '').replace(/\*\*/g, '').substring(0, 150)}
                            {step.content.length > 150 ? '...' : ''}
                          </Text>
                        )}
                        
                        <View className="flex-row items-center justify-between">
                          <View className="flex-row items-center space-x-4">
                            {step.durationMinutes && (
                              <View className="flex-row items-center space-x-1">
                                <Clock className="h-4 w-4 text-muted-foreground" />
                                <Text className="text-xs text-muted-foreground">
                                  {Math.round(step.durationMinutes / 60)}h
                                </Text>
                              </View>
                            )}
                            
                            {hasQuiz && (
                              <View className="flex-row items-center space-x-1">
                                <Zap className="h-4 w-4 text-green-600" />
                                <Text className="text-xs text-green-600">
                                  Quiz Ready
                                </Text>
                              </View>
                            )}
                          </View>
                          
                          {status === 'available' && (
                            <View 
                              className="flex-row items-center space-x-2"
                              onStartShouldSetResponder={() => true}
                              onResponderGrant={() => {}}
                            >
                              {isGeneratingThisQuiz ? (
                                <View className="flex-row items-center space-x-2">
                                  <ActivityIndicator size="small" />
                                  <Text className="text-xs text-muted-foreground">
                                    Creating quiz...
                                  </Text>
                                </View>
                              ) : (
                                <>
                                  <Button
                                    size="sm"
                                    variant={hasQuiz ? 'default' : 'outline'}
                                    onPress={() => handleTakeQuiz(step)}
                                    disabled={isGeneratingQuiz}
                                  >
                                    <Text className={hasQuiz ? 'text-white text-sm' : 'text-sm'}>
                                      {hasQuiz ? 'Take Quiz' : 'Generate Quiz'}
                                    </Text>
                                  </Button>
                                  {hasQuiz && step.hasAttempt && onViewResults && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onPress={() => onViewResults(step.quizId!, step.title)}
                                    >
                                      <Text className="text-sm">View Results</Text>
                                    </Button>
                                  )}
                                </>
                              )}
                            </View>
                          )}
                          
                          {status === 'completed' && (
                            <View className="flex-row items-center space-x-2">
                              <Text className="text-xs text-green-600 font-medium">
                                ✅ Completed
                              </Text>
                              {hasQuiz && step.hasAttempt && onViewResults && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onPress={() => onViewResults(step.quizId!, step.title)}
                                >
                                  <Text className="text-sm">View Results</Text>
                                </Button>
                              )}
                            </View>
                          )}
                        </View>
                      </View>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </CardContent>
        </Card>

        {/* Progress Summary */}
        <Card>
          <CardHeader>
            <CardTitle>Progress Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <View className="space-y-2">
              <View className="flex-row justify-between items-center">
                <Text className="text-sm text-muted-foreground">Total Steps</Text>
                <Text className="text-sm">{totalSteps}</Text>
              </View>
              <View className="flex-row justify-between items-center">
                <Text className="text-sm text-muted-foreground">Completed</Text>
                <Text className="text-sm">{completedSteps}</Text>
              </View>
              <View className="flex-row justify-between items-center">
                <Text className="text-sm text-muted-foreground">Remaining</Text>
                <Text className="text-sm">{totalSteps - completedSteps}</Text>
              </View>
            </View>
          </CardContent>
        </Card>
      </View>
    </ScrollView>
  );
}