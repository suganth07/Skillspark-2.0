import React from 'react';
import { View } from 'react-native';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { Rocket } from 'lucide-react-native';

export function RoadmapEmptyState() {
  return (
    <View className="flex-1 items-center justify-center px-6 py-16">
      <View className="items-center space-y-4 max-w-md">
        {/* Rocket Icon */}
        <View className="h-16 w-16 rounded-full bg-primary/10 items-center justify-center mb-2">
          <Rocket className="h-8 w-8 text-primary" />
        </View>
        
        {/* Title & Description */}
        <View className="items-center space-y-2">
          <Text className="text-xl font-semibold text-center text-foreground">
            No roadmaps yet
          </Text>
          <Text className="text-sm text-center text-muted-foreground leading-relaxed">
            Create your first AI-powered learning roadmap to get started.
          </Text>
        </View>
      </View>
    </View>
  );
}
