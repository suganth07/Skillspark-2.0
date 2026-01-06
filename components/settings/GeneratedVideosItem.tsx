import * as React from 'react';
import { View } from 'react-native';
import { Switch } from '@/components/ui/switch';
import ListItem from '@/components/ui/list-item';
import { useGeneratedVideosStore } from '@/hooks/stores/useGeneratedVideosStore';
import { Video } from 'lucide-react-native';

export function GeneratedVideosItem() {
  const { isGeneratedVideosEnabled, toggleGeneratedVideos } = useGeneratedVideosStore();
  
  return (
    <ListItem
      label="Generated Videos for Topic"
      description={
        isGeneratedVideosEnabled 
          ? 'AI-generated videos are enabled for topics' 
          : 'Enable to get AI-generated video content'
      }
      itemLeft={(props) => (
        <View className="h-10 w-10 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-800/60">
          <Video size={20} className="text-blue-600 dark:text-blue-200" />
        </View>
      )}
      itemRight={(props) => (
        <Switch 
          checked={isGeneratedVideosEnabled} 
          onCheckedChange={toggleGeneratedVideos}
          nativeID="generated-videos-switch"
        />
      )}
      detail={false}
    />
  );
}
