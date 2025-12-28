import React, { useState, useEffect } from 'react';
import { View, Alert, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ErrorDisplay } from '@/components/ui/error-display';
import { ScrollView } from 'react-native-gesture-handler';
import { useUserStore } from '@/hooks/stores/useUserStore';
import { useColorScheme } from '@/lib/useColorScheme';
import { getUserRoadmaps, deleteRoadmap } from '@/server/queries/roadmaps';
import type { RoadmapWithProgress } from '@/server/queries/roadmaps';
import { RoadmapCreation } from '@/components/roadmap/RoadmapCreation';
import { RoadmapDisplay } from '@/components/roadmap/RoadmapDisplay';
import { QuizComponent } from '@/components/roadmap/QuizComponent';
import { QuizResults } from '@/components/roadmap/QuizResults';
import { RoadmapCard } from '@/components/roadmap/RoadmapCard';
import { RoadmapSkeleton } from '@/components/roadmap/RoadmapSkeleton';
import { RoadmapEmptyState } from '@/components/roadmap/RoadmapEmptyState';
import { ActivityIndicator } from 'react-native';
import { Plus, ArrowLeft, Search, Rocket } from 'lucide-react-native';

type ScreenState = 
  | { type: 'dashboard' }
  | { type: 'create' }
  | { type: 'roadmap'; roadmapId: string }
  | { type: 'quiz'; quizId: string; stepTitle: string; roadmapId?: string }
  | { type: 'results'; quizId: string; stepTitle: string; roadmapId?: string };

export default function RoadmapScreen() {
  const [screenState, setScreenState] = useState<ScreenState>({ type: 'dashboard' });
  const [deletingRoadmapId, setDeletingRoadmapId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [roadmaps, setRoadmaps] = useState<RoadmapWithProgress[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { currentUser, isLoading: userLoading } = useUserStore();
  const { isDarkColorScheme } = useColorScheme();

  const loadUserRoadmaps = async (userId: string) => {
    try {
      setIsLoading(true);
      setError(null);
      const userRoadmaps = await getUserRoadmaps(userId);
      setRoadmaps(userRoadmaps);
    } catch (err) {
      console.error('Failed to load roadmaps:', err);
      const errorMessage = err instanceof Error ? 
        (err.message.toLowerCase().includes('network') ? 'Failed to connect. Please check your internet connection.' : err.message) :
        'Failed to load roadmaps';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

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
              await loadUserRoadmaps(currentUser.id);
            } catch (error) {
              setDeletingRoadmapId(null);
              console.error('Failed to delete roadmap:', error);
              setDeleteError(error instanceof Error ? error.message : 'Failed to delete roadmap');
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
          {/* Rocket Icon with Glow */}
          <View className="mr-3">
            <View
              style={{
                shadowColor: '#7c3aed',
                shadowOffset: { width: 0, height: 0 },
                shadowOpacity: 0.6,
                shadowRadius: 12,
                elevation: 8,
              }}
            >
              <Rocket 
                size={28} 
                color="#7c3aed"
              />
            </View>
          </View>
          
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
          {/* Delete Error */}
          {deleteError && (
            <ErrorDisplay
              error={deleteError}
              onDismiss={() => setDeleteError(null)}
              variant="inline"
            />
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
              <RoadmapEmptyState />
            </View>
          )}

          {/* Roadmaps List */}
          {!isLoading && !error && roadmaps.length > 0 && (
            <View className="space-y-4">
              {/* Search Bar */}
              <View className="relative">
                <Input
                  placeholder="Search roadmaps..."
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  className="pl-10 h-11 bg-secondary/50 border-border"
                />
                <View className="absolute left-3 top-0 bottom-0 justify-center">
                  <Search 
                    size={18} 
                    className="text-muted-foreground"
                  />
                </View>
              </View>
              
              <Text className="text-base pt-2 font-semibold text-foreground">
                Your Roadmaps ({roadmaps.filter(r => r.title.toLowerCase().includes(searchQuery.toLowerCase())).length})
              </Text>
              
              {roadmaps
                .filter(roadmap => roadmap.title.toLowerCase().includes(searchQuery.toLowerCase()))
                .map((roadmap, index) => (
                <View key={roadmap.id} className='py-2'>
                  {/* Purple glow container */}
                  <View className="relative">
                    {/* Glow effect */}
                    <View 
                      className="absolute -inset-[1px] rounded-xl" 
                      style={{ 
                        backgroundColor: 'rgba(124, 58, 237, 0.08)',
                        shadowColor: '#7c3aed',
                        shadowOffset: { width: 0, height: 0 },
                        shadowOpacity: 0.4,
                        shadowRadius: 16,
                        elevation: 10,
                      }}
                    />
                    {/* Card */}
                    <View style={{ position: 'relative', zIndex: 1 }}>
                      <RoadmapCard
                        roadmap={roadmap}
                        index={index}
                        onPress={() => setScreenState({ type: 'roadmap', roadmapId: roadmap.id })}
                        onDelete={() => handleDeleteRoadmap(roadmap.id, roadmap.title)}
                        isDeleting={deletingRoadmapId === roadmap.id}
                      />
                    </View>
                  </View>
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
          <RoadmapCreation 
            onRoadmapCreated={handleRoadmapCreated}
            onBack={() => setScreenState({ type: 'dashboard' })}
          />
        </SafeAreaView>
      );

    case 'roadmap':
      return (
        <SafeAreaView className="flex-1 bg-background" edges={['top']}>
          <View className="flex-row items-center px-4 py-3 border-b border-border bg-background">
            <Pressable 
              onPress={() => setScreenState({ type: 'dashboard' })}
              className="h-9 w-9 items-center justify-center rounded-lg active:bg-secondary"
            >
              <ArrowLeft size={20} color={isDarkColorScheme ? '#fafafa' : '#0a0a0a'} />
            </Pressable>
          </View>
          <RoadmapDisplay 
            roadmapId={screenState.roadmapId}
            onTakeQuiz={(quizId, stepTitle) => handleTakeQuiz(quizId, stepTitle, screenState.roadmapId)}
            onViewResults={(quizId, stepTitle) => handleViewResults(quizId, stepTitle, screenState.roadmapId)}
            onDelete={() => setScreenState({ type: 'dashboard' })}
          />
        </SafeAreaView>
      );

    case 'quiz':
      return (
        <SafeAreaView className="flex-1 bg-background" edges={['top']}>
          <View className="flex-1">
            <View className="flex-row items-center px-4 py-3 border-b border-border">
            <Pressable 
              onPress={() => {
                if (screenState.roadmapId) {
                  setScreenState({ type: 'roadmap', roadmapId: screenState.roadmapId });
                } else {
                  setScreenState({ type: 'dashboard' });
                }
              }}
              className="h-9 w-9 items-center justify-center rounded-lg active:bg-secondary"
            >
              <ArrowLeft size={20} color={isDarkColorScheme ? '#fafafa' : '#0a0a0a'} />
            </Pressable>
            <Text className="text-lg font-semibold flex-1 ml-3" numberOfLines={1}>
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
          <View className="flex-row items-center px-4 py-3 border-b border-border bg-background">
            <Pressable 
              onPress={handleCloseResults}
              className="h-9 w-9 items-center justify-center rounded-lg active:bg-secondary"
            >
              <ArrowLeft size={20} color={isDarkColorScheme ? '#fafafa' : '#0a0a0a'} />
            </Pressable>
            <Text className="text-lg font-semibold flex-1 ml-3" numberOfLines={1}>
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