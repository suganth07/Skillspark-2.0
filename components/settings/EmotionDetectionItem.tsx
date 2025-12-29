import * as React from 'react';
import { View } from 'react-native';
import { Switch } from '@/components/ui/switch';
import ListItem from '@/components/ui/list-item';
import { useEmotionStore } from '@/hooks/stores/useEmotionStore';
import { Brain } from 'lucide-react-native';

export function EmotionDetectionItem() {
  const { isEmotionDetectionEnabled, toggleEmotionDetection } = useEmotionStore();
  
  return (
    <ListItem
      label="Emotion Detection"
      description={
        isEmotionDetectionEnabled 
          ? 'Monitor your engagement while learning' 
          : 'Enable to track your learning emotions'
      }
      itemLeft={(props) => (
        <View className="h-10 w-10 items-center justify-center rounded-full bg-purple-100 dark:bg-purple-900/30">
          <Brain size={20} className="text-purple-600 dark:text-purple-400" />
        </View>
      )}
      itemRight={(props) => (
        <Switch 
          checked={isEmotionDetectionEnabled} 
          onCheckedChange={toggleEmotionDetection}
          nativeID="emotion-detection-switch"
        />
      )}
      detail={false}
    />
  );
}
