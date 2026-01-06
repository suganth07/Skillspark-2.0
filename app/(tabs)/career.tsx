import React, { useState } from 'react';
import { View, Alert, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from '@/components/ui/text';
import { Input } from '@/components/ui/input';
import { ErrorDisplay } from '@/components/ui/error-display';
import { ScrollView } from 'react-native-gesture-handler';
import { useCurrentUserId } from '@/hooks/stores/useUserStore';
import { useUserCareerPaths, useDeleteCareerPath } from '@/hooks/queries/useCareerQueries';
import { RoadmapSkeleton } from '@/components/roadmap/RoadmapSkeleton';
import { RoadmapEmptyState } from '@/components/roadmap/RoadmapEmptyState';
import { CareerPathCreation } from '@/components/career/CareerPathCreation';
import { CareerPathCard } from '@/components/career/CareerPathCard';
import { Plus, Search, Briefcase } from 'lucide-react-native';
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
      {/* Header - Fixed at top */}
      <View className="bg-background border-b border-border">
        <View className="px-6 py-4">
          <View className="flex-row items-center justify-between">
            {/* Icon + Title Group */}
            <View className="flex-row items-center gap-3 flex-1">
              <View
                style={{
                  shadowColor: '#7c3aed',
                  shadowOffset: { width: 0, height: 0 },
                  shadowOpacity: 0.6,
                  shadowRadius: 12,
                  elevation: 8,
                }}
              >
                <Briefcase size={32} color="#7c3aed" />
              </View>
              
              <View className="flex-1">
                <Text className="text-2xl font-bold text-foreground">
                  Career Paths
                </Text>
                <Text className="text-sm text-muted-foreground mt-0.5">
                  AI-powered paths for your career goals
                </Text>
              </View>
            </View>

            {/* Create Button */}
            <Pressable 
              onPress={() => setScreenState({ type: 'create' })}
              className="h-11 w-11 items-center justify-center rounded-xl bg-primary active:opacity-80"
              style={{
                shadowColor: '#7c3aed',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.3,
                shadowRadius: 8,
                elevation: 4,
              }}
            >
              <Plus size={22} className="text-primary-foreground" />
            </Pressable>
          </View>
        </View>
      </View>

      {/* Main Content - Scrollable */}
      <ScrollView 
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerClassName="pb-8"
      >
        <View className="px-6 pt-6">
          {/* Delete Error Alert */}
          {deleteError && (
            <View className="mb-6">
              <ErrorDisplay
                error={deleteError}
                onDismiss={() => setDeleteError(null)}
                variant="inline"
              />
            </View>
          )}
          
          {/* Loading State */}
          {isLoading && (
            <View className="space-y-4">
              <RoadmapSkeleton />
            </View>
          )}

          {/* Error State */}
          {error && !isLoading && (
            <View className="mt-8">
              <ErrorDisplay
                error={error}
                onRetry={() => currentUserId && refetchCareerPaths()}
                variant="card"
              />
            </View>
          )}

          {/* Empty State */}
          {!isLoading && !error && careerPaths.length === 0 && (
            <View className="flex-1 items-center justify-center py-16">
              <RoadmapEmptyState />
            </View>
          )}

          {/* Main Content - Career Paths */}
          {!isLoading && !error && careerPaths.length > 0 && (
            <View className="space-y-6">
              {/* Search Section */}
              <View>
                <View className="relative">
                  <Input
                    placeholder="Search career paths..."
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    className="pl-11 pr-4 h-12 bg-secondary/50 border-border rounded-xl"
                  />
                  <View className="absolute left-4 top-0 bottom-0 justify-center">
                    <Search size={18} className="text-muted-foreground" />
                  </View>
                </View>
              </View>

              {/* Section Divider */}
              <View className="h-px bg-border" />

              {/* Career Paths List */}
              <View>
                {/* Section Header */}
                <View className="m-2">
                  <Text className="text-base font-medium text-muted-foreground">
                    {careerPaths.filter(cp => cp.roleName.toLowerCase().includes(searchQuery.toLowerCase())).length === 0 
                      ? 'No career paths found' 
                      : searchQuery 
                        ? `Found ${careerPaths.filter(cp => cp.roleName.toLowerCase().includes(searchQuery.toLowerCase())).length} ${careerPaths.filter(cp => cp.roleName.toLowerCase().includes(searchQuery.toLowerCase())).length === 1 ? 'result' : 'results'}`
                        : 'Your career learning paths'
                    }
                  </Text>
                </View>

                {/* Career Path Cards */}
                {careerPaths
                  .filter(path => path.roleName.toLowerCase().includes(searchQuery.toLowerCase()))
                  .length > 0 ? (
                  <View className="space-y-4">
                    {careerPaths
                      .filter(path => path.roleName.toLowerCase().includes(searchQuery.toLowerCase()))
                      .map((path, index) => (
                        <View key={path.id}>
                          <View className="relative">
                            {/* Glow Effect Background */}
                            <View 
                              className="absolute -inset-[1px] rounded-2xl" 
                              style={{ 
                                backgroundColor: 'rgba(124, 58, 237, 0.08)',
                                shadowColor: '#7c3aed',
                                shadowOffset: { width: 0, height: 4 },
                                shadowOpacity: 0.3,
                                shadowRadius: 12,
                                elevation: 8,
                              }}
                            />
                            {/* Card Content */}
                            <View style={{ position: 'relative', zIndex: 1 }}>
                              <CareerPathCard
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
                            </View>
                          </View>
                        </View>
                      ))}
                  </View>
                ) : (
                  <View className="items-center py-16 px-6">
                    <Briefcase size={56} className="text-muted-foreground/40 mb-4" />
                    <Text className="text-base font-medium text-muted-foreground text-center mb-2">
                      {searchQuery ? 'No matches found' : 'No career paths yet'}
                    </Text>
                    <Text className="text-sm text-muted-foreground/70 text-center">
                      {searchQuery 
                        ? `No career paths match "${searchQuery}". Try a different search.` 
                        : 'Create your first career path to get started!'
                      }
                    </Text>
                  </View>
                )}
              </View>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );

  // Render creation screen
  const renderCreateScreen = () => (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
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
