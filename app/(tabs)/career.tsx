import React, { useState } from 'react';
import { View, Alert, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from '@/components/ui/text';
import { Input } from '@/components/ui/input';
import { ErrorDisplay } from '@/components/ui/error-display';
import { ScrollView } from 'react-native-gesture-handler';
import { useCurrentUserId } from '@/hooks/stores/useUserStore';
import { useColorScheme } from '@/lib/useColorScheme';
import { useUserCareerPaths, useDeleteCareerPath } from '@/hooks/queries/useCareerQueries';
import { RoadmapSkeleton } from '@/components/roadmap/RoadmapSkeleton';
import { RoadmapEmptyState } from '@/components/roadmap/RoadmapEmptyState';
import { CareerPathCreation } from '@/components/career/CareerPathCreation';
import { CareerPathCard } from '@/components/career/CareerPathCard';
import { Plus, Search, Briefcase, ArrowLeft } from 'lucide-react-native';
import { useRouter } from 'expo-router';

type ScreenState = 
  | { type: 'dashboard' }
  | { type: 'create' }
  | { type: 'career'; careerPathId: string };

export default function CareerScreen() {
  const [screenState, setScreenState] = useState<ScreenState>({ type: 'dashboard' });
  const [deletingCareerPathId, setDeletingCareerPathId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const currentUserId = useCurrentUserId();
  const { isDarkColorScheme } = useColorScheme();
  const router = useRouter();

  // TanStack Query hooks - automatic caching and refetching
  const { 
    data: careerPaths = [], 
    isLoading, 
    error,
    refetch: refetchCareerPaths 
  } = useUserCareerPaths(currentUserId || undefined);
  
  const deleteCareerPathMutation = useDeleteCareerPath();

  const handleCareerPathCreated = (careerPathId: string) => {
    setScreenState({ type: 'career', careerPathId });
    // Navigate to career/[id]
    router.push(`/career/${careerPathId}` as any);
  };

  const handleDeleteCareerPath = async (careerPathId: string, roleName: string) => {
    if (!currentUserId) return;

    Alert.alert(
      'Delete Career Path',
      `Are you sure you want to delete the "${roleName}" career path? This will permanently delete all topics and progress. This action cannot be undone.`,
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
              setDeletingCareerPathId(careerPathId);
              await deleteCareerPathMutation.mutateAsync({ 
                userId: currentUserId, 
                careerPathId 
              });
              setDeletingCareerPathId(null);
              // TanStack Query automatically updates cache
            } catch (error) {
              setDeletingCareerPathId(null);
              console.error('Failed to delete career path:', error);
              setDeleteError(error instanceof Error ? error.message : 'Failed to delete career path');
            }
          }
        }
      ]
    );
  };

  // Show loading state while no user is available
  if (!currentUserId) {
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
          {/* Briefcase Icon with Glow */}
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
              <Briefcase 
                size={28} 
                color="#7c3aed"
              />
            </View>
          </View>
          
          <View className="flex-1">
            <Text className="text-2xl font-bold text-foreground">Career Paths</Text>
            <Text className="text-sm text-muted-foreground mt-1">
              AI-powered learning for your career goals
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
              onRetry={() => currentUserId && refetchCareerPaths()}
              variant="card"
            />
          )}

          {/* Empty State */}
          {!isLoading && !error && careerPaths.length === 0 && (
            <View className="flex-1 items-center justify-center">
              <RoadmapEmptyState />
            </View>
          )}

          {/* Career Paths List */}
          {!isLoading && !error && careerPaths.length > 0 && (
            <View className="space-y-4">
              {/* Search Bar */}
              <View className="relative">
                <Input
                  placeholder="Search career paths..."
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
                Your Career Paths ({careerPaths.filter(cp => cp.roleName.toLowerCase().includes(searchQuery.toLowerCase())).length})
              </Text>
              
              {careerPaths
                .filter(path => path.roleName.toLowerCase().includes(searchQuery.toLowerCase()))
                .map((path, index) => (
                <CareerPathCard
                  key={path.id}
                  careerPath={{
                    id: path.id,
                    roleName: path.roleName,
                    roleDescription: path.roleDescription,
                    totalEstimatedHours: path.totalEstimatedHours ?? 0,
                    progress: path.progress ?? 0,
                    topicsCount: path.topicsCount,
                    completedTopics: path.completedTopics,
                    categories: path.categories,
                    createdAt: path.createdAt,
                    status: (path.status as 'active' | 'completed' | 'archived') ?? 'active',
                  }}
                  onPress={() => router.push(`/career/${path.id}` as any)}
                  onDelete={() => handleDeleteCareerPath(path.id, path.roleName)}
                  isDeleting={deletingCareerPathId === path.id}
                  index={index}
                />
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );

  // Render creation screen
  const renderCreateScreen = () => (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <View className="flex-row items-center px-4 py-3 border-b border-border bg-background">
        <Pressable 
          onPress={() => setScreenState({ type: 'dashboard' })}
          className="h-9 w-9 items-center justify-center rounded-lg active:bg-secondary"
        >
          <ArrowLeft size={20} color={isDarkColorScheme ? '#fafafa' : '#0a0a0a'} />
        </Pressable>
      </View>
      <CareerPathCreation
        onCareerPathCreated={handleCareerPathCreated}
        onBack={() => setScreenState({ type: 'dashboard' })}
      />
    </SafeAreaView>
  );

  // Render based on current screen state
  switch (screenState.type) {
    case 'create':
      return renderCreateScreen();
    default:
      return renderDashboard();
  }
}
