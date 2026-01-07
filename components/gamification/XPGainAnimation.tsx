import React, { useEffect, useState } from 'react';
import { View, Pressable } from 'react-native';
import { Text } from '@/components/ui/text';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import { cn } from '@/lib/utils';
import { 
  calculateLevel,
  calculateLevelProgress,
  getXPForNextLevel,
  formatXP,
} from '@/lib/gamification';
import { Star } from '@/components/Icons';
import { useColorScheme } from '@/lib/useColorScheme';
import { SafeAreaView } from 'react-native-safe-area-context';

interface XPGainAnimationProps {
  visible: boolean;
  oldXP: number;
  newXP: number;
  level: number;
  onComplete: () => void;
}

export function XPGainAnimation({ 
  visible, 
  oldXP, 
  newXP, 
  level: levelProp,
  onComplete 
}: XPGainAnimationProps) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  
  const [displayXP, setDisplayXP] = useState(oldXP);
  const progressWidth = useSharedValue(0);
  const translateY = useSharedValue(-100);
  const opacity = useSharedValue(0);

  // Calculate actual levels from XP to ensure consistency
  const oldLevel = calculateLevel(oldXP);
  const newLevel = calculateLevel(newXP);
  // Use the new level for display (handles level-up case)
  const level = newLevel;
  const nextLevelXP = getXPForNextLevel(level);
  
  const xpGained = newXP - oldXP;
  const isGain = xpGained > 0;
  
  // Calculate proper progress for the new level
  // If leveled up, start progress from 0 for the new level
  const didLevelUp = newLevel > oldLevel;
  const oldProgress = didLevelUp ? 0 : calculateLevelProgress(oldXP, newLevel);
  const newProgress = calculateLevelProgress(newXP, newLevel);

  useEffect(() => {
    if (visible) {
      // Reset values
      setDisplayXP(oldXP);
      progressWidth.value = oldProgress;
      
      // Slide down animation
      translateY.value = withTiming(0, { 
        duration: 250, 
        easing: Easing.out(Easing.ease)
      });
      opacity.value = withTiming(1, { duration: 200 });

      // Animate progress bar from old to new progress
      progressWidth.value = withTiming(newProgress, {
        duration: 1200,
        easing: Easing.out(Easing.cubic),
      });

      // Animate XP counter
      const duration = 1200;
      const steps = 40;
      const increment = (newXP - oldXP) / steps;
      let current = 0;

      const interval = setInterval(() => {
        current++;
        const nextValue = Math.round(oldXP + (increment * current));
        setDisplayXP(nextValue);

        if (current >= steps) {
          clearInterval(interval);
          setDisplayXP(newXP);
        }
      }, duration / steps);

      // Auto-dismiss after animation
      const timeout = setTimeout(() => {
        handleComplete();
      }, 2500);

      return () => {
        clearInterval(interval);
        clearTimeout(timeout);
      };
    }
  }, [visible, oldXP, newXP, oldProgress, newProgress]);

  const handleComplete = () => {
    translateY.value = withTiming(-100, { duration: 200 });
    opacity.value = withTiming(0, { duration: 200 }, () => {
      runOnJS(onComplete)();
    });
  };

  const containerStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  const progressStyle = useAnimatedStyle(() => ({
    width: `${Math.max(0, Math.min(100, progressWidth.value))}%`,
  }));

  if (!visible) return null;

  return (
    <View 
      className="absolute top-0 left-0 right-0 z-50"
      pointerEvents="box-none"
    >
      <SafeAreaView edges={['top']} className="px-4 pt-2">
        <Animated.View style={containerStyle}>
          <Pressable onPress={handleComplete}>
            <View 
              className="rounded-2xl p-4 shadow-lg bg-card border border-border"
              style={{
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.3,
                shadowRadius: 8,
                elevation: 8,
              }}
            >
              {/* XP Gained Header */}
              <View className="flex-row items-center justify-between mb-3">
                <View className="flex-row items-center gap-2">
                  <View className="w-8 h-8 rounded-full items-center justify-center bg-purple-500/20">
                    <Star size={18} className="text-purple-500" fill="rgb(168, 85, 247)" />
                  </View>
                  <Text className={cn(
                    "text-lg font-bold",
                    isGain ? "text-purple-500" : "text-red-500"
                  )}>
                    {isGain ? '+' : ''}{xpGained} XP
                  </Text>
                </View>
                
                <Text className="text-sm font-medium text-muted-foreground">
                  Level {level}
                </Text>
              </View>

              {/* Progress Bar - Game-like style */}
              <View className="relative">
                <View className={cn(
                  "w-full h-3 rounded-full overflow-hidden",
                  isDark ? "bg-muted/50" : "bg-muted"
                )}>
                  <Animated.View
                    style={progressStyle}
                    className={cn(
                      "h-full rounded-full",
                      isGain ? "bg-purple-500" : "bg-red-500"
                    )}
                  />
                </View>
                
                {/* XP Counter below progress bar */}
                <View className="flex-row justify-end mt-1.5">
                  <Text className="text-xs font-medium text-muted-foreground">
                    <Text className="text-foreground font-semibold">
                      {formatXP(displayXP)}
                    </Text>
                    {' / '}
                    {formatXP(nextLevelXP)} XP
                  </Text>
                </View>
              </View>
            </View>
          </Pressable>
        </Animated.View>
      </SafeAreaView>
    </View>
  );
}
