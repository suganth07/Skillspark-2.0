import React, { useState, useEffect, useMemo, useRef } from 'react';
import { View, ActivityIndicator, ScrollView, Pressable, Modal, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import * as SecureStore from 'expo-secure-store';
import { Audio } from 'expo-av';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ErrorDisplay } from '@/components/ui/error-display';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { LoadingAnimation } from '@/components/ui/loading-animation';
import { TopicDetailSkeleton } from '@/components/topic/TopicDetailSkeleton';
import { TopicSearchResultsModal } from '@/components/topic/TopicSearchResultsModal';
import { APIKeyRequiredDialog } from '@/components/ui/api-key-required-dialog';
import { BottomSheet } from '@/components/primitives/bottomSheet/bottom-sheet.native';
import { QuizComponent } from '@/components/roadmap/QuizComponent';
import { QuizResults } from '@/components/roadmap/QuizResults';
import { useCurrentUserId } from '@/hooks/stores/useUserStore';
import { useIsEmotionDetectionEnabled } from '@/hooks/stores/useEmotionStore';
import { useIsGeneratedVideosEnabled } from '@/hooks/stores/useGeneratedVideosStore';
import { useTopicDetail, usePersistTopicContent, useRegenerateSingleTone, useGenerateWebSearchContent, useRegenerateSelectedSubtopics, type SubtopicPerformance } from '@/hooks/queries/useTopicQueries';
import { useGenerateQuiz } from '@/hooks/queries/useRoadmapQueries';
import type { TopicExplanation } from '@/lib/gemini';
import { searchTopicUpdates } from '@/lib/webSearchService';
import { useWebSearchProvider } from '@/hooks/stores/useWebSearchProviderStore';
import { getItem, setItem, removeItem } from '@/lib/storage';
import { useColorScheme } from '@/lib/useColorScheme';
import { TopicEmotionDetector } from '@/components/emotion/TopicEmotionDetector';
import { ToneChangeModal } from '@/components/emotion/ToneChangeModal';
import { TopicVideoGenerator } from '@/components/topic/TopicVideoGenerator';
import { ToneSwitcher } from '@/components/topic/ToneSwitcher';
import MarkdownText from '@/components/ui/MarkdownText';
import { ChevronDown, ChevronUp, BookOpen, Code, Lightbulb, Sparkles, AlertCircle, RefreshCw, Loader2, Search, ExternalLink, CheckCircle2, Circle, Wand2, Settings2, ArrowLeft, MessageSquare, Rocket } from 'lucide-react-native';
import Animated, { FadeIn, FadeOut, ZoomIn } from 'react-native-reanimated';
import type { BottomSheetModal } from '@gorhom/bottom-sheet';

type ContentVersion = 'default' | 'simplified' | 'story';

