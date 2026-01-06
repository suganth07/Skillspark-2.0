import React, { useState, useMemo } from 'react';
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
import { useCategorizedRoadmaps, useDeleteRoadmap } from '@/hooks/queries/useRoadmapQueries';
import { RoadmapCreation } from '@/components/roadmap/RoadmapCreation';
import { RoadmapCard } from '@/components/roadmap/RoadmapCard';
import { RoadmapSkeleton } from '@/components/roadmap/RoadmapSkeleton';
import { RoadmapEmptyState } from '@/components/roadmap/RoadmapEmptyState';
import { ActivityIndicator } from 'react-native';
import { Plus, Search, Rocket, BookOpen } from 'lucide-react-native';

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
    data: categorizedData, 
    isLoading, 
    error,
    refetch: refetchRoadmaps 
  } = useCategorizedRoadmaps(currentUserId || undefined);

  // Filter roadmaps based on search query
  const filteredRoadmaps = useMemo(() => {
    if (!categorizedData) return null;
    const query = searchQuery.toLowerCase();
    
    const filtered = categorizedData.standalone.filter(r => 
      r.title.toLowerCase().includes(query)
    );
    
    return filtered;
  }, [categorizedData, searchQuery]);
  
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
              <Rocket size={32} color="#7c3aed" />
            </View>
            
            <View className="flex-1">
              <Text className="text-2xl font-bold text-foreground">
                Learning Roadmaps
              </Text>
              <Text className="text-sm text-muted-foreground mt-0.5">
                AI-powered paths to master any topic
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
              onRetry={() => currentUserId && refetchRoadmaps()}
              variant="card"
            />
          </View>
        )}

        {/* Empty State */}
        {!isLoading && !error && (!categorizedData || categorizedData.standalone.length === 0) && (
          <View className="flex-1 items-center justify-center py-16">
            <RoadmapEmptyState />
          </View>
        )}

        {/* Main Content - Roadmaps */}
        {!isLoading && !error && filteredRoadmaps && filteredRoadmaps.length > 0 && (
          <View className="space-y-6">
            {/* Search Section */}
            <View>
              <View className="relative">
                <Input
                  placeholder="Search roadmaps..."
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

            {/* Roadmaps List */}
            <View>
              {/* Section Header */}
              <View className="mb-4">
                <Text className="text-base font-medium text-muted-foreground">
                  {filteredRoadmaps.length === 0 
                    ? 'No roadmaps found' 
                    : searchQuery 
                      ? `Found ${filteredRoadmaps.length} ${filteredRoadmaps.length === 1 ? 'result' : 'results'}`
                      : 'Your learning paths'
                  }
                </Text>
              </View>
              
              {/* Roadmap Cards */}
              {filteredRoadmaps.length > 0 ? (
                <View className="space-y-4">
                  {filteredRoadmaps.map((roadmap, index) => (
                      <View key={roadmap.id}>
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
                          <View style={{ position: 'relative', zIndex: 1}}>
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
                ) : (
                  <View className="items-center py-16 px-6">
                    <BookOpen size={56} className="text-muted-foreground/40 mb-4" />
                    <Text className="text-base font-medium text-muted-foreground text-center mb-2">
                      {searchQuery ? 'No matches found' : 'No roadmaps yet'}
                    </Text>
                    <Text className="text-sm text-muted-foreground/70 text-center">
                      {searchQuery 
                        ? `No roadmaps match "${searchQuery}". Try a different search.` 
                        : 'Create your first roadmap to get started!'
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