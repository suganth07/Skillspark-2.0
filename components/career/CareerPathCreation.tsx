import React, { useState } from 'react';
import { View, Pressable, Modal, Alert } from 'react-native';
import Animated, { FadeIn, FadeOut, ZoomIn } from 'react-native-reanimated';
import { ScrollView } from 'react-native-gesture-handler';
import { Text } from '@/components/ui/text';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { ErrorDisplay } from '@/components/ui/error-display';
import { useCurrentUserId } from '@/hooks/stores/useUserStore';
import { useCreateCareerPath } from '@/hooks/queries/useCareerQueries';
import { LoadingAnimation } from '@/components/ui/loading-animation';
import { ArrowLeft, CheckCircle, X, WandSparkles, ChevronDown, ChevronUp, Settings2, Briefcase } from 'lucide-react-native';
import { useColorScheme } from '@/lib/useColorScheme';

interface CareerPathCreationProps {
  onCareerPathCreated?: (careerPathId: string) => void;
  onBack?: () => void;
}

export function CareerPathCreation({ onCareerPathCreated, onBack }: CareerPathCreationProps) {
  const [roleInput, setRoleInput] = useState('');
  const [currentLevel, setCurrentLevel] = useState('');
  const [targetLevel, setTargetLevel] = useState('');
  const [preferences, setPreferences] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [createdCareerPathId, setCreatedCareerPathId] = useState<string | null>(null);
  const [createdRoleName, setCreatedRoleName] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const currentUserId = useCurrentUserId();
  const { isDarkColorScheme } = useColorScheme();
  
  // TanStack Query mutation for career path generation
  const createCareerPathMutation = useCreateCareerPath();
  
  const isGenerating = createCareerPathMutation.isPending;
  const error = createCareerPathMutation.error?.message || null;
  const clearError = () => createCareerPathMutation.reset();

  const handleGenerate = async () => {
    setValidationError(null);
    
    if (!roleInput.trim()) {
      setValidationError('Please enter a career role');
      return;
    }

    if (!currentUserId) {
      setValidationError('Please select a user account first');
      return;
    }

    clearError();
    
    try {
      const result = await createCareerPathMutation.mutateAsync({ 
        userId: currentUserId, 
        roleName: roleInput.trim(),
        currentLevel: currentLevel.trim() || undefined,
        targetLevel: targetLevel.trim() || undefined,
        preferences: preferences.trim() || undefined,
      });
      
      setCreatedCareerPathId(result.careerPathId);
      setCreatedRoleName(roleInput.trim());
      setShowSuccessModal(true);
      setRoleInput('');
      setCurrentLevel('');
      setTargetLevel('');
      setPreferences('');
      
    } catch (err) {
      console.error('Failed to create career path:', err);
    }
  };

  const suggestedRoles = [
    'Full Stack Developer', 'Data Scientist', 'Product Manager', 'UX Designer',
    'Machine Learning Engineer', 'DevOps Engineer', 'Mobile App Developer',
    'Cloud Architect', 'Backend Developer', 'Frontend Developer', 'QA Engineer',
    'Security Engineer', 'Game Developer', 'Blockchain Developer'
  ];

  if (isGenerating) {
    return (
      <View className="flex-1 bg-background items-center justify-center">
        <LoadingAnimation 
          title="Crafting Your Career Path"
          messages={[
            'Analyzing career requirements...',
            'Mapping skills and competencies...',
            'Identifying learning topics...',
            'Structuring career roadmap...',
            'Organizing learning modules...',
            'Creating your career path...',
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
                Career Path Created!
              </Text>
              
              <Text className="text-sm text-muted-foreground text-center px-6 mt-2 leading-relaxed">
                Your career path for "{createdRoleName}" is ready. Start your journey now!
              </Text>
            </View>

            <View className="px-6 pb-6 pt-4">
              <Pressable
                onPress={() => {
                  if (createdCareerPathId) {
                    onCareerPathCreated?.(createdCareerPathId);
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
                  <Briefcase
                    size={20}
                    color="#7c3aed"
                  />
                </View>
                <View className="flex-1">
                  <Text className="text-2xl font-bold text-foreground">
                    Create Career Path
                  </Text>
                </View>
              </View>
              <Text className="text-sm text-muted-foreground leading-relaxed">
                Enter your career goal, and our AI will generate a comprehensive learning path with all the topics and skills you need to master.
              </Text>
            </View>

            {/* Main Input Card */}
            <Card className="mb-6">
              <CardHeader>
                <Text className="text-base font-semibold text-foreground mb-3">
                  What role are you aiming for?
                </Text>
                <Input
                  value={roleInput}
                  onChangeText={setRoleInput}
                  placeholder="e.g., Full Stack Developer, Data Scientist..."
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
                      Customize Your Career Path
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
                    className="p-4 bg-secondary/50 rounded-lg mb-4"
                  >
                    {/* Level Transition */}
                    <View className="mb-5">
                      <Text className="text-sm font-medium text-foreground mb-3">
                        Level Transition (Optional)
                      </Text>
                      <View className="space-y-3">
                        <View>
                          <Text className="text-xs font-medium text-muted-foreground mb-1.5">
                            Current Level
                          </Text>
                          <Input
                            value={currentLevel}
                            onChangeText={setCurrentLevel}
                            placeholder="e.g., Junior, Mid-Level, SE2"
                            className="text-sm"
                            editable={!isGenerating}
                          />
                        </View>
                        <View>
                          <Text className="text-xs font-medium text-muted-foreground mb-1.5">
                            Target Level
                          </Text>
                          <Input
                            value={targetLevel}
                            onChangeText={setTargetLevel}
                            placeholder="e.g., Senior, Lead, SE3"
                            className="text-sm"
                            editable={!isGenerating}
                          />
                        </View>
                      </View>
                      <Text className="text-xs text-muted-foreground leading-relaxed mt-2">
                        We'll focus on the skills gap between your current and target level.
                      </Text>
                    </View>

                    {/* Learning Preferences */}
                    <View>
                      <Text className="text-sm font-medium text-foreground mb-3">
                        Learning Preferences (Optional)
                      </Text>
                      <Input
                        value={preferences}
                        onChangeText={setPreferences}
                        placeholder="e.g., Focus on system design, skip frontend, include cloud technologies..."
                        className="text-sm min-h-[80px] mb-2"
                        editable={!isGenerating}
                        multiline
                        numberOfLines={3}
                        textAlignVertical="top"
                      />
                      <Text className="text-xs text-muted-foreground leading-relaxed">
                        Tell us what you want to focus on, skip, or prioritize in your career path.
                      </Text>
                    </View>
                  </Animated.View>
                )}

                {validationError && (
                  <View className="mt-4">
                    <ErrorDisplay
                      error={validationError}
                      onDismiss={() => setValidationError(null)}
                      variant="inline"
                    />
                  </View>
                )}
                {error && (
                  <View className="mt-4">

                    <ErrorDisplay
                      error={error}
                      onRetry={() => handleGenerate()}
                      variant="inline"
                    />
                  </View>
                )}

                <Pressable 
                  onPress={handleGenerate}
                  disabled={isGenerating || !roleInput.trim()}
                  className={`w-full h-12 items-center justify-center rounded-lg ${
                    isGenerating || !roleInput.trim() 
                      ? 'bg-primary/50' 
                      : 'bg-primary active:opacity-90'
                  }`}
                >
                  <Text className="font-semibold text-base text-primary-foreground">
                    Generate Career Path
                  </Text>
                </Pressable>
              </CardContent>
            </Card>

            {/* Suggested Roles */}
            <Card>
              <CardHeader>
                <Text className="text-base font-semibold text-foreground mb-1">
                  Popular Career Roles
                </Text>
                <Text className="text-sm text-muted-foreground leading-relaxed">
                  Get started quickly with one of these trending roles
                </Text>
              </CardHeader>
              <CardContent>
                <View className="flex-row flex-wrap gap-2">
                  {suggestedRoles.map((suggestedRole) => (
                    <Pressable
                      key={suggestedRole}
                      onPress={() => setRoleInput(suggestedRole)}
                      disabled={isGenerating}
                      className={`px-4 py-2 rounded-full border border-border ${
                        isGenerating 
                          ? 'bg-background opacity-50' 
                          : 'bg-background active:bg-secondary'
                      }`}
                    >
                      <Text className="text-sm text-foreground">
                        {suggestedRole}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </CardContent>
            </Card>
          </View>
        </ScrollView>
      </View>
    </>
  );
}
