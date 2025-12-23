import React, { useState, useEffect } from 'react';
import { View, Alert, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ErrorDisplay } from '@/components/ui/error-display';
import { ScrollView } from 'react-native-gesture-handler';
import { useUserStore } from '@/hooks/stores/useUserStore';
import { useRoadmapStore } from '@/hooks/stores/useRoadmapStore';
import { RoadmapCreation } from '@/components/roadmap/RoadmapCreation';
import { RoadmapDisplay } from '@/components/roadmap/RoadmapDisplay';
import { QuizComponent } from '@/components/roadmap/QuizComponent';
import { QuizResults } from '@/components/roadmap/QuizResults';
import { RoadmapCard } from '@/components/roadmap/RoadmapCard';
import { RoadmapSkeleton } from '@/components/roadmap/RoadmapSkeleton';
import { RoadmapEmptyState } from '@/components/roadmap/RoadmapEmptyState';
import { ProgressTimeline } from '@/components/roadmap/ProgressTimeline';
import { ProgressTimelineSkeleton } from '@/components/roadmap/ProgressTimelineSkeleton';
import { ActivityIndicator } from 'react-native';
import { Plus, BookOpen, CheckCircle, TrendingUp } from 'lucide-react-native';

type ScreenState = 
  | { type: 'dashboard' }
  | { type: 'create' }
  | { type: 'roadmap'; roadmapId: string }
  | { type: 'quiz'; quizId: string; stepTitle: string; roadmapId?: string }
  | { type: 'results'; quizId: string; stepTitle: string; roadmapId?: string };

export default function RoadmapScreen() {
  const [screenState, setScreenState] = useState<ScreenState>({ type: 'dashboard' });
  const [deletingRoadmapId, setDeletingRoadmapId] = useState<string | null>(null);
  const { currentUser, isLoading: userLoading } = useUserStore();
  const { 
    roadmaps, 
    isLoading, 
    error, 
    loadUserRoadmaps,
    deleteRoadmap
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

  const handleViewResults = (quizId: string, stepTitle: string, roadmapId?: string) => {
    setScreenState({ type: 'results', quizId, stepTitle, roadmapId });
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

  const handleCloseResults = () => {
    // Return to roadmap after viewing results
    if (screenState.type === 'results' && screenState.roadmapId) {
      setScreenState({ type: 'roadmap', roadmapId: screenState.roadmapId });
    } else {
      setScreenState({ type: 'dashboard' });
    }
  };

  const handleDeleteRoadmap = async (roadmapId: string, roadmapTitle: string) => {
    if (!currentUser) return;

    Alert.alert(
      'Delete Roadmap',
      `Are you sure you want to delete "${roadmapTitle}"? This will permanently delete all quizzes, questions, attempts, and related data. This action cannot be undone.`,
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
              setDeletingRoadmapId(roadmapId);
              await deleteRoadmap(currentUser.id, roadmapId);
              setDeletingRoadmapId(null);
              // Refresh the list
              loadUserRoadmaps(currentUser.id);
            } catch (error) {
              setDeletingRoadmapId(null);
              console.error('Failed to delete roadmap:', error);
              Alert.alert(
                'Error',
                error instanceof Error ? error.message : 'Failed to delete roadmap',
                [{ text: 'OK' }]
              );
            }
          }
        }
      ]
    );
  };



  // Show loading state while initializing user
  if (userLoading && !currentUser) {
    return (
      <SafeAreaView className="flex-1 bg-background" edges={['top']}>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" />
          <Text className="mt-4 text-muted-foreground">Initializing...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Render dashboard
  const renderDashboard = () => (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      {/* Sticky Header */}
      <View className="px-6 pt-4 pb-3 bg-background border-b border-border">
        <View className="flex-row items-center justify-between">
          <View className="flex-1">
            <Text className="text-2xl font-bold text-foreground">Learning Roadmaps</Text>
            <Text className="text-sm text-muted-foreground mt-1">
              AI-powered paths to master any topic
            </Text>
          </View>
          <Pressable 
            onPress={() => setScreenState({ type: 'create' })}
            className="h-10 w-10 items-center justify-center rounded-lg bg-primary active:opacity-80"
          >
            <Plus size={20} className="text-primary-foreground" />
          </Pressable>
        </View>
      </View>

      <ScrollView 
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerClassName="pb-6"
      >
        <View className="px-6 space-y-6 pt-5">
          {/* Progress Timeline - Only show if roadmaps exist */}
          {isLoading && (
            <ProgressTimelineSkeleton />
          )}
          
          {!isLoading && !error && roadmaps.length > 0 && (
            <ProgressTimeline roadmaps={roadmaps} />
          )}

          {/* Loading State with Skeletons */}
          {isLoading && <RoadmapSkeleton />}

          {/* Error State */}
          {error && !isLoading && (
            <ErrorDisplay
              error={error}
              onRetry={() => currentUser && loadUserRoadmaps(currentUser.id)}
              variant="card"
            />
          )}

          {/* Empty State */}
          {!isLoading && !error && roadmaps.length === 0 && (
            <View className="flex-1 items-center justify-center">
              <RoadmapEmptyState  onCreateRoadmap={() => setScreenState({ type: 'create' })} />
            </View>
          )}

          {/* Roadmaps List */}
          {!isLoading && !error && roadmaps.length > 0 && (
            <View className="space-y-4">
              <Text className="text-base pt-3 font-semibold text-foreground">
                Your Roadmaps ({roadmaps.length})
              </Text>
              
              {roadmaps.map((roadmap, index) => (
                <View key={roadmap.id} className='py-2'>
                <RoadmapCard
                  key={roadmap.id}
                  roadmap={roadmap}
                  index={index}
                  onPress={() => setScreenState({ type: 'roadmap', roadmapId: roadmap.id })}
                  onDelete={() => handleDeleteRoadmap(roadmap.id, roadmap.title)}
                  isDeleting={deletingRoadmapId === roadmap.id}
                />
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );

  // Render based on current screen state
  switch (screenState.type) {
    case 'create':
      return (
        <SafeAreaView className="flex-1 bg-background" edges={['top']}>
          <View className="flex-1">
            <View className="flex-row items-center p-4 border-b border-border">
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
        </SafeAreaView>
      );

    case 'roadmap':
      return (
        <SafeAreaView className="flex-1 bg-background" edges={['top']}>
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
            onViewResults={(quizId, stepTitle) => handleViewResults(quizId, stepTitle, screenState.roadmapId)}
            onDelete={() => setScreenState({ type: 'dashboard' })}
          />
          </View>
        </SafeAreaView>
      );

    case 'quiz':
      return (
        <SafeAreaView className="flex-1 bg-background" edges={['top']}>
          <View className="flex-1">
            <View className="flex-row items-center p-4 border-b border-border">
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
        </SafeAreaView>
      );

    case 'results':
      if (!currentUser) {
        return null;
      }
      return (
        <View className="flex-1">
          <View className="flex-row items-center p-4 border-b border-border bg-background">
            <Button 
              variant="ghost" 
              onPress={handleCloseResults}
              className="mr-3"
            >
              <Text>← Back</Text>
            </Button>
            <Text className="text-lg font-semibold flex-1" numberOfLines={1}>
              {screenState.stepTitle} Results
            </Text>
          </View>
          <QuizResults
            userId={currentUser.id}
            quizId={screenState.quizId}
            stepTitle={screenState.stepTitle}
            onClose={handleCloseResults}
          />
        </View>
      );

    default:
      return renderDashboard();
  }
}