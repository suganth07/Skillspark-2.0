import React, { useState, useEffect } from 'react';
import { View, Pressable, TextInput, Alert } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Key, ChevronRight } from 'lucide-react-native';
import { useColorScheme } from '@/lib/useColorScheme';
import {
  BottomSheet,
  BottomSheetContent,
  BottomSheetHeader,
  BottomSheetFlatList,
  useBottomSheet,
} from '@/components/primitives/bottomSheet/bottom-sheet.native';
import { useRefreshProviderAvailability } from '@/hooks/stores/useAIProviderStore';
import { useRefreshWebSearchProviderAvailability } from '@/hooks/stores/useWebSearchProviderStore';

interface APIKey {
  id: string;
  name: string;
  placeholder: string;
  description: string;
  required: boolean;
}

const API_KEYS: APIKey[] = [
  {
    id: 'gemini',
    name: 'Gemini API',
    placeholder: 'Enter your Google Gemini API key',
    description: 'Required for AI-powered content generation and roadmap creation',
    required: false,
  },
  {
    id: 'groq',
    name: 'Groq API',
    placeholder: 'Enter your Groq API key',
    description: 'Alternative AI provider for faster inference',
    required: false,
  },
  {
    id: 'langsearch',
    name: 'LangSearch API',
    placeholder: 'Enter your LangSearch API key',
    description: 'Used for web search and content discovery',
    required: false,
  },
  {
    id: 'googleserper',
    name: 'Google Serper API',
    placeholder: 'Enter your Google Serper API key',
    description: 'Alternative web search provider',
    required: false,
  },
  {
    id: 'heygen',
    name: 'HeyGen API',
    placeholder: 'Enter your HeyGen API key',
    description: 'Required for AI video generation features',
    required: false,
  },
];

