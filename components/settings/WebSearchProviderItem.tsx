import React from 'react';
import { View, Pressable } from 'react-native';
import { Text } from '@/components/ui/text';
import { Globe, Search } from 'lucide-react-native';
import { useWebSearchProvider, useSetWebSearchProvider, useIsWebSearchProviderAvailable, type WebSearchProvider } from '@/hooks/stores/useWebSearchProviderStore';

interface WebSearchProviderItemProps {
  onValueChange?: (value: boolean) => void;
}

export function WebSearchProviderItem({ onValueChange }: WebSearchProviderItemProps) {
  const currentProvider = useWebSearchProvider();
  const setProvider = useSetWebSearchProvider();
  const isProviderAvailable = useIsWebSearchProviderAvailable();

  const providers: Array<{ id: WebSearchProvider; name: string; description: string; icon: typeof Globe }> = [
    {
      id: 'langsearch',
      name: 'LangSearch',
      description: 'Advanced web search with summaries',
      icon: Globe,
    },
    {
      id: 'serper',
      name: 'Google Serper',
      description: 'Fast Google search API',
      icon: Search,
    },
  ];

  const handleProviderSelect = (providerId: WebSearchProvider) => {
    setProvider(providerId);
    onValueChange?.(true);
  };

  return (
    <View className="space-y-3">
      <View className="flex-row items-center gap-3 mb-2">
        <Globe className="h-5 w-5 text-foreground" />
        <View className="flex-1">
          <Text className="text-base font-semibold">Web Search Provider</Text>
          <Text className="text-sm text-muted-foreground">
            Choose which search engine to use for finding topic updates
          </Text>
        </View>
      </View>

      <View className="gap-3">
        {providers.map((provider) => {
          const Icon = provider.icon;
          const isAvailable = isProviderAvailable(provider.id);
          const isSelected = currentProvider === provider.id;

          return (
            <Pressable
              key={provider.id}
              className={`
                p-4 rounded-lg border-2 
                ${isSelected ? 'border-primary bg-primary/5' : 'border-border bg-card'}
                ${!isAvailable ? 'opacity-50' : ''}
              `}
              onPress={() => handleProviderSelect(provider.id)}
              disabled={!isAvailable}
              accessibilityRole="button"
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
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
