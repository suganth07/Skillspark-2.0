import React from 'react';
import { View } from 'react-native';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/primitives/dialog';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { BookOpen, Sparkles } from 'lucide-react-native';
import { useColorScheme } from '@/lib/useColorScheme';

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
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-[90%] max-w-md">
        <DialogHeader>
          <View className="items-center mb-4">
            <View className="w-16 h-16 rounded-full bg-primary/10 items-center justify-center mb-3">
              {icon}
            </View>
            <DialogTitle className="text-center text-lg">
              {title}
            </DialogTitle>
          </View>
          <DialogDescription className="text-center leading-relaxed">
            {description}
          </DialogDescription>
        </DialogHeader>
        
        <DialogFooter className="mt-4">
          <Button onPress={onClose} className="w-full">
            <Text className="text-primary-foreground font-semibold">
              Got it
            </Text>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