export default function TopicDetailScreen() {
  const { id, webSearchResults: webSearchParam, topicName: topicNameParam, generateWebContent } = useLocalSearchParams<{ 
    id: string; 
    webSearchResults?: string;
    topicName?: string;
    generateWebContent?: string;
  }>();
  const router = useRouter();
  const currentUserId = useCurrentUserId();
  const isEmotionDetectionEnabled = useIsEmotionDetectionEnabled();
  const isGeneratedVideosEnabled = useIsGeneratedVideosEnabled();
  const provider = useWebSearchProvider();
  const { isDarkColorScheme } = useColorScheme();
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [subtopicVersions, setSubtopicVersions] = useState<Record<string, ContentVersion>>({});
  const [hasPersistedContent, setHasPersistedContent] = useState(false);
  const [webSearchResults, setWebSearchResults] = useState<string[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [webSearchContent, setWebSearchContent] = useState<TopicExplanation | null>(null);
  const [isGeneratingWebContent, setIsGeneratingWebContent] = useState(false);
  const [webSearchExpandedSections, setWebSearchExpandedSections] = useState<Set<string>>(new Set());
  const [webSearchSubtopicVersions, setWebSearchSubtopicVersions] = useState<Record<string, ContentVersion>>({});
  const [contentView, setContentView] = useState<'old' | 'new'>('old'); // Toggle between old and new content
  const [selectedSubtopics, setSelectedSubtopics] = useState<Set<string>>(new Set());
  const [isAskDoubtMode, setIsAskDoubtMode] = useState(false);
  const [showToneSwitcher, setShowToneSwitcher] = useState<Set<string>>(new Set());
  const [showWebSearchToneSwitcher, setShowWebSearchToneSwitcher] = useState<Set<string>>(new Set());
  const [showRegenerateModal, setShowRegenerateModal] = useState(false);
  const [regenerateInstructions, setRegenerateInstructions] = useState('');
  const [isRegeneratingSubtopics, setIsRegeneratingSubtopics] = useState(false);
  
  // Quiz state
  const [showQuiz, setShowQuiz] = useState(false);
  const [quizId, setQuizId] = useState<string | null>(null);
  const [isGeneratingQuiz, setIsGeneratingQuiz] = useState(false);
  const [showQuizResults, setShowQuizResults] = useState(false);
  const [showExitQuizModal, setShowExitQuizModal] = useState(false);
  
  // Collapsible sections state
  const [isBestPracticesExpanded, setIsBestPracticesExpanded] = useState(false);
  const [isCommonPitfallsExpanded, setIsCommonPitfallsExpanded] = useState(false);
  
  // Distraction detection state
  const [showDistractionAlert, setShowDistractionAlert] = useState(false);
  const [distractionCount, setDistractionCount] = useState(0);
  const soundRef = useRef<Audio.Sound | null>(null);
  const lastDistractionTime = useRef<number>(0);
  const [currentEmotion, setCurrentEmotion] = useState<string | null>(null);
  const lastToneSwitchTime = useRef<number>(0);
  
  // Tone change modal state
  const [showToneChangeModal, setShowToneChangeModal] = useState(false);
  const [newToneToShow, setNewToneToShow] = useState<'simplified' | 'story'>('simplified');
  
  // API Key Required Dialog state
  const [showApiKeyDialog, setShowApiKeyDialog] = useState(false);
  const [apiKeyDialogMessage, setApiKeyDialogMessage] = useState('');
  
  // Error and success message states
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  
  // Bottom sheet ref for search results
  const searchSheetRef = useRef<BottomSheetModal>(null);
  
  // Ref to track current expanded sections (for emotion callback access)
  const expandedSectionsRef = useRef<Set<string>>(new Set());

  // TanStack Query hook - automatic caching, loading, and error states
  const { 
    data: currentTopicDetail, 
    isLoading,
    isFetching,
    error,
    refetch 
  } = useTopicDetail(id, currentUserId || undefined);

  // Mutation to persist content to database
  const persistContentMutation = usePersistTopicContent();
  
  // Mutation to regenerate a single failed tone
  const regenerateToneMutation = useRegenerateSingleTone();

  // Mutation to generate web search content
  const generateWebSearchContentMutation = useGenerateWebSearchContent();

  // Mutation to regenerate selected subtopics
  const regenerateSelectedSubtopicsMutation = useRegenerateSelectedSubtopics();
  
  // Mutation to generate quiz
  const generateQuizMutation = useGenerateQuiz();

  // Show regeneration loading when fetching but already have data (refetching/regenerating)
  const isRegenerating = isFetching && !isLoading;

  // Memoize explanation to prevent unnecessary recalculations
  // MUST be called before any conditional returns to follow Rules of Hooks
  const explanation = useMemo(() => {
    if (!currentTopicDetail) return null;
    console.log('📚 Loading explanation with', currentTopicDetail.explanation.subtopics.length, 'subtopics');
    return currentTopicDetail.explanation;
  }, [currentTopicDetail]);

  // Check if topic has web search content in MMKV storage on mount
  useEffect(() => {
    if (id) {
      const storageKey = `webSearchContent_${id}`;
      const savedWebSearchContent = getItem<TopicExplanation>(storageKey);
      
      if (savedWebSearchContent) {
        console.log('📦 Found existing web search content in storage');
        // Add 'websearch-' prefix to all subtopic IDs to avoid conflicts with original content
        const contentWithUniqueIds = {
          ...savedWebSearchContent,
          subtopics: savedWebSearchContent.subtopics.map((st, index) => ({
            ...st,
            id: `websearch-${index + 1}`
          }))
        };
        setWebSearchContent(contentWithUniqueIds);
      }
    }
  }, [id]);

  // Generate web search content if params are passed
  useEffect(() => {
    if (generateWebContent === 'true' && webSearchParam && topicNameParam && !isGeneratingWebContent && !webSearchContent) {
      let parsedResults;
      try {
        parsedResults = JSON.parse(webSearchParam);
      } catch (e) {
        console.error('Failed to parse web search results param:', e);
        return;
      }
      if (parsedResults && parsedResults.length > 0) {
        setIsGeneratingWebContent(true);
        console.log(`🌐 Auto-generating web search content for: ${topicNameParam}`);
        
        generateWebSearchContentMutation.mutate({
          topicName: topicNameParam,
          webSearchResults: parsedResults,
          context: 'Latest Updates'
        }, {
          onSuccess: async (explanation) => {
            console.log('✅ Web search content generated successfully');
            
            // Add 'websearch-' prefix to all subtopic IDs to avoid conflicts with original content
            const contentWithUniqueIds = {
              ...explanation,
              subtopics: explanation.subtopics.map((st, index) => ({
                ...st,
                id: `websearch-${index + 1}`
              }))
            };
            
            setWebSearchContent(contentWithUniqueIds);
            setIsGeneratingWebContent(false);
            
            // Save web search content to MMKV storage (not database)
            if (id) {
              const storageKey = `webSearchContent_${id}`;
              console.log('💾 Saving web search content to storage');
              setItem(storageKey, contentWithUniqueIds);
            }
          },
          onError: (error) => {
            console.error('❌ Failed to generate web search content:', error);
            setIsGeneratingWebContent(false);
            setErrorMessage('Failed to generate content from web search results. Please try again.');
          }
        });
      }
    }
  }, [generateWebContent, webSearchParam, topicNameParam, isGeneratingWebContent, webSearchContent, generateWebSearchContentMutation, id]);

  // Persist content to database when it's generated (idempotent via server check)
  useEffect(() => {
    if (!currentTopicDetail || !currentUserId) {
      console.log('⏭️ Skipping persistence: missing topicDetail or userId');
      return;
    }

    const { topic, explanation, subtopicPerformance } = currentTopicDetail;
    
    // Log subtopic IDs for debugging
    console.log('🔍 Checking subtopic IDs:', explanation.subtopics.map(st => ({ id: st.id, title: st.title })));
    
    // Check if content was loaded from database vs freshly generated
    // Database content has CUID IDs (from createId()) which are 24-25 chars starting with 'c'
    // Fresh AI content has slugified IDs like "variables-and-expressions" or "subtopic-1"
    const isCUID = (id: string): boolean => {
      // CUIDs are 24-25 characters long and start with 'c' followed by alphanumeric
      return id.length >= 24 && /^c[a-z0-9]+$/.test(id);
    };
    
    const isFromDatabase = explanation.subtopics.some(st => st.id && isCUID(st.id));
    
    console.log(`🔍 Persistence check:
      - Subtopics count: ${explanation.subtopics.length}
      - Has persisted already: ${hasPersistedContent}
      - Is from database: ${isFromDatabase}
      - Sample ID: ${explanation.subtopics[0]?.id}
    `);
    
    // Only persist if:
    // 1. Content was generated (subtopics exist)
    // 2. NOT already saved locally this session (hasPersistedContent guard)
    // 3. Content is freshly generated from AI (not from database)
    const needsPersistence = explanation.subtopics.length > 0 && 
                             !hasPersistedContent && 
                             !isFromDatabase;
    
    // Derive regeneration from server state (subtopicPerformance exists = came from quiz)
    const isRegeneration = subtopicPerformance.size > 0;
    
    console.log(`🎯 Persistence decision: ${needsPersistence ? 'YES - will persist' : 'NO - skipping'}`);
    
    if (needsPersistence) {
      console.log('🔄 Persisting generated content to database...');
      console.log('📦 Payload:', {
        topicId: topic.id,
        userId: currentUserId,
        category: topic.category,
        subtopicsCount: explanation.subtopics.length,
        isRegeneration,
      });
      
      persistContentMutation.mutate({
        topicId: topic.id,
        userId: currentUserId,
        category: topic.category,
        explanation,
        isRegeneration,
      }, {
        onSuccess: () => {
          console.log('✅ Content successfully persisted to database!');
          setHasPersistedContent(true);
        },
        onError: (err) => {
          console.error('❌ Failed to persist content:', err);
          console.error('Error details:', JSON.stringify(err, null, 2));
        }
      });
    }
  }, [currentTopicDetail, currentUserId, hasPersistedContent, persistContentMutation]);

  const toggleSection = (sectionId: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(sectionId)) {
      newExpanded.delete(sectionId);
    } else {
      newExpanded.add(sectionId);
    }
    setExpandedSections(newExpanded);
    expandedSectionsRef.current = newExpanded;
    console.log(`📂 Toggled section ${sectionId}. Now expanded: ${newExpanded.size} section(s)`);
  };

  const setSubtopicVersion = (subtopicId: string, version: ContentVersion) => {
    setSubtopicVersions(prev => ({
      ...prev,
      [subtopicId]: version
    }));
  };

  const getSubtopicVersion = (subtopicId: string): ContentVersion => {
    return subtopicVersions[subtopicId] || 'default';
  };

  const handleTakeTest = async () => {
    if (!currentTopicDetail || !currentUserId) return;
    
    const { topic } = currentTopicDetail;
    
    try {
      // First, check if there's already a quiz for this topic
      const roadmap = await import('@/server/queries/topics').then(m => 
        m.getRoadmapByTopicId(topic.id, currentUserId)
      );
      
      if (!roadmap) {
        setErrorMessage('This topic is not part of any roadmap. Please access it through a roadmap to take a quiz.');
        return;
      }
      
      // Check if quiz already exists for this topic
      const { db } = await import('@/db/drizzle');
      const { quizzes, quizAttempts } = await import('@/db/schema');
      const { eq, and } = await import('drizzle-orm');
      
      const existingQuiz = await db
        .select({
          id: quizzes.id,
        })
        .from(quizzes)
        .where(and(
          eq(quizzes.topicId, topic.id),
          eq(quizzes.roadmapId, roadmap.id)
        ))
        .limit(1);
      
      if (existingQuiz.length > 0) {
        // Check if user has attempted this quiz
        const attempt = await db
          .select()
          .from(quizAttempts)
          .where(and(
            eq(quizAttempts.quizId, existingQuiz[0].id),
            eq(quizAttempts.userId, currentUserId)
          ))
          .limit(1);
        
        // If quiz exists and not attempted, reuse it
        if (attempt.length === 0) {
          console.log('📋 Reusing existing unattempted quiz:', existingQuiz[0].id);
          setQuizId(existingQuiz[0].id);
          setShowQuiz(true);
          return;
        }
      }
      
      // Show quiz modal with loading state immediately
      setQuizId(null);
      setShowQuiz(true);
      setIsGeneratingQuiz(true);
      
      // Get roadmap steps to find the step for this topic
      const { steps } = await import('@/server/queries/roadmaps').then(m => 
        m.getRoadmapWithSteps(roadmap.id, currentUserId)
      );
      
      const step = steps.find(s => s.topicId === topic.id);
      
      if (!step) {
        setShowQuiz(false);
        setIsGeneratingQuiz(false);
        setErrorMessage('Could not find the roadmap step for this topic.');
        return;
      }
      
      // Generate new quiz in background
      const result = await generateQuizMutation.mutateAsync({
        userId: currentUserId,
        roadmapId: roadmap.id,
        stepId: step.id,
        prerequisiteName: topic.name
      });
      
      setQuizId(result.quizId);
      setIsGeneratingQuiz(false);
    } catch (error) {
      console.error('Error generating quiz:', error);
      setShowQuiz(false);
      setIsGeneratingQuiz(false);
      setErrorMessage(error instanceof Error ? error.message : 'Failed to generate quiz. Please try again.');
    }
  };
  
  const handleAnalyze = () => {
    setSuccessMessage('Topic analysis feature coming soon! This will provide insights into your learning progress.');
  };
  
  const handleQuizComplete = () => {
    setShowQuiz(false);
    setShowQuizResults(false);
    // Refetch topic data to get updated performance
    refetch();
  };

  const handleWebSearch = async () => {
    if (!currentTopicDetail) return;
    
    // Check if web search API key is configured (either langsearch or googleserper)
    const langSearchKey = await SecureStore.getItemAsync('api_key_langsearch');
    const googleSerperKey = await SecureStore.getItemAsync('api_key_googleserper');
    
    if ((!langSearchKey || !langSearchKey.trim()) && (!googleSerperKey || !googleSerperKey.trim())) {
      setApiKeyDialogMessage('Web search requires either LangSearch or Google Serper API key. Please configure one in Settings.');
      setShowApiKeyDialog(true);
      return;
    }
    
    setIsSearching(true);
    // Open the bottom sheet immediately to show loading state
    searchSheetRef.current?.present();
    
    try {
      console.log(`🔍 Starting web search for topic: ${topic.name}`);
      const result = await searchTopicUpdates(topic.name, provider);
      
      console.log(`✅ Web search complete. Found ${result.newSubtopics.length} updates`);
      setWebSearchResults(result.newSubtopics);
    } catch (error) {
      console.error('❌ Web search failed:', error);
      setErrorMessage(error instanceof Error ? error.message : 'Failed to search for updates. Please try again.');
      searchSheetRef.current?.dismiss();
    } finally {
      setIsSearching(false);
    }
  };

  // Play distraction sound effect
  const playDistractionSound = async () => {
    try {
      // Configure audio mode for sound effects
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
      });

      // Unload previous sound if exists
      if (soundRef.current) {
        await soundRef.current.unloadAsync();
      }

      // Play a simple beep sound using a short audio tone
      const { sound } = await Audio.Sound.createAsync(
        { uri: 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBCyAx/DZiTYIGGS57+qFNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBCyAx/DZiTYIGGS57+qFNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBCyAx/DZiTYIGGS57+qFNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBCyAx/DZiTYIGGS57+qFNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBCyAx/DZiTYIGGS57+qFNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBCyAx/DZiTYIGGS57+qFNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBCyAx/DZiTYIGGS57+qFNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBCyAx/DZiTYIGGS57+qFNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAo=' },
        { shouldPlay: true, volume: 0.8 }
      );

      soundRef.current = sound;

      // Auto cleanup after 1 second
      setTimeout(async () => {
        try {
          await sound.unloadAsync();
        } catch (e) {
          // Ignore cleanup errors
        }
      }, 1000);
    } catch (error) {
      console.warn('Could not play distraction sound:', error);
      // Sound playback is optional, don't block the alert
    }
  };

  // Cleanup sound on unmount
  useEffect(() => {
    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync();
      }
    };
  }, []);

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-background" edges={['top']}>
        <Stack.Screen 
          options={{ 
            headerShown: false,
            animation: 'fade',
            animationDuration: 150,
          }} 
        />
        <View className="flex-row items-center px-4 py-3 border-b border-border bg-background">
          <Pressable 
            onPress={() => router.back()}
            className="h-9 w-9 items-center justify-center rounded-lg active:bg-secondary"
          >
            <ArrowLeft size={20} color={isDarkColorScheme ? '#fafafa' : '#0a0a0a'} />
          </Pressable>
        </View>
        <View className="flex-1 justify-center items-center px-6">
          <LoadingAnimation 
            title="Loading Topic"
            messages={[
              'Fetching topic details...',
              'Preparing learning content...',
              'Almost ready...',
            ]}
          />
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView className="flex-1 bg-background" edges={['top']}>
        <Stack.Screen 
          options={{ 
            headerShown: false,
            animation: 'fade',
            animationDuration: 150,
          }} 
        />
        <View className="flex-row items-center px-4 py-3 border-b border-border bg-background">
          <Pressable 
            onPress={() => router.back()}
            className="h-9 w-9 items-center justify-center rounded-lg active:bg-secondary"
          >
            <ArrowLeft size={20} color={isDarkColorScheme ? '#fafafa' : '#0a0a0a'} />
          </Pressable>
        </View>
        <ErrorDisplay
          error={error instanceof Error ? error.message : String(error)}
          onRetry={() => refetch()}
          title="Failed to load topic details"
        />
      </SafeAreaView>
    );
  }

  if (!currentTopicDetail) {
    return (
      <SafeAreaView className="flex-1 bg-background" edges={['top']}>
        <Stack.Screen 
          options={{ 
            headerShown: false,
            animation: 'fade',
            animationDuration: 150,
          }} 
        />
        <View className="flex-row items-center px-4 py-3 border-b border-border bg-background">
          <Pressable 
            onPress={() => router.back()}
            className="h-9 w-9 items-center justify-center rounded-lg active:bg-secondary"
          >
            <ArrowLeft size={20} color={isDarkColorScheme ? '#fafafa' : '#0a0a0a'} />
          </Pressable>
        </View>
        <View className="flex-1 justify-center items-center p-6">
          <Text className="text-center text-muted-foreground">Topic details not available</Text>
          <Button onPress={() => router.back()} className="mt-4">
            <Text className="text-white">Go Back</Text>
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  const topic = currentTopicDetail.topic;
  const subtopicPerformance = currentTopicDetail.subtopicPerformance;
  
  // explanation is already memoized above with deduplication applied
  if (!explanation) {
    return (
      <SafeAreaView className="flex-1 bg-background" edges={['top']}>
        <Stack.Screen 
          options={{ 
            headerShown: false,
            animation: 'fade',
            animationDuration: 150,
          }} 
        />
        <View className="flex-row items-center px-4 py-3 border-b border-border bg-background">
          <Pressable 
            onPress={() => router.back()}
            className="h-9 w-9 items-center justify-center rounded-lg active:bg-secondary"
          >
            <ArrowLeft size={20} color={isDarkColorScheme ? '#fafafa' : '#0a0a0a'} />
          </Pressable>
        </View>
        <View className="flex-1 justify-center items-center p-6">
          <Text className="text-center text-muted-foreground">Failed to load content</Text>
          <Button onPress={() => router.back()} className="mt-4">
            <Text className="text-white">Go Back</Text>
          </Button>
        </View>
      </SafeAreaView>
    );
  }
  
  console.log('📊 Subtopic Performance Map:', subtopicPerformance);
  console.log('📊 Performance Map size:', subtopicPerformance?.size);
  
  const getPerformanceForSubtopic = (subtopicId: string) => {
    const perf = subtopicPerformance?.get(subtopicId);
    console.log(`📊 Getting performance for subtopic ${subtopicId}:`, perf);
    return perf;
  };
  
  const getPerformanceColor = (status: string) => {
    switch (status) {
      case 'strong': return 'text-green-600';
      case 'weak': return 'text-red-600';
      case 'neutral': return 'text-yellow-600';
      default: return 'text-gray-600';
    }
  };
  
  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'basic': return { bg: 'bg-green-500', text: 'text-white' };
      case 'intermediate': return { bg: 'bg-amber-500', text: 'text-white' };
      case 'advanced': return { bg: 'bg-red-500', text: 'text-white' };
      default: return { bg: 'bg-gray-500', text: 'text-white' };
    }
  };

  // Get content based on selected version for a specific subtopic
  const getSubtopicContent = (subtopic: any, subtopicId: string) => {
    const version = getSubtopicVersion(subtopicId);
    
    switch (version) {
      case 'simplified':
        return {
          explanation: subtopic.explanationSimplified || subtopic.explanationDefault || '',
          example: subtopic.exampleSimplified || subtopic.example,
        };
      case 'story':
        return {
          explanation: subtopic.explanationStory || subtopic.explanationDefault || '',
          example: subtopic.exampleStory || subtopic.example,
        };
      default:
        return {
          explanation: subtopic.explanationDefault || '',
          example: subtopic.example,
        };
    }
  };

  // Check if a specific content tone failed to generate
  const isContentFailed = (version: ContentVersion): boolean => {
    if (!explanation.failedTones) return false;
    return explanation.failedTones[version] || false;
  };

  // Check if a specific tone is currently being regenerated
  const isRegeneratingTone = (tone: ContentVersion): boolean => {
    return regenerateToneMutation.isPending && 
           regenerateToneMutation.variables?.tone === tone;
  };

  // Handler for regenerating a specific content tone
  const handleRegenerateContent = async (tone: ContentVersion) => {
    if (!currentUserId || !currentTopicDetail) return;
    
    console.log(`🔄 Regenerating ${tone} content...`);
    
    // Get canonical titles from existing subtopics
    const canonicalTitles = explanation.subtopics.map(st => st.title);
    
    // Get context from roadmap or category
    const context = topic.category;
    
    regenerateToneMutation.mutate({
      topicId: topic.id,
      userId: currentUserId,
      topicName: topic.name,
      context,
      tone,
      canonicalTitles,
    });
  };

  // Handler for regenerating selected subtopics with custom instructions
  const handleRegenerateSelectedSubtopics = async () => {
    if (!currentUserId || !currentTopicDetail || selectedSubtopics.size === 0) return;
    
    if (!regenerateInstructions.trim()) {
      setErrorMessage('Please enter your question or instructions for regeneration.');
      return;
    }

    // Get the titles of selected subtopics
    const selectedSubtopicTitles = explanation.subtopics
      .filter(st => selectedSubtopics.has(st.id))
      .map(st => st.title);

    console.log(`🔄 Regenerating ${selectedSubtopicTitles.length} subtopics with instructions`);

    setIsRegeneratingSubtopics(true);
    setShowRegenerateModal(false);

    regenerateSelectedSubtopicsMutation.mutate({
      topicId: topic.id,
      userId: currentUserId,
      topicName: topic.name,
      context: topic.category,
      selectedSubtopicTitles,
      userInstructions: regenerateInstructions,
    }, {
      onSuccess: () => {
        setIsRegeneratingSubtopics(false);
        setSelectedSubtopics(new Set());
        setRegenerateInstructions('');
        setSuccessMessage('Selected subtopics have been regenerated with your instructions for all 3 learning styles.');
      },
      onError: (error) => {
        setIsRegeneratingSubtopics(false);
        setErrorMessage(error instanceof Error ? error.message : 'Failed to regenerate subtopics. Please try again.');
      },
    });
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <Stack.Screen 
        options={{ 
          headerShown: false,
          animation: 'fade',
          animationDuration: 150,
        }} 
      />
      
      {/* Custom Header with Back Button */}
      <View className="flex-row items-center px-4 py-3 border-b border-border bg-background">
        <Pressable 
          onPress={() => router.back()}
          className="h-9 w-9 items-center justify-center rounded-lg active:bg-secondary"
        >
          <ArrowLeft size={20} color={isDarkColorScheme ? '#fafafa' : '#0a0a0a'} />
        </Pressable>
      </View>
      
      {/* Regeneration Loading Overlay */}
      {isRegenerating && (
        <Animated.View 
          entering={FadeIn.duration(200)}
          exiting={FadeOut.duration(200)}
          className="absolute inset-0 z-50 bg-background/90 justify-center items-center"
          style={{ zIndex: 50 }}
        >
          <Card className="mx-8 p-6">
            <LoadingAnimation 
              title="Personalizing Content"
              messages={[
                'Regenerating learning material based on your quiz performance...',
                'Strengthening weak areas...',
                'Adapting to your level...',
                'Almost ready...',
              ]}
            />
          </Card>
        </Animated.View>
      )}
      
      <ScrollView className="flex-1">
        <View className="p-6 space-y-6">
          {/* Error Message Banner */}
          {errorMessage && (
            <Animated.View entering={FadeIn.duration(300)} exiting={FadeOut.duration(200)}>
              <Card className="bg-destructive/10 border-destructive">
                <View className="p-4 flex-row items-start gap-3">
                  <AlertCircle size={20} className="text-destructive mt-0.5" />
                  <View className="flex-1">
                    <Text className="text-sm text-destructive font-medium mb-2">
                      {errorMessage}
                    </Text>
                    <Pressable
                      onPress={() => setErrorMessage(null)}
                      className="self-start"
                    >
                      <Text className="text-xs text-destructive/80 font-medium">Dismiss</Text>
                    </Pressable>
                  </View>
                </View>
              </Card>
            </Animated.View>
          )}

          {/* Success Message Banner */}
          {successMessage && (
            <Animated.View entering={FadeIn.duration(300)} exiting={FadeOut.duration(200)}>
              <Card className="bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
                <View className="p-4 flex-row items-start gap-3">
                  <CheckCircle2 size={20} className="text-green-600 dark:text-green-400 mt-0.5" />
                  <View className="flex-1">
                    <Text className="text-sm text-green-700 dark:text-green-300 font-medium mb-2">
                      {successMessage}
                    </Text>
                    <Pressable
                      onPress={() => setSuccessMessage(null)}
                      className="self-start"
                    >
                      <Text className="text-xs text-green-600 dark:text-green-400 font-medium">Dismiss</Text>
                    </Pressable>
                  </View>
                </View>
              </Card>
            </Animated.View>
          )}

          {/* Content Generation Warning Banner */}
          {explanation.failedTones && (explanation.failedTones.default || explanation.failedTones.simplified || explanation.failedTones.story) && (
            <Card className="bg-yellow-50 border-yellow-200">
              <CardContent className="p-4">
                <View className="flex-row items-start space-x-3">
                  <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
                  <View className="flex-1">
                    <Text className="text-sm font-semibold text-yellow-900 mb-2">
                      Some content failed to generate
                    </Text>
                    
                    {/* Regenerate buttons for each failed tone */}
                    <View className="space-y-2">
                      {explanation.failedTones.default && (
                        <View className="flex-row items-center justify-between bg-yellow-100 rounded-lg p-2">
                          <Text className="text-xs text-yellow-800">Default content failed</Text>
                          <Button 
                            size="sm" 
                            variant="outline" 
                            className="h-7 px-2"
                            onPress={() => handleRegenerateContent('default')}
                            disabled={isRegeneratingTone('default')}
                          >
                            {isRegeneratingTone('default') ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <RefreshCw className="h-3 w-3 mr-1" />
                            )}
                            <Text className="text-xs">
                              {isRegeneratingTone('default') ? 'Regenerating...' : 'Regenerate'}
                            </Text>
                          </Button>
                        </View>
                      )}
                      
                      {explanation.failedTones.simplified && (
                        <View className="flex-row items-center justify-between bg-yellow-100 rounded-lg p-2">
                          <Text className="text-xs text-yellow-800">Simplified content failed</Text>
                          <Button 
                            size="sm" 
                            variant="outline" 
                            className="h-7 px-2"
                            onPress={() => handleRegenerateContent('simplified')}
                            disabled={isRegeneratingTone('simplified')}
                          >
                            {isRegeneratingTone('simplified') ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <RefreshCw className="h-3 w-3 mr-1" />
                            )}
                            <Text className="text-xs">
                              {isRegeneratingTone('simplified') ? 'Regenerating...' : 'Regenerate'}
                            </Text>
                          </Button>
                        </View>
                      )}
                      
                      {explanation.failedTones.story && (
                        <View className="flex-row items-center justify-between bg-yellow-100 rounded-lg p-2">
                          <Text className="text-xs text-yellow-800">Story content failed</Text>
                          <Button 
                            size="sm" 
                            variant="outline" 
                            className="h-7 px-2"
                            onPress={() => handleRegenerateContent('story')}
                            disabled={isRegeneratingTone('story')}
                          >
                            {isRegeneratingTone('story') ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <RefreshCw className="h-3 w-3 mr-1" />
                            )}
                            <Text className="text-xs">
                              {isRegeneratingTone('story') ? 'Regenerating...' : 'Regenerate'}
                            </Text>
                          </Button>
                        </View>
                      )}
                    </View>
                    
                    <Text className="text-xs text-yellow-600 mt-2">
                      Switch to working styles or regenerate failed content above.
                    </Text>
                  </View>
                </View>
              </CardContent>
            </Card>
          )}

          {/* Emotion Detection Card */}
          {isEmotionDetectionEnabled && (
            <TopicEmotionDetector 
              onEmotionDetected={(emotion, confidence) => {
                console.log(`📊 User emotion: ${emotion} (${(confidence * 100).toFixed(1)}%)`);
                console.log(`📋 Expanded sections: ${expandedSectionsRef.current.size}, Cooldown active: ${Date.now() - lastToneSwitchTime.current < 45000}`);
                setCurrentEmotion(emotion);
                
                // Detect if user is looking away/distracted
                if ((emotion === 'looking_away' && confidence > 0.5) || (emotion === 'distracted') || (emotion === 'drowsy' && confidence > 0.7)) {
                  const now = Date.now();
                  // Prevent multiple alerts within 30 seconds
                  if (now - lastDistractionTime.current > 30000) {
                    lastDistractionTime.current = now;
                    setDistractionCount(prev => prev + 1);
                    setShowDistractionAlert(true);
                    playDistractionSound();
                  }
                }
                
                // Automatic tone adjustment based on emotions
                if (confidence > 0.5) { // Act on 50%+ confidence detections
                  const now = Date.now();
                  // Prevent rapid tone switches (wait 45 seconds between switches)
                  if (now - lastToneSwitchTime.current > 45000) {
                    let targetTone: ContentVersion | null = null;
                    let shouldSwitch = false;
                    
                    if (emotion === 'bored' || emotion === 'drowsy') {
                      targetTone = 'story';
                      shouldSwitch = true;
                      console.log('😴 User seems bored/drowsy → Switching to Story mode');
                    } else if (emotion === 'frustrated' || emotion === 'confused') {
                      targetTone = 'simplified';
                      shouldSwitch = true;
                      console.log('😤 User seems frustrated/confused → Switching to Simplified mode');
                    }
                    
                    if (shouldSwitch && targetTone) {
                      lastToneSwitchTime.current = now;
                      
                      const currentExpandedSections = expandedSectionsRef.current;
                      console.log(`📋 Currently expanded sections: ${currentExpandedSections.size}`);
                      
                      // Only switch tone for currently expanded subtopics (don't auto-expand)
                      if (currentExpandedSections.size > 0) {
                        const updatedVersions: Record<string, ContentVersion> = {};
                        currentExpandedSections.forEach(subtopicId => {
                          const currentTone = subtopicVersions[subtopicId] || 'default';
                          console.log(`  → Subtopic ${subtopicId}: ${currentTone} → ${targetTone}`);
                          if (currentTone !== targetTone) {
                            updatedVersions[subtopicId] = targetTone;
                          }
                        });
                        
                        if (Object.keys(updatedVersions).length > 0) {
                          console.log(`✅ Updating ${Object.keys(updatedVersions).length} subtopic(s) to ${targetTone} mode`);
                          setSubtopicVersions(prev => ({ ...prev, ...updatedVersions }));
                          
                          // Show modal notification
                          console.log(`🔔 SHOWING TONE CHANGE MODAL: ${targetTone}`);
                          setNewToneToShow(targetTone);
                          setShowToneChangeModal(true);
                          console.log(`📱 Modal state set - isOpen should be true`);
                        } else {
                          console.log('ℹ️ All expanded subtopics already in target tone');
                        }
                      } else {
                        console.log('ℹ️ No subtopics expanded - skipping tone switch (open a subtopic to see adaptive content)');
                      }
                    }
                  } else {
                    const timeLeft = Math.round((45000 - (now - lastToneSwitchTime.current)) / 1000);
                    console.log(`⏳ Tone switch cooldown active (${timeLeft}s remaining)`);
                  }
                }
              }}
            />
          )}

          {/* Header - Clean, no card */}
          <View className="mb-6">
            <View className="flex-row items-start justify-between mb-3">
              <Text className="text-2xl font-bold text-foreground flex-1 pr-3" style={{ flexWrap: 'wrap' }}>
                {topic.name}
              </Text>
              {explanation.difficulty && (
                <View className={`px-3 py-1 rounded-full ${getDifficultyColor(explanation.difficulty).bg}`}>
                  <Text className={`text-xs font-semibold uppercase ${getDifficultyColor(explanation.difficulty).text}`}>
                    {explanation.difficulty}
                  </Text>
                </View>
              )}
            </View>
            <Text className="text-muted-foreground leading-6">
              {explanation.overview}
            </Text>
          </View>

          {/* Video Generation Section */}
          {isGeneratedVideosEnabled && currentUserId && (
            <TopicVideoGenerator
              topicId={id!}
              topicName={topic.name}
              userId={currentUserId}
              subtopics={explanation.subtopics}
            />
          )}

          {/* Action Buttons Row */}
          <View className="flex-row items-center gap-2 mb-4">
            {/* Search Button */}
            <Pressable
              onPress={handleWebSearch}
              disabled={isSearching}
              style={{
                flex: 1,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                paddingVertical: 10,
                borderRadius: 8,
                borderWidth: 1,
                borderColor: isDarkColorScheme ? '#3f3f46' : '#e4e4e7',
                backgroundColor: isDarkColorScheme ? '#27272a' : '#ffffff',
                opacity: isSearching ? 0.6 : 1,
              }}
            >
              {isSearching ? (
                <ActivityIndicator size="small" color={isDarkColorScheme ? '#a1a1aa' : '#52525b'} />
              ) : (
                <Search size={16} color={isDarkColorScheme ? '#a1a1aa' : '#52525b'} />
              )}
              <Text style={{ fontSize: 13, fontWeight: '500', color: isDarkColorScheme ? '#fafafa' : '#18181b' }}>
                {isSearching ? 'Searching...' : 'Search Updates'}
              </Text>
            </Pressable>
            
            {/* Ask a Doubt Button */}
            <Pressable
              onPress={() => {
                if (isAskDoubtMode) {
                  setIsAskDoubtMode(false);
                  setSelectedSubtopics(new Set());
                } else {
                  setIsAskDoubtMode(true);
                }
              }}
              style={{
                flex: 1,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                paddingVertical: 10,
                borderRadius: 8,
                backgroundColor: isAskDoubtMode 
                  ? (isDarkColorScheme ? '#6366f1' : '#4f46e5')
                  : (isDarkColorScheme ? '#27272a' : '#ffffff'),
                borderWidth: isAskDoubtMode ? 0 : 1,
                borderColor: isDarkColorScheme ? '#3f3f46' : '#e4e4e7',
              }}
            >
              <MessageSquare size={16} color={isAskDoubtMode ? '#ffffff' : (isDarkColorScheme ? '#a1a1aa' : '#52525b')} />
              <Text style={{ 
                fontSize: 13, 
                fontWeight: '500', 
                color: isAskDoubtMode ? '#ffffff' : (isDarkColorScheme ? '#fafafa' : '#18181b'),
              }}>
                {isAskDoubtMode ? 'Cancel' : 'Ask a Doubt'}
              </Text>
            </Pressable>
          </View>

          <View className="-mt-4">
            <CardContent className="pt-0">

              {/* Content View Toggle - Show only when web search content is available */}
              {webSearchContent && (
                <View className="mb-4">
                  <Text className="text-xs text-muted-foreground mb-2 text-center">
                    Switch between original and latest content
                  </Text>
                  <View className="flex-row gap-2">
                    <Pressable
                      onPress={() => setContentView('old')}
                      className={`flex-1 py-3 rounded-lg border-2 ${
                        contentView === 'old' 
                          ? 'bg-primary border-primary' 
                          : 'bg-background dark:bg-card border-border'
                      }`}
                    >
                      <View className="flex-row items-center justify-center gap-2">
                        <BookOpen 
                          size={16} 
                          color={contentView === 'old' ? '#ffffff' : (isDarkColorScheme ? '#a1a1aa' : '#52525b')} 
                        />
                        <Text 
                          className={`text-sm font-semibold ${
                            contentView === 'old' ? 'text-white' : 'text-foreground'
                          }`}
                        >
                          Original
                        </Text>
                      </View>
                    </Pressable>
                    <Pressable
                      onPress={() => setContentView('new')}
                      className={`flex-1 py-3 rounded-lg border-2 ${
                        contentView === 'new' 
                          ? 'bg-primary border-primary' 
                          : 'bg-background dark:bg-card border-border'
                      }`}
                    >
                      <View className="flex-row items-center justify-center gap-2">
                        <Sparkles 
                          size={16} 
                          color={contentView === 'new' ? '#ffffff' : (isDarkColorScheme ? '#a1a1aa' : '#52525b')} 
                        />
                        <Text 
                          className={`text-sm font-semibold ${
                            contentView === 'new' ? 'text-white' : 'text-foreground'
                          }`}
                        >
                          Latest
                        </Text>
                      </View>
                    </Pressable>
                  </View>
                </View>
              )}
            </CardContent>
          </View>

          {/* Web Search Generated Content - Show ABOVE existing subtopics */}
          {(isGeneratingWebContent || webSearchContent) && (
            <Card className="border-2 border-primary/20 bg-primary/5 dark:bg-primary/10">
              <CardHeader>
                <View className="flex-row items-center gap-2 mb-2">
                  <Sparkles size={18} className="text-primary" />
                  <CardTitle>Content Preview</CardTitle>
                </View>
                <Text className="text-sm text-muted-foreground">
                  {isGeneratingWebContent 
                    ? 'Generating fresh content from web search results...'
                    : 'Use the toggle above to switch between original and latest content'
                  }
                </Text>
              </CardHeader>
              <CardContent>
                {isGeneratingWebContent && (
                  <View className="items-center py-8">
                    <LoadingAnimation 
                      title="Generating Latest Content"
                      messages={[
                        'Creating educational material from web search results...',
                        'Analyzing recent updates...',
                        'Organizing information...',
                        'Almost ready...',
                      ]}
                    />
                  </View>
                )}
              </CardContent>
            </Card>
          )}

          {/* Conditional Content Display Based on Toggle */}
          {contentView === 'new' && webSearchContent ? (
            /* New Web Search Content Section */
            <Card className="border-2 border-primary/20 bg-primary/5 dark:bg-primary/10">
              <CardHeader>
                <View className="flex-row items-center gap-2 mb-2">
                  <Sparkles size={18} className="text-primary" />
                  <CardTitle>Latest Updates & Insights</CardTitle>
                  <Badge className="bg-primary">
                    <Text className="text-xs text-white font-semibold">NEW</Text>
                  </Badge>
                </View>
                <Text className="text-sm text-muted-foreground">
                  Fresh content generated from recent web search findings
                </Text>
              </CardHeader>
              <CardContent>
                <View className="space-y-3">
                  {webSearchContent.subtopics.map((subtopic, index) => {
                    const isExpanded = webSearchExpandedSections.has(subtopic.id);
                    const content = getSubtopicContent(subtopic, subtopic.id);
                    const currentVersion = webSearchSubtopicVersions[subtopic.id] || 'default';
                    
                    return (
                      <View 
                        key={subtopic.id}
                        className="border border-border rounded-lg overflow-hidden bg-card"
                      >
                        {/* Accordion Header */}
                        <Button
                          variant="ghost"
                          onPress={() => {
                            const newExpanded = new Set(webSearchExpandedSections);
                            if (newExpanded.has(subtopic.id)) {
                              newExpanded.delete(subtopic.id);
                            } else {
                              newExpanded.add(subtopic.id);
                            }
                            setWebSearchExpandedSections(newExpanded);
                          }}
                          className="w-full flex-row items-center justify-between p-4 rounded-none"
                        >
                          <View className="flex-1 flex-row items-center gap-2">
                            <View className="bg-primary/10 dark:bg-primary/20 rounded-full w-7 h-7 items-center justify-center">
                              <Text className="text-primary font-bold text-xs">
                                {index + 1}
                              </Text>
                            </View>
                            <Text className="font-semibold text-base text-left flex-1 flex-wrap pr-2">
                              {subtopic.title}
                            </Text>
                            <Badge className="bg-primary/10 dark:bg-primary/20">
                              <Text className="text-xs text-primary font-medium">New</Text>
                            </Badge>
                          </View>
                          {isExpanded ? (
                            <ChevronUp size={20} color={isDarkColorScheme ? '#a1a1aa' : '#71717a'} />
                          ) : (
                            <ChevronDown size={20} color={isDarkColorScheme ? '#a1a1aa' : '#71717a'} />
                          )}
                        </Button>

                        {/* Accordion Content */}
                        {isExpanded && (
                          <View className="border-t border-border bg-secondary/20 dark:bg-secondary/10">
                            <ToneSwitcher
                              currentVersion={currentVersion}
                              onVersionChange={(v) => setWebSearchSubtopicVersions(prev => ({ ...prev, [subtopic.id]: v }))}
                              showSettings={showWebSearchToneSwitcher.has(subtopic.id)}
                              onToggleSettings={() => {
                                const newShow = new Set(showWebSearchToneSwitcher);
                                if (newShow.has(subtopic.id)) {
                                  newShow.delete(subtopic.id);
                                } else {
                                  newShow.add(subtopic.id);
                                }
                                setShowWebSearchToneSwitcher(newShow);
                              }}
                              subtopicId={subtopic.id}
                            />

                            {/* Content */}
                            <Animated.View 
                              key={`${subtopic.id}-${currentVersion}`}
                              entering={FadeIn.duration(300)}
                              className="px-4 pb-4"
                            >
                              <Text className="text-muted-foreground leading-6 mb-4">
                                {content.explanation}
                              </Text>

                              {content.example && (
                                <View className="mt-3">
                                  <View className="flex-row items-center gap-2 mb-2">
                                    <Code size={16} color={isDarkColorScheme ? '#4ade80' : '#16a34a'} />
                                    <Text className="text-sm font-semibold text-green-600 dark:text-green-400">
                                      Example
                                    </Text>
                                  </View>
                                  <View className="bg-slate-900 dark:bg-slate-950 rounded-lg p-4">
                                    <Text className="text-slate-100 font-mono text-sm leading-6">
                                      {content.example}
                                    </Text>
                                  </View>
                                  
                                  {subtopic.exampleExplanation && (
                                    <View className="flex-row items-start gap-2 mt-2">
                                      <Lightbulb size={14} color={isDarkColorScheme ? '#fbbf24' : '#d97706'} />
                                      <Text className="flex-1 text-sm text-muted-foreground italic">
                                        {subtopic.exampleExplanation}
                                      </Text>
                                    </View>
                                  )}
                                </View>
                              )}

                              {subtopic.keyPoints && subtopic.keyPoints.length > 0 && (
                                <View className="mt-3">
                                  <Text className="text-sm font-semibold mb-2 text-foreground">Key Points</Text>
                                  {subtopic.keyPoints.map((point: string, idx: number) => (
                                    <View key={idx} className="flex-row items-start gap-2 mb-1">
                                      <Text className="text-muted-foreground">•</Text>
                                      <Text className="flex-1 text-sm text-muted-foreground leading-relaxed">
                                        {point}
                                      </Text>
                                    </View>
                                  ))}
                                </View>
                              )}
                            </Animated.View>
                          </View>
                        )}
                      </View>
                    );
                  })}
                </View>
              </CardContent>
            </Card>
          ) : (
            /* Original Subtopics Section */
            <>
              {/* Selection Bar for Ask Doubt */}
              {isAskDoubtMode && (
                <Animated.View 
                  entering={FadeIn.duration(300)}
                  className="mb-4 p-4 rounded-xl border flex-row items-center justify-between"
                  style={{
                    backgroundColor: isDarkColorScheme ? '#1e1b4b' : '#eef2ff',
                    borderColor: isDarkColorScheme ? '#4338ca' : '#a5b4fc',
                  }}
                >
                  <View className="flex-1">
                    <Text style={{ color: isDarkColorScheme ? '#e0e7ff' : '#312e81', fontWeight: '600', fontSize: 14 }}>
                      {selectedSubtopics.size > 0 
                        ? `${selectedSubtopics.size} topic${selectedSubtopics.size > 1 ? 's' : ''} selected`
                        : 'Select topics to ask about'}
                    </Text>
                    <Text style={{ color: isDarkColorScheme ? '#a5b4fc' : '#6366f1', fontSize: 12 }}>
                      Tap topics to select them
                    </Text>
                  </View>
                  <View className="flex-row gap-2">
                    {selectedSubtopics.size > 0 && (
                      <Pressable
                        onPress={() => setSelectedSubtopics(new Set())}
                        className="px-3 py-2 rounded-lg active:opacity-70"
                        style={{
                          borderWidth: 1,
                          borderColor: isDarkColorScheme ? '#6366f1' : '#a5b4fc',
                        }}
                      >
                        <Text style={{ color: isDarkColorScheme ? '#a5b4fc' : '#4f46e5', fontSize: 12, fontWeight: '500' }}>Clear</Text>
                      </Pressable>
                    )}
                    <Pressable
                      onPress={() => {
                        if (selectedSubtopics.size > 0) {
                          setShowRegenerateModal(true);
                        } else {
                          setErrorMessage('Please select at least one topic to ask about.');
                        }
                      }}
                      className="px-3 py-2 rounded-lg flex-row items-center gap-1 active:opacity-70"
                      style={{ 
                        backgroundColor: selectedSubtopics.size > 0 
                          ? (isDarkColorScheme ? '#6366f1' : '#4f46e5')
                          : (isDarkColorScheme ? '#3f3f46' : '#d4d4d8'),
                      }}
                    >
                      <MessageSquare size={14} color={selectedSubtopics.size > 0 ? '#ffffff' : '#71717a'} />
                      <Text style={{ 
                        color: selectedSubtopics.size > 0 ? '#ffffff' : '#71717a', 
                        fontSize: 12, 
                        fontWeight: '500' 
                      }}>Ask</Text>
                    </Pressable>
                  </View>
                </Animated.View>
              )}

              {/* Key Concepts - No Card wrapper */}
              <View className="mb-4">
                <View className="flex-row items-center gap-2 mb-3">
                  <BookOpen size={20} color={isDarkColorScheme ? '#a78bfa' : '#7c3aed'} />
                  <Text className="text-lg font-semibold text-foreground">Key Concepts</Text>
                </View>
              </View>
              
              <View className="space-y-3">
                {explanation.subtopics.map((subtopic, index) => {
                  const isExpanded = expandedSections.has(subtopic.id);
                  const performance = getPerformanceForSubtopic(subtopic.id);
                  const content = getSubtopicContent(subtopic, subtopic.id);
                  const currentVersion = getSubtopicVersion(subtopic.id);
                  const showingToneSwitcher = showToneSwitcher.has(subtopic.id);
                  const isSelected = selectedSubtopics.has(subtopic.id);
                  
                  return (
                    <Pressable 
                      key={subtopic.id}
                      onPress={() => {
                        if (isAskDoubtMode) {
                          // In Ask Doubt mode, toggle selection
                          const newSelected = new Set(selectedSubtopics);
                          if (newSelected.has(subtopic.id)) {
                            newSelected.delete(subtopic.id);
                          } else {
                            newSelected.add(subtopic.id);
                          }
                          setSelectedSubtopics(newSelected);
                        } else {
                          // Normal mode, toggle expand/collapse
                          toggleSection(subtopic.id);
                        }
                      }}
                      className="rounded-xl overflow-hidden"
                      style={{
                        borderWidth: isSelected ? 2 : 1,
                        borderColor: isSelected 
                          ? (isDarkColorScheme ? '#6366f1' : '#4f46e5')
                          : (isDarkColorScheme ? '#27272a' : '#e4e4e7'),
                        backgroundColor: isDarkColorScheme ? 'rgba(39, 39, 42, 0.5)' : '#ffffff',
                      }}
                    >
                      {/* Accordion Header */}
                      <View className="flex-row items-center p-4">
                        {/* Checkbox for Ask Doubt mode */}
                        {isAskDoubtMode && (
                          <View className="mr-3">
                            {isSelected ? (
                              <CheckCircle2 size={22} color={isDarkColorScheme ? '#6366f1' : '#4f46e5'} />
                            ) : (
                              <Circle size={22} color={isDarkColorScheme ? '#52525b' : '#a1a1aa'} />
                            )}
                          </View>
                        )}
                        <View className="flex-1 flex-row items-center gap-3">
                          <View className={`w-8 h-8 rounded-full items-center justify-center ${
                            performance 
                              ? (performance.status === 'strong' ? 'bg-green-500' :
                                 performance.status === 'weak' ? 'bg-red-500' :
                                 'bg-amber-500')
                              : 'bg-primary/20 dark:bg-primary/30'
                          }`}>
                            <Text className={`text-xs font-bold ${
                              performance ? 'text-white' : 'text-primary'
                            }`}>
                              {index + 1}
                            </Text>
                          </View>
                          <Text className="font-medium text-base text-foreground flex-1 flex-wrap pr-2">
                            {subtopic.title}
                          </Text>
                        </View>
                        {!isAskDoubtMode && (
                          <ChevronDown 
                            size={20} 
                            color={isDarkColorScheme ? '#a1a1aa' : '#71717a'}
                            style={{ transform: [{ rotate: isExpanded ? '180deg' : '0deg' }] }}
                          />
                        )}
                      </View>


                      {/* Accordion Content */}
                      {isExpanded && (
                        <View className="border-t border-border bg-secondary/20 dark:bg-secondary/10">
                          <ToneSwitcher
                            currentVersion={currentVersion}
                            onVersionChange={(v) => setSubtopicVersion(subtopic.id, v)}
                            showSettings={showingToneSwitcher}
                            onToggleSettings={() => {
                              const newShow = new Set(showToneSwitcher);
                              if (newShow.has(subtopic.id)) {
                                newShow.delete(subtopic.id);
                              } else {
                                newShow.add(subtopic.id);
                              }
                              setShowToneSwitcher(newShow);
                            }}
                            subtopicId={subtopic.id}
                          />
                          
                          {/* Auto-adaptation indicator */}
                          {currentEmotion && (currentEmotion === 'wbored' || currentEmotion === 'drowsy' || currentEmotion === 'frustrated' || currentEmotion === 'confused') && (
                            <View className="mx-4 mb-2 bg-primary/10 dark:bg-primary/20 border border-primary/20 dark:border-primary/30 rounded-lg p-2 flex-row items-center">
                              <Sparkles size={14} color={isDarkColorScheme ? '#a78bfa' : '#7c3aed'} />
                              <Text className="text-xs text-foreground flex-1 ml-2">
                                {currentEmotion === 'wbored' || currentEmotion === 'drowsy' 
                                  ? 'Content adapting to keep you engaged' 
                                  : 'Content simplifying to help you understand'}
                              </Text>
                            </View>
                          )}

                          {/* Content */}
                          <Animated.View 
                            key={`${subtopic.id}-${currentVersion}`}
                            entering={FadeIn.duration(300)}
                            className="px-4 pb-4"
                          >
                            {/* Show error if this specific tone failed */}
                            {isContentFailed(currentVersion) ? (
                              <View className="bg-red-100 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-4">
                                <View className="flex-row items-start gap-3">
                                  <AlertCircle size={20} color={isDarkColorScheme ? '#f87171' : '#dc2626'} />
                                  <View className="flex-1">
                                    <Text className="text-sm font-semibold text-red-900 dark:text-red-100 mb-1">
                                      Failed to generate {currentVersion} content
                                    </Text>
                                    <Text className="text-xs text-red-700 dark:text-red-300 mb-3">
                                      Try regenerating or switch to another style.
                                    </Text>
                                    <Pressable
                                      onPress={() => handleRegenerateContent(currentVersion)}
                                      className="flex-row items-center gap-2 self-start px-3 py-2 rounded-lg border border-red-300 dark:border-red-700 active:opacity-70"
                                    >
                                      <RefreshCw size={14} color={isDarkColorScheme ? '#f87171' : '#dc2626'} />
                                      <Text className="text-red-700 dark:text-red-300 text-xs font-medium">
                                        Retry
                                      </Text>
                                    </Pressable>
                                  </View>
                                </View>
                              </View>
                            ) : (
                              <>
                                <Text className="text-muted-foreground leading-6 mb-4">
                                  {content.explanation}
                                </Text>

                                {content.example && (
                                  <View className="mt-3">
                                    <View className="flex-row items-center gap-2 mb-2">
                                      <Code size={16} color={isDarkColorScheme ? '#4ade80' : '#16a34a'} />
                                      <Text className="text-sm font-semibold text-green-600 dark:text-green-400">
                                        Example
                                      </Text>
                                    </View>
                                    <View className="bg-slate-900 dark:bg-slate-950 rounded-lg p-4">
                                      <Text className="text-slate-100 font-mono text-sm leading-6">
                                        {content.example}
                                      </Text>
                                    </View>
                                    
                                    {subtopic.exampleExplanation && (
                                      <View className="flex-row items-start gap-2 mt-2">
                                        <Lightbulb size={14} color={isDarkColorScheme ? '#fbbf24' : '#d97706'} />
                                        <Text className="flex-1 text-sm text-muted-foreground italic">
                                          {subtopic.exampleExplanation}
                                        </Text>
                                      </View>
                                    )}
                                  </View>
                                )}

                                {subtopic.keyPoints && subtopic.keyPoints.length > 0 && (
                                  <View className="mt-3">
                                    <Text className="text-sm font-semibold mb-2 text-foreground">Key Points</Text>
                                    {subtopic.keyPoints.map((point, idx) => (
                                      <View key={idx} className="flex-row items-start gap-2 mb-1">
                                        <Text className="text-muted-foreground">•</Text>
                                        <Text className="flex-1 text-sm text-muted-foreground leading-relaxed">
                                          {point}
                                        </Text>
                                      </View>
                                    ))}
                                  </View>
                                )}
                              </>
                            )}
                          </Animated.View>
                        </View>
                      )}
                    </Pressable>
                  );
                })}
              </View>
            </>
          )}
          {explanation.bestPractices && explanation.bestPractices.length > 0 && (
            <View className="mt-6">
              <Pressable 
                onPress={() => setIsBestPracticesExpanded(!isBestPracticesExpanded)}
                className="flex-row items-center justify-between py-3 active:opacity-70"
              >
                <View className="flex-row items-center gap-2">
                  <CheckCircle2 size={20} color={isDarkColorScheme ? '#4ade80' : '#16a34a'} />
                  <Text className="text-lg font-semibold text-foreground">Best Practices</Text>
                  <View className="bg-green-500/20 dark:bg-green-500/30 px-2 py-0.5 rounded-full">
                    <Text className="text-xs font-medium text-green-600 dark:text-green-400">{explanation.bestPractices.length}</Text>
                  </View>
                </View>
                <ChevronDown 
                  size={20} 
                  color={isDarkColorScheme ? '#a1a1aa' : '#71717a'}
                  style={{ transform: [{ rotate: isBestPracticesExpanded ? '180deg' : '0deg' }] }}
                />
              </Pressable>
              {isBestPracticesExpanded && (
                <Animated.View entering={FadeIn.duration(200)} className="space-y-3 mt-2">
                  {explanation.bestPractices.map((practice, index) => (
                    <View key={index} className="flex-row items-start gap-3">
                      <View className="bg-green-500 rounded-full w-6 h-6 items-center justify-center mt-0.5">
                        <Text className="text-white font-bold text-xs">{index + 1}</Text>
                      </View>
                      <Text className="flex-1 text-muted-foreground leading-6">
                        {practice}
                      </Text>
                    </View>
                  ))}
                </Animated.View>
              )}
            </View>
          )}

          {/* Common Pitfalls */}
          {explanation.commonPitfalls && explanation.commonPitfalls.length > 0 && (
            <View className="mt-6">
              <Pressable 
                onPress={() => setIsCommonPitfallsExpanded(!isCommonPitfallsExpanded)}
                className="flex-row items-center justify-between py-3 active:opacity-70"
              >
                <View className="flex-row items-center gap-2">
                  <AlertCircle size={20} color={isDarkColorScheme ? '#f87171' : '#dc2626'} />
                  <Text className="text-lg font-semibold text-foreground">Common Pitfalls</Text>
                  <View className="bg-red-500/20 dark:bg-red-500/30 px-2 py-0.5 rounded-full">
                    <Text className="text-xs font-medium text-red-600 dark:text-red-400">{explanation.commonPitfalls.length}</Text>
                  </View>
                </View>
                <ChevronDown 
                  size={20} 
                  color={isDarkColorScheme ? '#a1a1aa' : '#71717a'}
                  style={{ transform: [{ rotate: isCommonPitfallsExpanded ? '180deg' : '0deg' }] }}
                />
              </Pressable>
              {isCommonPitfallsExpanded && (
                <Animated.View entering={FadeIn.duration(200)} className="space-y-3 mt-2">
                  {explanation.commonPitfalls.map((pitfall, index) => (
                    <View key={index} className="flex-row items-start gap-3">
                      <View className="bg-red-500 rounded-full w-6 h-6 items-center justify-center mt-0.5">
                        <Text className="text-white font-bold text-xs">!</Text>
                      </View>
                      <Text className="flex-1 text-muted-foreground leading-6">
                        {pitfall}
                      </Text>
                    </View>
                  ))}
                </Animated.View>
              )}
            </View>
          )}
          
          {/* Bottom Action Buttons */}
          <View className="mt-8 mb-6">
            <View className="flex-row items-center gap-3">
              {/* Take a Test Button */}
              <Pressable
                onPress={handleTakeTest}
                disabled={isGeneratingQuiz}
                className="flex-1"
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  paddingVertical: 14,
                  borderRadius: 6,
                  backgroundColor: isGeneratingQuiz 
                    ? (isDarkColorScheme ? '#27272a' : '#e4e4e7')
                    : (isDarkColorScheme ? '#18181b' : '#f4f4f5'),
                  opacity: isGeneratingQuiz ? 0.7 : 1,
                }}
              >
                {isGeneratingQuiz ? (
                  <>
                    <View className="h-5 w-5 items-center justify-center">
                      <Animated.View
                        style={{
                          transform: [
                            {
                              rotate: '0deg',
                            },
                          ],
                        }}
                      >
                        <Rocket 
                          size={16} 
                          color={isDarkColorScheme ? '#a1a1aa' : '#71717a'} 
                          style={{ transform: [{ rotate: '-45deg' }] }}
                        />
                      </Animated.View>
                    </View>
                    <Text style={{ fontSize: 14, fontWeight: '600', color: isDarkColorScheme ? '#a1a1aa' : '#71717a', letterSpacing: 0.3 }}>
                      Preparing Quiz...
                    </Text>
                  </>
                ) : (
                  <>
                    <BookOpen size={16} color={isDarkColorScheme ? '#fafafa' : '#18181b'} strokeWidth={2.5} />
                    <Text style={{ fontSize: 14, fontWeight: '600', color: isDarkColorScheme ? '#fafafa' : '#18181b', letterSpacing: 0.3 }}>
                      Take a Test
                    </Text>
                  </>
                )}
              </Pressable>
              
              {/* Analyze Button */}
              <Pressable
                onPress={handleAnalyze}
                className="flex-1"
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  paddingVertical: 14,
                  borderRadius: 6,
                  backgroundColor: isDarkColorScheme ? '#18181b' : '#f4f4f5',
                }}
              >
                <Sparkles size={16} color={isDarkColorScheme ? '#fafafa' : '#18181b'} strokeWidth={2.5} />
                <Text style={{ fontSize: 14, fontWeight: '600', color: isDarkColorScheme ? '#fafafa' : '#18181b', letterSpacing: 0.3 }}>
                  Analyze
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Regenerating Selected Subtopics Overlay */}
      {isRegeneratingSubtopics && (
        <Animated.View 
          entering={FadeIn.duration(200)}
          exiting={FadeOut.duration(200)}
          className="absolute inset-0 z-50 bg-background/90 justify-center items-center"
          style={{ zIndex: 50 }}
        >
          <Card className="mx-8 p-6">
            <View className="items-center">
              <View className="bg-primary/10 dark:bg-primary/20 rounded-full p-4 mb-4">
                <Wand2 size={32} color={isDarkColorScheme ? '#a78bfa' : '#7c3aed'} />
              </View>
              <ActivityIndicator size="large" className="mb-4" />
              <Text className="text-lg font-semibold text-foreground text-center mb-2">
                Regenerating Subtopics
              </Text>
              <Text className="text-sm text-muted-foreground text-center leading-relaxed">
                Creating better examples focused on your instructions...
              </Text>
            </View>
          </Card>
        </Animated.View>
      )}

      {/* Regenerate Modal */}
      <Modal
        transparent
        visible={showRegenerateModal}
        animationType="none"
        onRequestClose={() => setShowRegenerateModal(false)}
        statusBarTranslucent
      >
        <Animated.View
          entering={FadeIn.duration(200)}
          exiting={FadeOut.duration(200)}
          className="flex-1 items-center justify-center px-6"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
        >
          <Pressable 
            className="absolute inset-0" 
            onPress={() => setShowRegenerateModal(false)}
          />
          
          <Animated.View
            entering={ZoomIn.duration(300).springify()}
            className="bg-card rounded-2xl w-full max-w-md overflow-hidden"
            style={{
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 10 },
              shadowOpacity: 0.3,
              shadowRadius: 20,
              elevation: 10,
            }}
          >
            <View className="p-6">
              <View className="flex-row items-center gap-2 mb-2">
                <MessageSquare size={24} color={isDarkColorScheme ? '#a78bfa' : '#7c3aed'} />
                <Text className="text-xl font-bold text-foreground">
                  Ask a Doubt
                </Text>
              </View>
              <Text className="text-sm text-muted-foreground mb-4 leading-relaxed">
                Type your question about the selected topics. We'll regenerate the content with better explanations focused on your doubt.
              </Text>

              <View className="mb-2">
                <Text className="text-sm font-medium text-foreground mb-1">
                  Selected Topics ({selectedSubtopics.size})
                </Text>
                <View className="flex-row flex-wrap gap-2">
                  {explanation.subtopics
                    .filter(st => selectedSubtopics.has(st.id))
                    .map(st => (
                      <View 
                        key={st.id} 
                        style={{
                          backgroundColor: isDarkColorScheme ? 'rgba(99, 102, 241, 0.2)' : 'rgba(79, 70, 229, 0.1)',
                          paddingHorizontal: 8,
                          paddingVertical: 4,
                          borderRadius: 4,
                        }}
                      >
                        <Text style={{
                          fontSize: 12,
                          color: isDarkColorScheme ? '#a5b4fc' : '#4f46e5',
                        }}>
                          {st.title}
                        </Text>
                      </View>
                    ))}
                </View>
              </View>

              <View className="mb-6">
                <Text className="text-sm font-medium text-foreground mb-2">
                  Your Question
                </Text>
                <View className="min-h-[120px] p-3 rounded-lg border border-border bg-background">
                  <TextInput
                    value={regenerateInstructions}
                    onChangeText={setRegenerateInstructions}
                    placeholder="e.g., How are variables created? Show more practical examples..."
                    placeholderTextColor="#9ca3af"
                    multiline
                    className="text-sm text-foreground"
                    style={{ minHeight: 100, textAlignVertical: 'top' }}
                  />
                </View>
                <Text className="text-xs text-muted-foreground mt-2">
                  💡 Be specific about what you want to understand better
                </Text>
              </View>

              <View className="flex-col gap-2">
                <Pressable
                  onPress={handleRegenerateSelectedSubtopics}
                  disabled={!regenerateInstructions.trim()}
                  style={{
                    backgroundColor: !regenerateInstructions.trim() 
                      ? (isDarkColorScheme ? 'rgba(99, 102, 241, 0.3)' : 'rgba(79, 70, 229, 0.3)')
                      : (isDarkColorScheme ? '#6366f1' : '#4f46e5'),
                    width: '100%',
                    height: 48,
                    borderRadius: 8,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                  }}
                >
                  <MessageSquare size={20} color="#ffffff" />
                  <Text style={{ color: '#ffffff', fontSize: 16, fontWeight: '600' }}>
                    Get Answer
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => {
                    setShowRegenerateModal(false);
                    setRegenerateInstructions('');
                  }}
                  className="w-full h-12 items-center justify-center rounded-lg active:opacity-70"
                >
                  <Text className="text-base font-medium text-muted-foreground">
                    Cancel
                  </Text>
                </Pressable>
              </View>
            </View>
          </Animated.View>
        </Animated.View>
      </Modal>

      {/* Distraction Alert Modal */}
      <Modal
        visible={showDistractionAlert}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDistractionAlert(false)}
      >
        <Animated.View
          entering={FadeIn.duration(200)}
          className="flex-1 bg-black/50 justify-center items-center px-6"
        >
          <Pressable 
            className="absolute inset-0" 
            onPress={() => setShowDistractionAlert(false)}
          />
          
          <Animated.View
            entering={ZoomIn.duration(300).springify()}
            className="bg-card rounded-xl w-full max-w-md overflow-hidden border border-border"
            style={{
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.1,
              shadowRadius: 12,
              elevation: 5,
            }}
          >
            <View className="p-6">
              {/* Header */}
              <View className="mb-6">
                <Text className="text-xl font-semibold text-foreground mb-2">
                  Focus Reminder
                </Text>
                <Text className="text-sm text-muted-foreground leading-relaxed">
                  We noticed you may be distracted. Take a moment to refocus on your learning.
                </Text>
              </View>

              {/* Action Button */}
              <Pressable
                onPress={() => setShowDistractionAlert(false)}
                className="w-full h-11 items-center justify-center rounded-lg bg-primary active:opacity-90"
              >
                <Text className="text-sm font-medium text-primary-foreground">
                  Continue Learning
                </Text>
              </Pressable>
            </View>
          </Animated.View>
        </Animated.View>
      </Modal>

      {/* Search Results Bottom Sheet */}
      <BottomSheet>
        <TopicSearchResultsModal
          sheetRef={searchSheetRef}
          results={webSearchResults}
          isSearching={isSearching}
          topicName={topic.name}
          onRefresh={handleWebSearch}
        />
      </BottomSheet>

      {/* Tone Change Modal */}
      <ToneChangeModal
        isOpen={showToneChangeModal}
        onClose={() => setShowToneChangeModal(false)}
        newTone={newToneToShow}
      />

      {/* API Key Required Dialog */}
      <APIKeyRequiredDialog
        open={showApiKeyDialog}
        onOpenChange={setShowApiKeyDialog}
        title="API Key Required"
        description={apiKeyDialogMessage}
        onGoToSettings={() => router.push('/(tabs)/settings')}
      />
      
      {/* Quiz Modal */}
      <Modal
        visible={showQuiz}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowQuiz(false)}
      >
        <SafeAreaView className="flex-1 bg-background" edges={['top']}>
          <View className="flex-row items-center px-4 py-3 border-b border-border">
            <Pressable
              onPress={() => {
                if (isGeneratingQuiz) {
                  setShowQuiz(false);
                  setIsGeneratingQuiz(false);
                } else {
                  setShowExitQuizModal(true);
                }
              }}
              className="h-9 w-9 items-center justify-center rounded-lg active:bg-secondary"
            >
              <ArrowLeft size={20} color={isDarkColorScheme ? '#fafafa' : '#0a0a0a'} />
            </Pressable>
            <Text className="flex-1 text-center text-lg font-semibold pr-9">
              {isGeneratingQuiz ? 'Preparing Quiz...' : `${topic.name} - Quiz`}
            </Text>
          </View>
          {isGeneratingQuiz ? (
            <View className="flex-1 p-6">
              <View className="mb-6">
                <Skeleton className="h-6 w-3/4 mb-2" />
                <Skeleton className="h-4 w-full mb-1" />
                <Skeleton className="h-4 w-5/6" />
              </View>
              {[1, 2, 3].map((i) => (
                <View key={i} className="mb-6 p-4 rounded-xl bg-card border border-border">
                  <Skeleton className="h-5 w-32 mb-4" />
                  <Skeleton className="h-4 w-full mb-2" />
                  <Skeleton className="h-4 w-4/5 mb-4" />
                  <View className="space-y-3">
                    {[1, 2, 3, 4].map((j) => (
                      <View key={j} className="flex-row items-center gap-3">
                        <Skeleton className="h-5 w-5 rounded-full" />
                        <Skeleton className="h-4 flex-1" />
                      </View>
                    ))}
                  </View>
                </View>
              ))}
            </View>
          ) : quizId ? (
            <QuizComponent
              quizId={quizId}
              onQuizComplete={(result) => {
                setShowQuiz(false);
                setShowQuizResults(true);
              }}
              onBack={() => setShowQuiz(false)}
            />
          ) : null}
        </SafeAreaView>
      </Modal>
      
      {/* Quiz Results Modal */}
      <Modal
        visible={showQuizResults}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => {
          setShowQuizResults(false);
          handleQuizComplete();
        }}
      >
        <SafeAreaView className="flex-1 bg-background" edges={['top']}>
          <View className="flex-row items-center px-4 py-3 border-b border-border">
            <Pressable
              onPress={() => {
                setShowQuizResults(false);
                handleQuizComplete();
              }}
              className="h-9 w-9 items-center justify-center rounded-lg active:bg-secondary"
            >
              <ArrowLeft size={20} color={isDarkColorScheme ? '#fafafa' : '#0a0a0a'} />
            </Pressable>
            <Text className="flex-1 text-center text-lg font-semibold pr-9">
              Quiz Results
            </Text>
          </View>
          {quizId && currentUserId && (
            <QuizResults
              userId={currentUserId}
              quizId={quizId}
              stepTitle={topic.name}
              onClose={() => {
                setShowQuizResults(false);
                handleQuizComplete();
              }}
            />
          )}
        </SafeAreaView>
      </Modal>
      
      {/* Exit Quiz Confirmation Modal */}
      <Modal
        transparent
        visible={showExitQuizModal}
        animationType="none"
        onRequestClose={() => setShowExitQuizModal(false)}
        statusBarTranslucent
      >
        <Animated.View
          entering={FadeIn.duration(200)}
          exiting={FadeOut.duration(200)}
          className="flex-1 items-center justify-center px-6"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
        >
          <Pressable 
            className="absolute inset-0" 
            onPress={() => setShowExitQuizModal(false)}
          />
          
          <Animated.View
            entering={ZoomIn.duration(300).springify()}
            className="bg-card rounded-2xl w-full max-w-md overflow-hidden"
            style={{
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 10 },
              shadowOpacity: 0.3,
              shadowRadius: 20,
              elevation: 10,
            }}
          >
            <View className="p-6">
              {/* Icon */}
              <View className="items-center mb-4">
                <View className="bg-red-100 dark:bg-red-900/30 rounded-full p-4 mb-3">
                  <AlertCircle size={48} className="text-red-500" />
                </View>
                <Text className="text-xl font-bold text-foreground text-center mb-2">
                  Exit Quiz?
                </Text>
                <Text className="text-sm text-muted-foreground text-center leading-relaxed">
                  Are you sure you want to exit? Your progress will not be saved.
                </Text>
              </View>

              {/* Action Buttons */}
              <View className="flex-col gap-3">
                <Pressable
                  onPress={() => {
                    setShowExitQuizModal(false);
                    setShowQuiz(false);
                  }}
                  className="w-full h-12 items-center justify-center rounded-lg bg-red-500 active:bg-red-600"
                >
                  <Text className="text-base font-semibold text-white">
                    Yes, Exit Quiz
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => setShowExitQuizModal(false)}
                  className="w-full h-12 items-center justify-center rounded-lg border border-border active:bg-secondary"
                >
                  <Text className="text-base font-medium text-foreground">
                    Continue Quiz
                  </Text>
                </Pressable>
              </View>
            </View>
          </Animated.View>
        </Animated.View>
      </Modal>
    </SafeAreaView>
  );
}