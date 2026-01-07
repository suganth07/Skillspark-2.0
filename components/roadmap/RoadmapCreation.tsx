import React, { useState } from 'react';
import { View, Pressable, Modal, Alert } from 'react-native';
import Animated, { FadeIn, FadeOut, ZoomIn } from 'react-native-reanimated';
import { Text } from '@/components/ui/text';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ErrorDisplay } from '@/components/ui/error-display';
import { ScrollView } from 'react-native-gesture-handler';
import { useCurrentUserId } from '@/hooks/stores/useUserStore';
import { useGenerateRoadmap } from '@/hooks/queries/useRoadmapQueries';
import { LoadingAnimation } from '@/components/ui/loading-animation';
import { ArrowLeft, CheckCircle, X, WandSparkles, ChevronDown, ChevronUp, Settings2, Key } from 'lucide-react-native';
import { useColorScheme } from '@/lib/useColorScheme';
import { hasAnyAIProviderKey } from '@/lib/apiKeys';
import { router } from 'expo-router';
import {
  BottomSheet,
  BottomSheetContent,
  BottomSheetHeader,
  useBottomSheet,
} from '@/components/primitives/bottomSheet/bottom-sheet.native';

interface RoadmapCreationProps {
  onRoadmapCreated?: (roadmapId: string) => void;
  onBack?: () => void;
}

