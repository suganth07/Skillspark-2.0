import React, { useState } from 'react';
import { View, Alert, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ErrorDisplay } from '@/components/ui/error-display';
import { ScrollView } from 'react-native-gesture-handler';
import { useCurrentUserId } from '@/hooks/stores/useUserStore';
import { useColorScheme } from '@/lib/useColorScheme';
import { useUserRoadmaps, useDeleteRoadmap } from '@/hooks/queries/useRoadmapQueries';
import { RoadmapCreation } from '@/components/roadmap/RoadmapCreation';
import { RoadmapCard } from '@/components/roadmap/RoadmapCard';
import { RoadmapSkeleton } from '@/components/roadmap/RoadmapSkeleton';
import { RoadmapEmptyState } from '@/components/roadmap/RoadmapEmptyState';
import { ActivityIndicator } from 'react-native';
import { Plus, ArrowLeft, Search, Rocket } from 'lucide-react-native';

type ScreenState = 
  | { type: 'dashboard' }
  | { type: 'create' };

export default function RoadmapScreen() {
  const [screenState, setScreenState] = useState<ScreenState>({ type: 'dashboard' });
  const router = useRouter();
  const [deletingRoadmapId, setDeletingRoadmapId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const currentUserId = useCurrentUserId();
  const { isDarkColorScheme } = useColorScheme();

  // TanStack Query hooks - automatic caching and refetching
  const { 
    data: roadmaps = [], 
    isLoading, 
    error,
    refetch: refetchRoadmaps 
  } = useUserRoadmaps(currentUserId || undefined);
  
  const deleteRoadmapMutation = useDeleteRoadmap();

  const handleRoadmapCreated = (roadmapId: string) => {
    // Navigate to the roadmap route
    router.push(`/roadmap/${roadmapId}` as any);
  };

  const handleDeleteRoadmap = async (roadmapId: string, roadmapTitle: string) => {
    if (!currentUserId) return;

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
              await deleteRoadmapMutation.mutateAsync({ 
                userId: currentUserId, 
                roadmapId 
              });
              setDeletingRoadmapId(null);
              // TanStack Query automatically updates cache
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
              onRetry={() => currentUserId && refetchRoadmaps()}
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
                        onPress={() => router.push(`/roadmap/${roadmap.id}` as any)}
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
  if (screenState.type === 'create') {
    return (
      <SafeAreaView className="flex-1 bg-background" edges={['top']}>
        <RoadmapCreation 
          onRoadmapCreated={handleRoadmapCreated}
          onBack={() => setScreenState({ type: 'dashboard' })}
        />
      </SafeAreaView>
    );
  }

  return renderDashboard();
}