import React from 'react';
import { View, Modal, Pressable } from 'react-native';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { Card } from '@/components/ui/card';
import { BookOpen, Sparkles } from 'lucide-react-native';
import { useColorScheme } from '@/lib/useColorScheme';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';

type ContentVersion = 'simplified' | 'story';

interface ToneChangeModalProps {
  isOpen: boolean;
  onClose: () => void;
  newTone: ContentVersion;
}

export function ToneChangeModal({ isOpen, onClose, newTone }: ToneChangeModalProps) {
  const { isDarkColorScheme } = useColorScheme();

  const getToneInfo = () => {
    if (newTone === 'story') {
      return {
        icon: <Sparkles size={24} color={isDarkColorScheme ? '#a78bfa' : '#7c3aed'} />,
        title: 'Content Adapted to Story Mode',
        description: 'Based on your engagement patterns, we\'ve switched to Story mode to make the content more engaging and easier to follow.',
      };
    } else {
      return {
        icon: <BookOpen size={24} color={isDarkColorScheme ? '#60a5fa' : '#2563eb'} />,
        title: 'Content Adapted to Simplified Mode',
        description: 'Based on your engagement patterns, we\'ve switched to Simplified mode to make the content easier to understand.',
      };
    }
  };

  const { icon, title, description } = getToneInfo();

  return (
    <Modal
      visible={isOpen}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Animated.View
        entering={FadeIn.duration(200)}
        className="flex-1 bg-black/50 justify-center items-center px-6"
      >
        <Pressable 
          className="absolute inset-0" 
          onPress={onClose}
        />
        
        <Animated.View
          entering={ZoomIn.duration(400).springify()}
          className="bg-card rounded-2xl w-full max-w-md overflow-hidden"
          style={{
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 10 },
            shadowOpacity: 0.3,
            shadowRadius: 20,
            elevation: 10,
          }}
        >
          <Card className="border-0">
            <View className="p-6">
              <View className="items-center mb-4">
                <View className="w-16 h-16 rounded-full bg-primary/10 items-center justify-center mb-3">
                  {icon}
                </View>
                <Text className="text-center text-lg font-semibold text-foreground mb-2">
                  {title}
                </Text>
              </View>
              
              <Text className="text-center leading-relaxed text-muted-foreground mb-6">
                {description}
              </Text>
              
              <Button onPress={onClose} className="w-full">
                <Text className="text-primary-foreground font-semibold">
                  Got it
                </Text>
              </Button>
            </View>
          </Card>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}
