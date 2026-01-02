import React, { useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { Text } from '@/components/ui/text';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useCurrentUserId } from '@/hooks/stores/useUserStore';
import { useCreateCareerPath } from '@/hooks/queries/useCareerQueries';
import { Briefcase, Sparkles, ArrowRight } from 'lucide-react-native';

interface CareerPathCreationProps {
  onCareerPathCreated: (careerPathId: string) => void;
  onBack: () => void;
}

export function CareerPathCreation({ onCareerPathCreated, onBack }: CareerPathCreationProps) {
  const [roleInput, setRoleInput] = useState('');
  const currentUserId = useCurrentUserId();
  const createCareerPath = useCreateCareerPath();

  const handleGenerate = async () => {
    if (!roleInput.trim() || !currentUserId) return;

    createCareerPath.mutate(
      { userId: currentUserId, roleName: roleInput.trim() },
      {
        onSuccess: (data) => {
          onCareerPathCreated(data.careerPathId);
        },
        onError: (error) => {
          console.error('Failed to create career path:', error);
          // Error is already logged in the mutation
        }
      }
    );
  };

  const isGenerating = createCareerPath.isPending;

  return (
    <ScrollView className="flex-1 bg-background" showsVerticalScrollIndicator={false}>
      <View className="p-6 space-y-6">
        {/* Header Card */}
        <Card>
          <CardHeader>
            <View className="flex-row items-center space-x-3 mb-2">
              <View className="bg-primary/10 rounded-full p-3">
                <Briefcase size={24} className="text-primary" />
              </View>
              <CardTitle className="flex-1">Create Career Path</CardTitle>
            </View>
            <Text className="text-muted-foreground leading-6">
              Tell us your career goal, and we'll generate a personalized learning path with all the topics you need to master.
            </Text>
          </CardHeader>
        </Card>

        {/* Input Card */}
        <Card>
          <CardContent className="pt-6">
            <View className="space-y-4">
              <View>
                <Text className="text-sm font-semibold text-foreground mb-2">
                  What role are you aiming for?
                </Text>
                <Text className="text-xs text-muted-foreground mb-3">
                  Be specific or general - both work great!
                </Text>
                <Input
                  placeholder="e.g., Software Engineer, Data Scientist, Product Manager"
                  value={roleInput}
                  onChangeText={setRoleInput}
                  editable={!isGenerating}
                  className="h-12 text-base"
                  autoFocus
                />
              </View>

              {/* Examples */}
              <View className="bg-muted/50 rounded-lg p-4">
                <Text className="text-xs font-semibold text-foreground mb-2">
                  💡 Examples:
                </Text>
                <View className="space-y-1">
                  {[
                    'Full Stack Developer',
                    'Machine Learning Engineer',
                    'UX Designer',
                    'Cloud Architect',
                    'Mobile App Developer',
                  ].map((example) => (
                    <Text 
                      key={example} 
                      className="text-xs text-muted-foreground"
                      onPress={() => !isGenerating && setRoleInput(example)}
                    >
                      • {example}
                    </Text>
                  ))}
                </View>
              </View>
            </View>
          </CardContent>
        </Card>

        {/* Generation Status */}
        {isGenerating && (
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="pt-6">
              <View className="items-center space-y-4">
                <View className="bg-primary/10 rounded-full p-4">
                  <Sparkles size={32} className="text-primary" />
                </View>
                <ActivityIndicator size="large" className="text-primary" />
                <View className="items-center">
                  <Text className="text-lg font-semibold text-foreground text-center">
                    Crafting Your Career Path
                  </Text>
                  <Text className="text-sm text-muted-foreground text-center mt-2 leading-relaxed">
                    AI is analyzing {roleInput} and generating a comprehensive learning roadmap with topics, timelines, and prerequisites...
                  </Text>
                </View>
              </View>
            </CardContent>
          </Card>
        )}

        {/* Error Display */}
        {createCareerPath.isError && (
          <Card className="bg-destructive/10 border-destructive/20">
            <CardContent className="pt-6">
              <Text className="text-sm text-destructive text-center">
                {createCareerPath.error instanceof Error
                  ? createCareerPath.error.message
                  : 'Failed to generate career path'}
              </Text>
            </CardContent>
          </Card>
        )}

        {/* Action Buttons */}
        <View className="space-y-3">
          <Button
            onPress={handleGenerate}
            disabled={!roleInput.trim() || isGenerating}
            className="h-12"
            size="lg"
          >
            <View className="flex-row items-center space-x-2">
              <Sparkles size={18} className="text-primary-foreground" />
              <Text className="text-white font-semibold text-base">
                {isGenerating ? 'Generating...' : 'Generate Career Path'}
              </Text>
              {!isGenerating && <ArrowRight size={18} className="text-primary-foreground" />}
            </View>
          </Button>

          <Button
            variant="outline"
            onPress={onBack}
            disabled={isGenerating}
            className="h-12"
          >
            <Text className="font-semibold">Cancel</Text>
          </Button>
        </View>
      </View>
    </ScrollView>
  );
}