export function APIKeysItem() {
  const { isDarkColorScheme } = useColorScheme();
  const { ref: bottomSheetRef, open, close } = useBottomSheet();
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({});
  const [tempKeys, setTempKeys] = useState<Record<string, string>>({});
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});
  const [isLoading, setIsLoading] = useState(true);
  
  // Get refresh functions from stores
  const refreshAIProviders = useRefreshProviderAvailability();
  const refreshWebSearchProviders = useRefreshWebSearchProviderAvailability();

  // Load API keys from SecureStore on mount
  useEffect(() => {
    const loadApiKeys = async () => {
      const keys: Record<string, string> = {};
      for (const api of API_KEYS) {
        try {
          const value = await SecureStore.getItemAsync(`api_key_${api.id}`);
          keys[api.id] = value || '';
        } catch (error) {
          console.error(`Failed to load ${api.id} key:`, error);
          keys[api.id] = '';
        }
      }
      setApiKeys(keys);
      setIsLoading(false);
    };
    loadApiKeys();
  }, []);

  const handleOpenModal = () => {
    // Copy current keys to temp state
    setTempKeys({ ...apiKeys });
    open();
  };

  const handleSave = async () => {
    // Check if required keys are provided
    const missingRequired = API_KEYS.filter(
      (api) => api.required && !tempKeys[api.id]?.trim()
    );

    if (missingRequired.length > 0) {
      Alert.alert(
        'Required API Keys Missing',
        `Please provide the following required API keys:\n${missingRequired.map((api) => `• ${api.name}`).join('\n')}`,
        [{ text: 'OK' }]
      );
      return;
    }

    // Save all keys to SecureStore
    try {
      for (const api of API_KEYS) {
        const key = tempKeys[api.id]?.trim() || '';
        if (key) {
          await SecureStore.setItemAsync(`api_key_${api.id}`, key);
        } else {
          // Delete key if empty
          await SecureStore.deleteItemAsync(`api_key_${api.id}`);
        }
      }

      setApiKeys({ ...tempKeys });
      
      // Refresh provider availability after saving keys
      await refreshAIProviders();
      await refreshWebSearchProviders();
      
      close();
      Alert.alert('Success', 'API keys saved securely!', [{ text: 'OK' }]);
    } catch (error) {
      console.error('Failed to save API keys:', error);
      Alert.alert('Error', 'Failed to save API keys. Please try again.', [{ text: 'OK' }]);
    }
  };

  const handleCancel = () => {
    setTempKeys({});
    close();
  };

  const getConfiguredCount = () => {
    return Object.values(apiKeys).filter((key) => key.trim().length > 0).length;
  };

  const toggleShowPassword = (apiId: string) => {
    setShowPasswords((prev) => ({
      ...prev,
      [apiId]: !prev[apiId],
    }));
  };

  return (
    <BottomSheet>
      <Pressable
        onPress={handleOpenModal}
        className="flex-row items-center justify-between py-5 px-4 active:opacity-70"
      >
        <View className="flex-row items-center flex-1">
          <View className="w-10 h-10 rounded-full bg-primary/10 items-center justify-center mr-3">
            <Key size={20} className="text-primary" />
          </View>
          <View className="flex-1">
            <Text className="font-medium text-foreground">Configure API Keys</Text>
            <Text className="text-sm text-muted-foreground mt-1">
              {getConfiguredCount()} of {API_KEYS.length} keys configured
            </Text>
          </View>
        </View>
        <ChevronRight size={20} className="text-muted-foreground" />
      </Pressable>

      {/* API Keys Configuration Bottom Sheet */}
      <BottomSheetContent ref={bottomSheetRef} enableDynamicSizing={false} snapPoints={['85%']}>
        <BottomSheetHeader className="py-4">
          <View className="flex-1">
            <Text className="text-xl font-semibold text-foreground">
              Configure API Keys
            </Text>
            <Text className="text-sm text-muted-foreground mt-1">
              Secure your access to AI services
            </Text>
          </View>
        </BottomSheetHeader>

        <BottomSheetFlatList
          data={API_KEYS}
          renderItem={({ item: api, index }: { item: APIKey; index: number }) => (
            <View
              className={index < API_KEYS.length - 1 ? 'mb-5' : 'mb-2'}
            >
              <Card className="p-4 border-2 border-border">
                <View className="flex-row items-center justify-between mb-3">
                  <View className="flex-row items-center flex-1">
                    <Text className="font-semibold text-foreground text-base">
                      {api.name}
                    </Text>
                    {api.required && (
                      <View className="ml-2 px-2 py-1 bg-red-100 dark:bg-red-900/30 rounded-md">
                        <Text className="text-xs text-red-600 dark:text-red-400 font-semibold">
                          Required
                        </Text>
                      </View>
                    )}
                  </View>
                </View>

                <Text className="text-sm text-muted-foreground mb-4 leading-relaxed">
                  {api.description}
                </Text>

                <View className="flex-row items-center gap-2">
                  <View className="flex-1">
                    <TextInput
                      value={tempKeys[api.id] || ''}
                      onChangeText={(text) =>
                        setTempKeys((prev) => ({ ...prev, [api.id]: text }))
                      }
                      placeholder={api.placeholder}
                      placeholderTextColor={
                        isDarkColorScheme ? '#9ca3af' : '#6b7280'
                      }
                      secureTextEntry={!showPasswords[api.id]}
                      autoCapitalize="none"
                      autoCorrect={false}
                      className="px-4 py-3 rounded-lg border-2"
                      style={{
                        color: isDarkColorScheme ? '#ffffff' : '#000000',
                        backgroundColor: isDarkColorScheme ? '#1f2937' : '#f9fafb',
                        borderColor: isDarkColorScheme ? '#374151' : '#d1d5db',
                      }}
                    />
                  </View>
                  <Pressable
                    onPress={() => toggleShowPassword(api.id)}
                    className="px-4 py-3 bg-primary/10 rounded-lg active:opacity-70 min-w-[70px] items-center"
                  >
                    <Text className="text-sm text-primary font-medium">
                      {showPasswords[api.id] ? 'Hide' : 'Show'}
                    </Text>
                  </Pressable>
                </View>
              </Card>
            </View>
          )}
          keyExtractor={(item: APIKey) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingTop: 16,
            paddingBottom: 20,
          }}
          ListFooterComponent={
            <View>
              {/* Info Box */}
              <Card className="p-4 bg-secondary border-2 border-border mt-2 mb-4">
                <Text className="text-sm text-foreground leading-relaxed">
                  Your API keys are stored securely on your device and never
                  shared with third parties. Required keys are needed for core
                  features to work.
                </Text>
              </Card>

              {/* Footer Actions */}
              <View className="flex-row gap-3 mb-4">
                <Button
                  variant="outline"
                  onPress={handleCancel}
                  className="flex-1"
                >
                  <Text className="text-foreground font-semibold">Cancel</Text>
                </Button>
                <Button onPress={handleSave} className="flex-1">
                  <Text className="text-primary-foreground font-semibold">
                    Save Keys
                  </Text>
                </Button>
              </View>
            </View>
          }
        />
      </BottomSheetContent>
    </BottomSheet>
  );
}