export function RoadmapCreation({ onRoadmapCreated, onBack }: RoadmapCreationProps) {
  const [topic, setTopic] = useState('');
  const [preferences, setPreferences] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [createdRoadmapId, setCreatedRoadmapId] = useState<string | null>(null);
  const [createdTopic, setCreatedTopic] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const currentUserId = useCurrentUserId();
  const { isDarkColorScheme } = useColorScheme();
  const { ref: apiKeyModalRef, open: openApiKeyModal, close: closeApiKeyModal } = useBottomSheet();
  
  // TanStack Query mutation for roadmap generation
  const generateRoadmapMutation = useGenerateRoadmap();
  
  const isGenerating = generateRoadmapMutation.isPending;
  const error = generateRoadmapMutation.error?.message || null;
  const clearError = () => generateRoadmapMutation.reset();

  const handleGenerateRoadmap = async () => {
    setValidationError(null);
    
    if (!topic.trim()) {
      setValidationError('Please enter a topic to learn');
      return;
    }

    if (!currentUserId) {
      setValidationError('Please select a user account first');
      return;
    }

    // Check if any AI provider key is configured (Gemini OR Groq)
    const hasAIKey = await hasAnyAIProviderKey();
    
    if (!hasAIKey) {
      openApiKeyModal();
      return;
    }

    clearError();
    
    try {
      const roadmapId = await generateRoadmapMutation.mutateAsync({ 
        userId: currentUserId, 
        topic: topic.trim(),
        preferences: preferences.trim() || undefined
      });
      
      setCreatedRoadmapId(roadmapId);
      setCreatedTopic(topic.trim());
      setShowSuccessModal(true);
      setTopic('');
      setPreferences('');
      
    } catch (err) {
      console.error('Failed to generate roadmap:', err);
    }
  };

  const suggestedTopics = [
    'React', 'Python', 'Machine Learning', 'Node.js', 'TypeScript',
    'Data Science', 'Web Development', 'Mobile Development', 'DevOps',
    'Database Design', 'UI/UX Design', 'Cybersecurity', 'Flutter', 'Docker'
  ];

  if (isGenerating) {
    return (
      <View className="flex-1 bg-background items-center justify-center">
        <LoadingAnimation 
          title="Creating Your Roadmap"
          messages={[
            'Analyzing your topic...',
            'Breaking down concepts...',
            'Mapping prerequisites...',
            'Structuring learning path...',
            'Organizing modules...',
            'Creating roadmap...',
          ]}
        />
      </View>
    );
  }

  return (
    <>
      {/* Success Modal */}
      <Modal
        transparent
        visible={showSuccessModal}
        animationType="none"
        onRequestClose={() => setShowSuccessModal(false)}
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
            onPress={() => setShowSuccessModal(false)}
          />
          
          <Animated.View
            entering={ZoomIn.duration(300).springify()}
            className="bg-card rounded-2xl w-full max-w-sm overflow-hidden"
            style={{
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 10 },
              shadowOpacity: 0.3,
              shadowRadius: 20,
              elevation: 10,
            }}
          >
            <Pressable
              onPress={() => setShowSuccessModal(false)}
              className="absolute top-4 right-4 z-10 h-8 w-8 items-center justify-center rounded-full bg-secondary/80 active:bg-secondary"
            >
              <X size={16} className="text-muted-foreground" />
            </Pressable>

            <View className="items-center pt-8 pb-4">
              <View 
                className="h-20 w-20 rounded-full bg-green-50 dark:bg-green-950 items-center justify-center mb-4"
                style={{
                  shadowColor: '#22c55e',
                  shadowOffset: { width: 0, height: 0 },
                  shadowOpacity: 0.3,
                  shadowRadius: 20,
                }}
              >
                <CheckCircle size={48} className="text-green-600 dark:text-green-400" />
              </View>
              
              <Text className="text-xl font-bold text-foreground text-center px-6">
                Roadmap Created!
              </Text>
              
              <Text className="text-sm text-muted-foreground text-center px-6 mt-2 leading-relaxed">
                Your learning roadmap for "{createdTopic}" is ready. Start your journey now!
              </Text>
            </View>

            <View className="px-6 pb-6 pt-4">
              <Pressable
                onPress={() => {
                  if (createdRoadmapId) {
                    onRoadmapCreated?.(createdRoadmapId);
                  }
                  setShowSuccessModal(false);
                }}
                className="w-full h-12 items-center justify-center rounded-lg bg-primary active:opacity-90 mb-3"
              >
                <Text className="text-base font-semibold text-primary-foreground">
                  Start Learning
                </Text>
              </Pressable>
              
              <Pressable
                onPress={() => {
                  onBack?.();
                  setShowSuccessModal(false);
                }}
                className="w-full h-12 items-center justify-center rounded-lg border border-border bg-background active:bg-secondary"
              >
                <Text className="text-base font-medium text-foreground">
                  View Later
                </Text>
              </Pressable>
            </View>
          </Animated.View>
        </Animated.View>
      </Modal>
      
      <View className="flex-1 bg-background">
        {/* Header with Back Button */}
        <View className="flex-row items-center px-4 py-3 border-b border-border">
          {onBack && (
            <Pressable 
              onPress={onBack}
              className="h-9 w-9 items-center justify-center rounded-lg active:bg-secondary"
            >
              <ArrowLeft size={20} color={isDarkColorScheme ? '#fafafa' : '#0a0a0a'} />
            </Pressable>
          )}
        </View>

        <ScrollView 
          className="flex-1 bg-background"
          showsVerticalScrollIndicator={false}
          contentContainerClassName="p-6"
        >
          <View className="max-w-2xl w-full mx-auto">
            {/* Header Section */}
            <View className="mb-8">
              <View className="flex-row items-center gap-2 mb-3">
                <View 
                  className="h-10 w-10 rounded-full bg-violet-100 dark:bg-violet-900/30 items-center justify-center"
                  style={{
                    shadowColor: '#7c3aed',
                    shadowOffset: { width: 0, height: 0 },
                    shadowOpacity: 0.4,
                    shadowRadius: 10,
                  }}
                >
                  <WandSparkles
                    size={20}
                    color="#7c3aed"
                  />
                </View>
                <View className="flex-1">
                  <Text className="text-2xl font-bold text-foreground">
                    Create New Roadmap
                  </Text>
                </View>
              </View>
              <Text className="text-sm text-muted-foreground leading-relaxed">
                Enter any topic you want to learn, and our AI will generate a personalized learning path with structured prerequisites and interactive assessments.
              </Text>
            </View>

            {/* Main Input Card */}
            <Card className="mb-6">
              <CardHeader>
                <Text className="text-base font-semibold text-foreground mb-3">
                  What would you like to learn?
                </Text>
                <Input
                  value={topic}
                  onChangeText={setTopic}
                  placeholder="e.g., React, Machine Learning, Python..."
                  className="text-base"
                  editable={!isGenerating}
                />
              </CardHeader>
              <CardContent>
                {/* Customization Section */}
                <Pressable
                  onPress={() => setShowAdvanced(!showAdvanced)}
                  className="flex-row items-center justify-between py-2 mb-3"
                >
                  <View className="flex-row items-center gap-2">
                    <Settings2 size={16} color={isDarkColorScheme ? '#a1a1aa' : '#71717a'} />
                    <Text className="text-sm font-medium text-muted-foreground">
                      Customize Your Roadmap
                    </Text>
                  </View>
                  {showAdvanced ? (
                    <ChevronUp size={18} color={isDarkColorScheme ? '#a1a1aa' : '#71717a'} />
                  ) : (
                    <ChevronDown size={18} color={isDarkColorScheme ? '#a1a1aa' : '#71717a'} />
                  )}
                </Pressable>

                {showAdvanced && (
                  <Animated.View 
                    entering={FadeIn.duration(200)}
                    className="p-4 bg-secondary/50 rounded-lg mb-6"
                  >
                    <Text className="text-sm font-medium text-foreground mb-3">
                      Learning Preferences (Optional)
                    </Text>
                    <Input
                      value={preferences}
                      onChangeText={setPreferences}
                      placeholder="e.g., Focus on practical projects, Include interview prep, Skip basics..."
                      className="text-sm min-h-[80px] mb-2"
                      editable={!isGenerating}
                      multiline
                      numberOfLines={3}
                      textAlignVertical="top"
                    />
                    <Text className="text-xs text-muted-foreground leading-relaxed mb-8">
                      Tell us what you want to focus on, skip, or prioritize in your learning path.
                    </Text>
                  </Animated.View>
                )}

                {validationError && (
                  <View className="mb-4">
                    <ErrorDisplay
                      error={validationError}
                      onDismiss={() => setValidationError(null)}
                      variant="inline"
                    />
                  </View>
                )}
                {error && (
                  <View className="mb-4">
                    <ErrorDisplay
                      error={error}
                      onRetry={() => handleGenerateRoadmap()}
                      variant="inline"
                    />
                  </View>
                )}

                <Pressable 
                  onPress={handleGenerateRoadmap}
                  disabled={isGenerating || !topic.trim()}
                  className={`w-full h-12 items-center justify-center rounded-lg ${
                    isGenerating || !topic.trim() 
                      ? 'bg-primary/50' 
                      : 'bg-primary active:opacity-90'
                  }`}
                >
                  <Text className="font-semibold text-base text-primary-foreground">
                    Generate Roadmap
                  </Text>
                </Pressable>
              </CardContent>
            </Card>

            {/* Suggested Topics */}
            <Card>
              <CardHeader>
                <Text className="text-base font-semibold text-foreground mb-1">
                  Popular Topics
                </Text>
                <Text className="text-sm text-muted-foreground leading-relaxed">
                  Get started quickly with one of these trending topics
                </Text>
              </CardHeader>
              <CardContent>
                <View className="flex-row flex-wrap gap-2">
                  {suggestedTopics.map((suggestedTopic) => (
                    <Pressable
                      key={suggestedTopic}
                      onPress={() => setTopic(suggestedTopic)}
                      disabled={isGenerating}
                      className={`px-4 py-2 rounded-full border border-border ${
                        isGenerating 
                          ? 'bg-background opacity-50' 
                          : 'bg-background active:bg-secondary'
                      }`}
                    >
                      <Text className="text-sm text-foreground">
                        {suggestedTopic}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </CardContent>
            </Card>
          </View>
        </ScrollView>

        {/* API Key Required Modal */}
        <BottomSheet>
          <BottomSheetContent ref={apiKeyModalRef} snapPoints={['50%']}>
            <BottomSheetHeader className="pb-4">
              <View className="flex-row items-center gap-3">
                <View className="w-12 h-12 rounded-full bg-destructive/10 items-center justify-center">
                  <Key size={24} className="text-destructive" />
                </View>
                <View className="flex-1">
                  <Text className="text-xl font-bold text-foreground">
                    AI Provider Required
                  </Text>
                  <Text className="text-sm text-muted-foreground mt-1">
                    Configure an API key to continue
                  </Text>
                </View>
              </View>
            </BottomSheetHeader>

            <View className="px-6 pb-6">
              <Card className="mb-4 border-2 border-destructive/20 bg-destructive/5">
                <CardContent className="p-4">
                  <Text className="text-sm text-foreground leading-relaxed mb-2">
                    To generate a roadmap, you need to configure at least one AI provider:
                  </Text>
                  <View className="gap-2 ml-2">
                    <View className="flex-row items-center gap-2">
                      <View className="w-1.5 h-1.5 rounded-full bg-foreground" />
                      <Text className="text-sm text-muted-foreground">
                        Google Gemini (recommended)
                      </Text>
                    </View>
                    <View className="flex-row items-center gap-2">
                      <View className="w-1.5 h-1.5 rounded-full bg-foreground" />
                      <Text className="text-sm text-muted-foreground">
                        Groq (Llama 3.3 - faster)
                      </Text>
                    </View>
                  </View>
                </CardContent>
              </Card>

              <View className="gap-3">
                <Button
                  onPress={() => {
                    closeApiKeyModal();
                    router.push('/(tabs)/settings');
                  }}
                  className="w-full"
                >
                  <Text className="text-primary-foreground font-semibold">
                    Go to Settings
                  </Text>
                </Button>
                
                <Button
                  variant="outline"
                  onPress={closeApiKeyModal}
                  className="w-full"
                >
                  <Text className="text-foreground font-semibold">
                    Cancel
                  </Text>
                </Button>
              </View>
            </View>
          </BottomSheetContent>
        </BottomSheet>
      </View>
    </>
  );
} 