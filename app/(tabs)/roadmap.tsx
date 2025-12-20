import React, { useState, useEffect } from 'react';
import { View } from 'react-native';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ErrorDisplay } from '@/components/ui/error-display';
import { ScrollView } from 'react-native-gesture-handler';
import { useUserStore } from '@/hooks/stores/useUserStore';
import { useRoadmapStore } from '@/hooks/stores/useRoadmapStore';
import { RoadmapCreation } from '@/components/roadmap/RoadmapCreation';
import { RoadmapDisplay } from '@/components/roadmap/RoadmapDisplay';
import { QuizComponent } from '@/components/roadmap/QuizComponent';
import { ActivityIndicator } from 'react-native';
import { Plus, BookOpen, TrendingUp, Clock, CheckCircle, ArrowRight } from 'lucide-react-native';

type ScreenState = 
  | { type: 'dashboard' }
  | { type: 'create' }
  | { type: 'roadmap'; roadmapId: string }
  | { type: 'quiz'; quizId: string; stepTitle: string; roadmapId?: string };

export default function RoadmapScreen() {
  const [screenState, setScreenState] = useState<ScreenState>({ type: 'dashboard' });
  const { currentUser, isLoading: userLoading } = useUserStore();
  const { 
    roadmaps, 
    isLoading, 
    error, 
    loadUserRoadmaps 
  } = useRoadmapStore();

  useEffect(() => {
    if (currentUser) {
      loadUserRoadmaps(currentUser.id);
    }
  }, [currentUser]);

  const handleRoadmapCreated = (roadmapId: string) => {
    setScreenState({ type: 'roadmap', roadmapId });
    if (currentUser) {
      loadUserRoadmaps(currentUser.id); // Refresh the list
    }
  };

  const handleTakeQuiz = (quizId: string, stepTitle: string, roadmapId?: string) => {
    setScreenState({ type: 'quiz', quizId, stepTitle, roadmapId });
  };

  const handleQuizComplete = () => {
    // Return to roadmap after quiz completion
    if (screenState.type === 'quiz' && screenState.roadmapId) {
      setScreenState({ type: 'roadmap', roadmapId: screenState.roadmapId });
    } else {
      setScreenState({ type: 'dashboard' });
    }
    if (currentUser) {
      loadUserRoadmaps(currentUser.id); // Refresh to update progress
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-green-600';
      case 'active': return 'text-blue-600';
      case 'archived': return 'text-gray-500';
      default: return 'text-gray-600';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'active': return <TrendingUp className="h-5 w-5 text-blue-600" />;
      case 'archived': return <Clock className="h-5 w-5 text-gray-500" />;
      default: return <BookOpen className="h-5 w-5 text-gray-600" />;
    }
  };

  // Show loading state while initializing user
  if (userLoading && !currentUser) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator size="large" />
        <Text className="mt-4 text-muted-foreground">Initializing...</Text>
      </View>
    );
  }

  // Render dashboard
  const renderDashboard = () => (
    <ScrollView className="flex-1 p-6 bg-background">
      <View className="space-y-6">
        {/* Header */}
        <View>
          <Text className="text-3xl font-bold mb-2">Your Learning Journey</Text>
          <Text className="text-muted-foreground text-lg">
            Master any topic with AI-powered roadmaps and interactive quizzes
          </Text>
        </View>

        {/* Quick Stats */}
        {roadmaps.length > 0 && (
          <View className="flex-row space-x-3">
            <Card className="flex-1">
              <CardContent className="p-4">
                <View className="flex-row items-center space-x-2">
                  <BookOpen className="h-5 w-5 text-blue-600" />
                  <View>
                    <Text className="text-sm text-muted-foreground">Active</Text>
                    <Text className="text-xl font-bold">
                      {roadmaps.filter(r => r.status === 'active').length}
                    </Text>
                  </View>
                </View>
              </CardContent>
            </Card>

            <Card className="flex-1">
              <CardContent className="p-4">
                <View className="flex-row items-center space-x-2">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <View>
                    <Text className="text-sm text-muted-foreground">Completed</Text>
                    <Text className="text-xl font-bold">
                      {roadmaps.filter(r => r.status === 'completed').length}
                    </Text>
                  </View>
                </View>
              </CardContent>
            </Card>

            <Card className="flex-1">
              <CardContent className="p-4">
                <View className="flex-row items-center space-x-2">
                  <TrendingUp className="h-5 w-5 text-purple-600" />
                  <View>
                    <Text className="text-sm text-muted-foreground">Avg. Progress</Text>
                    <Text className="text-xl font-bold">
                      {roadmaps.length > 0 
                        ? Math.round(roadmaps.reduce((acc, r) => acc + r.progress, 0) / roadmaps.length)
                        : 0}%
                    </Text>
                  </View>
                </View>
              </CardContent>
            </Card>
          </View>
        )}

        {/* Create New Roadmap Button */}
        <Button
          onPress={() => setScreenState({ type: 'create' })}
          className="flex-row items-center justify-center space-x-2 h-14"
        >
          <Plus className="h-5 w-5 text-white" />
          <Text className="text-white font-medium text-lg text-black">Create New Roadmap</Text>
        </Button>

        {/* Loading State */}
        {isLoading && (
          <View className="flex-row justify-center py-8">
            <ActivityIndicator size="large" />
          </View>
        )}

        {/* Error State */}
        {error && (
          <ErrorDisplay
            error={error}
            onRetry={() => currentUser && loadUserRoadmaps(currentUser.id)}
            variant="card"
          />
        )}

        {/* Roadmaps List */}
        {!isLoading && !error && (
          <>
            {roadmaps.length === 0 ? (
              <Card>
                <CardHeader>
                  <CardTitle>Welcome to SkillSpark! 🚀</CardTitle>
                  <CardDescription>
                    Start your learning journey by creating your first roadmap
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Text className="text-muted-foreground">
                    Our AI will analyze any topic you want to learn and create a personalized learning path with:
                  </Text>
                  <View className="space-y-2">
                    <View className="flex-row items-center space-x-2">
                      <Text className="text-blue-600">•</Text>
                      <Text className="text-sm text-muted-foreground">
                        Step-by-step prerequisites organized by difficulty
                      </Text>
                    </View>
                    <View className="flex-row items-center space-x-2">
                      <Text className="text-blue-600">•</Text>
                      <Text className="text-sm text-muted-foreground">
                        Interactive quizzes to test your knowledge
                      </Text>
                    </View>
                    <View className="flex-row items-center space-x-2">
                      <Text className="text-blue-600">•</Text>
                      <Text className="text-sm text-muted-foreground">
                        Progress tracking and personalized feedback
                      </Text>
                    </View>
                  </View>
                </CardContent>
              </Card>
            ) : (
              <View className="space-y-4">
                <Text className="text-xl font-semibold">Your Roadmaps</Text>
                {roadmaps.map((roadmap) => (
                  <Card key={roadmap.id}>
                    <CardHeader>
                      <View className="flex-row items-start justify-between">
                        <View className="flex-1">
                          <CardTitle className="text-lg">{roadmap.title}</CardTitle>
                          {roadmap.description && (
                            <CardDescription className="mt-1">
                              {roadmap.description}
                            </CardDescription>
                          )}
                        </View>
                        <View className="flex-row items-center space-x-1 ml-4">
                          {getStatusIcon(roadmap.status)}
                          <Text className={`text-sm font-medium ${getStatusColor(roadmap.status)}`}>
                            {roadmap.status}
                          </Text>
                        </View>
                      </View>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <View>
                        <View className="flex-row justify-between items-center mb-2">
                          <Text className="text-sm font-medium">Progress</Text>
                          <Text className="text-sm text-muted-foreground">
                            {roadmap.completedSteps}/{roadmap.stepsCount} completed
                          </Text>
                        </View>
                        <View className="w-full bg-gray-200 rounded-full h-2">
                          <View 
                            className="bg-blue-600 h-2 rounded-full"
                            style={{ width: `${roadmap.progress}%` }}
                          />
                        </View>
                        <Text className="text-xs text-muted-foreground mt-1">
                          {roadmap.progress}% complete
                        </Text>
                      </View>
                      
                      <View className="flex-row items-center justify-between">
                        <View>
                          {roadmap.createdAt && (
                            <Text className="text-xs text-muted-foreground">
                              Created {new Date(roadmap.createdAt).toLocaleDateString()}
                            </Text>
                          )}
                        </View>
                        
                        <Button
                          onPress={() => setScreenState({ type: 'roadmap', roadmapId: roadmap.id })}
                          className="flex-row items-center space-x-1"
                        >
                          <Text className="text-white">
                            {roadmap.status === 'completed' ? 'Review' : 'Continue'}
                          </Text>
                          <ArrowRight className="h-4 w-4 text-white" />
                        </Button>
                      </View>
                    </CardContent>
                  </Card>
                ))}
              </View>
            )}
          </>
        )}
      </View>
    </ScrollView>
  );

  // Render based on current screen state
  switch (screenState.type) {
    case 'create':
      return (
        <View className="flex-1">
          <View className="flex-row items-center p-4 border-b border-border bg-background">
            <Button 
              variant="ghost" 
              onPress={() => setScreenState({ type: 'dashboard' })}
              className="mr-3"
            >
              <Text>← Back</Text>
            </Button>
            <Text className="text-lg font-semibold">Create Roadmap</Text>
          </View>
          <RoadmapCreation onRoadmapCreated={handleRoadmapCreated} />
        </View>
      );

    case 'roadmap':
      return (
        <View className="flex-1">
          <View className="flex-row items-center p-4 border-b border-border bg-background">
            <Button 
              variant="ghost" 
              onPress={() => setScreenState({ type: 'dashboard' })}
              className="mr-3"
            >
              <Text>← Back</Text>
            </Button>
            <Text className="text-lg font-semibold">Learning Roadmap</Text>
          </View>
          <RoadmapDisplay 
            roadmapId={screenState.roadmapId}
            onTakeQuiz={(quizId, stepTitle) => handleTakeQuiz(quizId, stepTitle, screenState.roadmapId)}
          />
        </View>
      );

    case 'quiz':
      return (
        <View className="flex-1">
          <View className="flex-row items-center p-4 border-b border-border bg-background">
            <Button 
              variant="ghost" 
              onPress={() => {
                if (screenState.roadmapId) {
                  setScreenState({ type: 'roadmap', roadmapId: screenState.roadmapId });
                } else {
                  setScreenState({ type: 'dashboard' });
                }
              }}
              className="mr-3"
            >
              <Text>← Back</Text>
            </Button>
            <Text className="text-lg font-semibold flex-1" numberOfLines={1}>
              {screenState.stepTitle} Quiz
            </Text>
          </View>
          <QuizComponent
            quizId={screenState.quizId}
            roadmapId={screenState.roadmapId}
            onQuizComplete={handleQuizComplete}
            onBack={() => {
              if (screenState.roadmapId) {
                setScreenState({ type: 'roadmap', roadmapId: screenState.roadmapId });
              } else {
                setScreenState({ type: 'dashboard' });
              }
            }}
          />
        </View>
      );

    default:
      return renderDashboard();
  }
}