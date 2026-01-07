import React from 'react';
import { View, Pressable } from 'react-native';
import { Text } from '@/components/ui/text';
import { Settings2 } from 'lucide-react-native';
import { useColorScheme } from '@/lib/useColorScheme';
import Animated, { FadeIn } from 'react-native-reanimated';

type ContentVersion = 'default' | 'simplified' | 'story';

interface ToneSwitcherProps {
  currentVersion: ContentVersion;
  onVersionChange: (version: ContentVersion) => void;
  showSettings: boolean;
  onToggleSettings: () => void;
  subtopicId: string;
}

export function ToneSwitcher({
  currentVersion,
  onVersionChange,
  showSettings,
  onToggleSettings,
  subtopicId,
}: ToneSwitcherProps) {
  const { isDarkColorScheme } = useColorScheme();

  return (
    <>
      {/* Content Header with Settings Toggle */}
      <View className="px-4 pt-3 pb-2 flex-row items-center justify-between">
        {/* Current mode indicator */}
        <View className="flex-row items-center gap-2">
          <Text className="text-xs text-muted-foreground">Mode:</Text>
          <View className="bg-primary/10 dark:bg-primary/20 px-2 py-1 rounded-full">
            <Text className="text-xs font-medium text-primary capitalize">{currentVersion}</Text>
          </View>
        </View>
        
        {/* Settings toggle */}
        <Pressable
          onPress={onToggleSettings}
          className={`p-2 rounded-lg active:opacity-70 ${showSettings ? 'bg-primary/10 dark:bg-primary/20' : ''}`}
        >
          <Settings2 size={18} color={isDarkColorScheme ? (showSettings ? '#a78bfa' : '#a1a1aa') : (showSettings ? '#7c3aed' : '#71717a')} />
        </Pressable>
      </View>

      {/* Style Switcher - Hidden by default */}
      {showSettings && (
        <Animated.View 
          entering={FadeIn.duration(200)}
          className="mx-4 mb-3 p-3 rounded-lg border border-border"
          style={{ backgroundColor: isDarkColorScheme ? '#27272a' : '#f4f4f5' }}
        >
          <Text className="text-xs text-muted-foreground mb-2">Select learning style:</Text>
          <View className="flex-row gap-2">
            <Pressable
              onPress={() => onVersionChange('default')}
              style={{
                flex: 1,
                paddingVertical: 10,
                paddingHorizontal: 12,
                borderRadius: 8,
                borderWidth: 1,
                backgroundColor: currentVersion === 'default' ? '#7c3aed' : (isDarkColorScheme ? '#3f3f46' : '#ffffff'),
                borderColor: currentVersion === 'default' ? '#7c3aed' : (isDarkColorScheme ? '#52525b' : '#e4e4e7'),
              }}
            >
              <Text style={{
                fontSize: 12,
                textAlign: 'center',
                fontWeight: '500',
                color: currentVersion === 'default' ? '#ffffff' : (isDarkColorScheme ? '#e4e4e7' : '#3f3f46'),
              }}>
                Default
              </Text>
            </Pressable>
            <Pressable
              onPress={() => onVersionChange('simplified')}
              style={{
                flex: 1,
                paddingVertical: 10,
                paddingHorizontal: 12,
                borderRadius: 8,
                borderWidth: 1,
                backgroundColor: currentVersion === 'simplified' ? '#7c3aed' : (isDarkColorScheme ? '#3f3f46' : '#ffffff'),
                borderColor: currentVersion === 'simplified' ? '#7c3aed' : (isDarkColorScheme ? '#52525b' : '#e4e4e7'),
              }}
            >
              <Text style={{
                fontSize: 12,
                textAlign: 'center',
                fontWeight: '500',
                color: currentVersion === 'simplified' ? '#ffffff' : (isDarkColorScheme ? '#e4e4e7' : '#3f3f46'),
              }}>
                Simple
              </Text>
            </Pressable>
            <Pressable
              onPress={() => onVersionChange('story')}
              style={{
                flex: 1,
                paddingVertical: 10,
                paddingHorizontal: 12,
                borderRadius: 8,
                borderWidth: 1,
                backgroundColor: currentVersion === 'story' ? '#7c3aed' : (isDarkColorScheme ? '#3f3f46' : '#ffffff'),
                borderColor: currentVersion === 'story' ? '#7c3aed' : (isDarkColorScheme ? '#52525b' : '#e4e4e7'),
              }}
            >
              <Text style={{
                fontSize: 12,
                textAlign: 'center',
                fontWeight: '500',
                color: currentVersion === 'story' ? '#ffffff' : (isDarkColorScheme ? '#e4e4e7' : '#3f3f46'),
              }}>
                Story
              </Text>
            </Pressable>
          </View>
        </Animated.View>
      )}
    </>
  );
}
