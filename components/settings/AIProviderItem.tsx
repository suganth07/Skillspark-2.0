import React, { useState, useEffect } from 'react';
import { View } from 'react-native';
import { Text } from '@/components/ui/text';
import { Zap, Sparkles } from 'lucide-react-native';
import { useAIProvider, useSetAIProvider, useIsProviderAvailable, useAIProviderRefreshKey, type AIProvider } from '@/hooks/stores/useAIProviderStore';

interface AIProviderItemProps {
  onValueChange?: (value: boolean) => void;
}

export function AIProviderItem({ onValueChange }: AIProviderItemProps) {
  const currentProvider = useAIProvider();
  const setProvider = useSetAIProvider();
  const isProviderAvailable = useIsProviderAvailable();
  const refreshKey = useAIProviderRefreshKey();
  
  const [availability, setAvailability] = useState<Record<AIProvider, boolean>>({
    gemini: false,
    groq: false,
  });

  const providers: Array<{ id: AIProvider; name: string; description: string; icon: typeof Zap }> = [
    {
      id: 'gemini',
      name: 'Google Gemini',
      description: 'Google\'s advanced AI model',
      icon: Sparkles,
    },
    {
      id: 'groq',
      name: 'Groq (Llama 3.3)',
      description: 'Ultra-fast inference with Llama',
      icon: Zap,
    },
  ];

  // Check availability on mount and when providers change
  useEffect(() => {
    const checkAvailability = async () => {
      const geminiAvailable = await isProviderAvailable('gemini');
      const groqAvailable = await isProviderAvailable('groq');
      setAvailability({
        gemini: geminiAvailable,
        groq: groqAvailable,
      });
    };
    checkAvailability();
  }, [refreshKey]);

  const handleProviderSelect = async (providerId: AIProvider) => {
    // Check availability before attempting to set
    const available = await isProviderAvailable(providerId);
    if (available) {
      await setProvider(providerId);
      onValueChange?.(true);
    }
  };

  return (
    <View className="space-y-3">
      <View className="flex-row items-center gap-3 mb-2">
        <Sparkles size={20} className="text-foreground" />
        <View className="flex-1">
          <Text className="text-base font-semibold">AI Provider</Text>
          <Text className="text-sm text-muted-foreground">
            Choose which AI model to use for content generation
          </Text>
        </View>
      </View>

      <View className="gap-3">
        {providers.map((provider) => {
          const Icon = provider.icon;
          const isAvailable = availability[provider.id];
          const isSelected = currentProvider === provider.id;

          return (
            <View
              key={provider.id}
              className={`
                p-4 rounded-lg border-2 
                ${isSelected ? 'border-primary bg-primary/5' : 'border-border bg-card'}
                ${!isAvailable ? 'opacity-50' : ''}
              `}
              onTouchEnd={() => isAvailable && handleProviderSelect(provider.id)}
            >
              <View className="flex-row items-center gap-3">
                <View className={`p-2 rounded-full ${isSelected ? 'bg-primary' : 'bg-muted'}`}>
                  <Icon
                    className={`h-5 w-5 ${isSelected ? 'text-primary-foreground' : 'text-muted-foreground'}`}
                  />
                </View>
                <View className="flex-1">
                  <View className="flex-row items-center gap-2">
                    <Text className={`text-base font-semibold ${isSelected ? 'text-primary' : ''}`}>
                      {provider.name}
                    </Text>
                    {isSelected && (
                      <View className="px-2 py-0.5 rounded-full bg-primary">
                        <Text className="text-xs font-medium text-primary-foreground">Active</Text>
                      </View>
                    )}
                    {!isAvailable && (
                      <View className="px-2 py-0.5 rounded-full bg-destructive">
                        <Text className="text-xs font-medium text-destructive-foreground">
                          API Key Missing
                        </Text>
                      </View>
                    )}
                  </View>
                  <Text className="text-sm text-muted-foreground mt-0.5">
                    {provider.description}
                  </Text>
                </View>
              </View>
            </View>
          );
        })}
      </View>

    </View>
  );
}
