import React, { useState } from 'react';
import { View, Pressable } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from '@/components/ui/text';
import { useCurrentUserId } from '@/hooks/stores/useUserStore';
import { useColorScheme } from '@/lib/useColorScheme';
import { RoadmapDisplay } from '@/components/roadmap/RoadmapDisplay';
import { QuizComponent } from '@/components/roadmap/QuizComponent';
import { QuizResults } from '@/components/roadmap/QuizResults';
import { ArrowLeft } from 'lucide-react-native';

type ScreenState = 
  | { type: 'roadmap' }
  | { type: 'quiz'; quizId: string; stepTitle: string }
  | { type: 'results'; quizId: string; stepTitle: string };

export default function RoadmapDetailScreen() {
  const { id: roadmapId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const currentUserId = useCurrentUserId();
  const { isDarkColorScheme } = useColorScheme();
  const [screenState, setScreenState] = useState<ScreenState>({ type: 'roadmap' });
  const [isRevisionQuiz, setIsRevisionQuiz] = useState(false);

  const handleTakeQuiz = (quizId: string, stepTitle: string) => {
    // Check if this is a revision quiz based on the title
    setIsRevisionQuiz(stepTitle.includes('- Revision'));
    setScreenState({ type: 'quiz', quizId, stepTitle });
  };

  const handleViewResults = (quizId: string, stepTitle: string) => {
    setScreenState({ type: 'results', quizId, stepTitle });
  };

  const handleQuizComplete = () => {
    // If this was a revision quiz, trigger the revision complete callback
    if (isRevisionQuiz) {
      // The callback will be triggered in RoadmapDisplay
      setIsRevisionQuiz(false);
    }
    setScreenState({ type: 'roadmap' });
  };

  const handleRevisionQuizComplete = () => {
    // This is called by RoadmapDisplay when a revision quiz completes
    // RoadmapDisplay handles its own internal state updates
  };

  const handleCloseResults = () => {
    setScreenState({ type: 'roadmap' });
  };

  const handleBack = () => {
    if (screenState.type !== 'roadmap') {
      setScreenState({ type: 'roadmap' });
    } else {
      router.back();
    }
  };

  if (!roadmapId || !currentUserId) {
    return (
      <SafeAreaView className="flex-1 bg-background" edges={['top']}>
        <Stack.Screen options={{ headerShown: false }} />
        <View className="flex-row items-center px-4 py-3 border-b border-border">
          <Pressable 
            onPress={() => router.back()}
            className="h-9 w-9 items-center justify-center rounded-lg active:bg-secondary"
          >
            <ArrowLeft size={20} color={isDarkColorScheme ? '#fafafa' : '#0a0a0a'} />
          </Pressable>
        </View>
        <View className="flex-1 justify-center items-center p-6">
          <Text className="text-center text-muted-foreground">Roadmap not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Render based on screen state - matches tabs/roadmap.tsx exactly
  if (screenState.type === 'quiz') {
    return (
      <SafeAreaView className="flex-1 bg-background" edges={['top']}>
        <Stack.Screen options={{ headerShown: false }} />
        <View className="flex-1">
          <View className="flex-row items-center px-4 py-3 border-b border-border">
            <Pressable 
              onPress={handleBack}
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
            roadmapId={roadmapId}
            onQuizComplete={handleQuizComplete}
            onBack={handleBack}
          />
        </View>
      </SafeAreaView>
    );
  }

  if (screenState.type === 'results') {
    return (
      <SafeAreaView className="flex-1 bg-background" edges={['top']}>
        <Stack.Screen options={{ headerShown: false }} />
        <View className="flex-1">
          <View className="flex-row items-center px-4 py-3 border-b border-border">
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
            userId={currentUserId}
            quizId={screenState.quizId}
            stepTitle={screenState.stepTitle}
            onClose={handleCloseResults}
          />
        </View>
      </SafeAreaView>
    );
  }

  // Default: Show roadmap display
  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      <View className="flex-row items-center px-4 py-3 border-b border-border bg-background">
        <Pressable 
          onPress={() => router.back()}
          className="h-9 w-9 items-center justify-center rounded-lg active:bg-secondary"
        >
          <ArrowLeft size={20} color={isDarkColorScheme ? '#fafafa' : '#0a0a0a'} />
        </Pressable>
      </View>
      <RoadmapDisplay 
        roadmapId={roadmapId}
        onTakeQuiz={handleTakeQuiz}
        onViewResults={handleViewResults}
        onRevisionQuizComplete={handleRevisionQuizComplete}
        onDelete={() => router.back()}
      />
    </SafeAreaView>
  );
}
