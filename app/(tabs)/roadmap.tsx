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
import { Plus, ArrowLeft, Search, Rocket, Briefcase, BookOpen, ChevronDown, ChevronUp } from 'lucide-react-native';

type ScreenState = 
  | { type: 'dashboard' }
  | { type: 'create' };

export default function RoadmapScreen() {
  const [screenState, setScreenState] = useState<ScreenState>({ type: 'dashboard' });
  const router = useRouter();
  const [deletingRoadmapId, setDeletingRoadmapId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [expandedCareerPaths, setExpandedCareerPaths] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<'standalone' | 'career'>('standalone');
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
  const filteredData = useMemo(() => {
    if (!categorizedData) return null;
    const query = searchQuery.toLowerCase();
    
    const filteredStandalone = categorizedData.standalone.filter(r => 
      r.title.toLowerCase().includes(query)
    );
    
    const filteredCareer = categorizedData.career
      .map(group => ({
        ...group,
        roadmaps: group.roadmaps.filter(r => 
          r.title.toLowerCase().includes(query) || 
          group.careerPathName.toLowerCase().includes(query)
        )
      }))
      .filter(group => group.roadmaps.length > 0);
    
    return {
      standalone: filteredStandalone,
      career: filteredCareer,
      totalCount: filteredStandalone.length + filteredCareer.reduce((sum, g) => sum + g.roadmaps.length, 0)
    };
  }, [categorizedData, searchQuery]);
  
  const deleteRoadmapMutation = useDeleteRoadmap();

  const toggleCareerPath = (careerPathId: string) => {
    setExpandedCareerPaths(prev => {
      const next = new Set(prev);
      if (next.has(careerPathId)) {
        next.delete(careerPathId);
      } else {
        next.add(careerPathId);
      }
      return next;
    });
  };

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
        {!isLoading && !error && (!categorizedData || (categorizedData.standalone.length === 0 && categorizedData.career.length === 0)) && (
          <View className="flex-1 items-center justify-center py-16">
            <RoadmapEmptyState />
          </View>
        )}

        {/* Main Content - Roadmaps */}
        {!isLoading && !error && filteredData && filteredData.totalCount > 0 && (
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

            {/* Tab Toggle Buttons */}
            <View className="flex-row gap-3">
              <Pressable
                onPress={() => setActiveTab('standalone')}
                className={`flex-1 flex-row items-center justify-center gap-2.5 py-3.5 rounded-xl border-2 ${
                  activeTab === 'standalone' 
                    ? 'bg-purple-500/15 border-purple-500' 
                    : 'bg-secondary/40 border-border'
                }`}
              >
                <BookOpen 
                  size={20} 
                  color={activeTab === 'standalone' ? '#a855f7' : isDarkColorScheme ? '#9ca3af' : '#6b7280'} 
                />
                <Text className={`font-semibold text-base ${
                  activeTab === 'standalone' 
                    ? 'text-purple-600 dark:text-purple-400' 
                    : 'text-muted-foreground'
                }`}>
                  Standalone
                </Text>
                <View className={`px-2.5 py-1 rounded-full ${
                  activeTab === 'standalone' 
                    ? 'bg-purple-500/25' 
                    : 'bg-muted'
                }`}>
                  <Text className={`text-xs font-bold ${
                    activeTab === 'standalone' 
                      ? 'text-purple-600 dark:text-purple-400' 
                      : 'text-muted-foreground'
                  }`}>
                    {filteredData.standalone.length}
                  </Text>
                </View>
              </Pressable>

              <Pressable
                onPress={() => setActiveTab('career')}
                className={`flex-1 flex-row items-center justify-center gap-2.5 py-3.5 rounded-xl border-2 ${
                  activeTab === 'career' 
                    ? 'bg-blue-500/15 border-blue-500' 
                    : 'bg-secondary/40 border-border'
                }`}
              >
                <Briefcase 
                  size={20} 
                  color={activeTab === 'career' ? '#3b82f6' : isDarkColorScheme ? '#9ca3af' : '#6b7280'} 
                />
                <Text className={`font-semibold text-base ${
                  activeTab === 'career' 
                    ? 'text-blue-600 dark:text-blue-400' 
                    : 'text-muted-foreground'
                }`}>
                  Career
                </Text>
                <View className={`px-2.5 py-1 rounded-full ${
                  activeTab === 'career' 
                    ? 'bg-blue-500/25' 
                    : 'bg-muted'
                }`}>
                  <Text className={`text-xs font-bold ${
                    activeTab === 'career' 
                      ? 'text-blue-600 dark:text-blue-400' 
                      : 'text-muted-foreground'
                  }`}>
                    {filteredData.career.reduce((sum, g) => sum + g.roadmaps.length, 0)}
                  </Text>
                </View>
              </Pressable>
            </View>

            {/* Section Divider */}
            <View className="h-px bg-border" />

            {/* Standalone Roadmaps Tab */}
            {activeTab === 'standalone' && (
              <View>
                {/* Section Header */}
                <View className="mb-4">
                  <Text className="text-base font-medium text-muted-foreground">
                    {filteredData.standalone.length === 0 
                      ? 'No standalone roadmaps found' 
                      : searchQuery 
                        ? `Found ${filteredData.standalone.length} ${filteredData.standalone.length === 1 ? 'result' : 'results'}`
                        : 'Your self-created learning paths'
                    }
                  </Text>
                </View>
                
                {/* Roadmap Cards */}
                {filteredData.standalone.length > 0 ? (
                  <View className="space-y-4">
                    {filteredData.standalone.map((roadmap, index) => (
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
                ) : (
                  <View className="items-center py-16 px-6">
                    <BookOpen size={56} className="text-muted-foreground/40 mb-4" />
                    <Text className="text-base font-medium text-muted-foreground text-center mb-2">
                      {searchQuery ? 'No matches found' : 'No standalone roadmaps yet'}
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
            )}

            {/* Career Roadmaps Tab */}
            {activeTab === 'career' && (
              <View>
                {/* Section Header */}
                <View className="mb-4">
                  <Text className="text-base font-medium text-muted-foreground">
                    {filteredData.career.length === 0 
                      ? 'No career roadmaps found' 
                      : searchQuery 
                        ? `Found ${filteredData.career.reduce((sum, g) => sum + g.roadmaps.length, 0)} ${filteredData.career.reduce((sum, g) => sum + g.roadmaps.length, 0) === 1 ? 'result' : 'results'}`
                        : 'Organized by your career paths'
                    }
                  </Text>
                </View>

                {/* Career Groups */}
                {filteredData.career.length > 0 ? (
                  <View className="space-y-5">
                    {filteredData.career.map((careerGroup) => {
                      const isExpanded = expandedCareerPaths.has(careerGroup.careerPathId);
                      
                      return (
                        <View key={careerGroup.careerPathId}>
                          {/* Career Path Header */}
                          <Pressable
                            onPress={() => toggleCareerPath(careerGroup.careerPathId)}
                            className="flex-row items-center justify-between p-4 rounded-xl bg-secondary/60 border border-border active:opacity-80"
                          >
                            <View className="flex-row items-center gap-3 flex-1">
                              <View className="h-10 w-10 items-center justify-center rounded-lg bg-blue-500/20">
                                <Briefcase size={20} color="#3b82f6" />
                              </View>
                              <View className="flex-1">
                                <Text className="font-semibold text-base text-foreground" numberOfLines={1}>
                                  {careerGroup.careerPathName}
                                </Text>
                                <Text className="text-xs text-muted-foreground mt-0.5">
                                  {careerGroup.roadmaps.length} {careerGroup.roadmaps.length === 1 ? 'topic' : 'topics'}
                                </Text>
                              </View>
                            </View>
                            {isExpanded ? (
                              <ChevronUp size={20} className="text-muted-foreground" />
                            ) : (
                              <ChevronDown size={20} className="text-muted-foreground" />
                            )}
                          </Pressable>

                          {/* Expanded Roadmaps */}
                          {isExpanded && (
                            <View className="mt-3 pl-5 space-y-4 border-l-2 border-blue-500/40 ml-5">
                              {careerGroup.roadmaps.map((roadmap, index) => (
                                <View key={roadmap.id}>
                                  <View className="relative">
                                    {/* Glow Effect Background */}
                                    <View 
                                      className="absolute -inset-[1px] rounded-2xl" 
                                      style={{ 
                                        backgroundColor: 'rgba(59, 130, 246, 0.08)',
                                        shadowColor: '#3b82f6',
                                        shadowOffset: { width: 0, height: 4 },
                                        shadowOpacity: 0.3,
                                        shadowRadius: 12,
                                        elevation: 8,
                                      }}
                                    />
                                    {/* Card Content */}
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
                      );
                    })}
                  </View>
                ) : (
                  <View className="items-center py-16 px-6">
                    <Briefcase size={56} className="text-muted-foreground/40 mb-4" />
                    <Text className="text-base font-medium text-muted-foreground text-center mb-2">
                      {searchQuery ? 'No matches found' : 'No career roadmaps yet'}
                    </Text>
                    <Text className="text-sm text-muted-foreground/70 text-center">
                      {searchQuery 
                        ? `No roadmaps match "${searchQuery}". Try a different search.` 
                        : 'Career roadmaps will appear here when you create them.'
                      }
                    </Text>
                  </View>
                )}
              </View>
            )}
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