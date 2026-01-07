import React, { useEffect, useState, useRef } from 'react';
import { View, Pressable } from 'react-native';
import { Text } from '@/components/ui/text';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  withSpring,
  withDelay,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import { cn } from '@/lib/utils';
import { 
  calculateLevelProgress,
  getXPForNextLevel,
  getXPForCurrentLevel,
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
  level,
  onComplete 
}: XPGainAnimationProps) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  
  const [displayXP, setDisplayXP] = useState(oldXP);
  const progressWidth = useSharedValue(0);
  const translateY = useSharedValue(-100);
  const opacity = useSharedValue(0);

  const currentLevelXP = getXPForCurrentLevel(level);
  const nextLevelXP = getXPForNextLevel(level);
  const xpNeededForLevel = nextLevelXP - currentLevelXP;
  
  const oldProgress = calculateLevelProgress(oldXP, level);
  const newProgress = calculateLevelProgress(newXP, level);
  const xpGained = newXP - oldXP;
  const xpRemaining = nextLevelXP - newXP;

  useEffect(() => {
    if (visible) {
      // Simple slide down from top
      translateY.value = withTiming(0, { 
        duration: 250, 
        easing: Easing.out(Easing.ease)
      });
      opacity.value = withTiming(1, { duration: 200 });

      // Animate progress bar - simpler timing
      progressWidth.value = oldProgress;
      progressWidth.value = withTiming(newProgress, {
        duration: 1500,
        easing: Easing.out(Easing.ease),
      });

      // Animate XP counter - fewer steps for better performance
      const duration = 1500;
      const steps = 40;
      const increment = (newXP - oldXP) / steps;
      let current = 0;

      const interval = setInterval(() => {
        current++;
        const nextValue = Math.min(oldXP + (increment * current), newXP);
        setDisplayXP(Math.floor(nextValue));

        if (current >= steps) {
          clearInterval(interval);
          setDisplayXP(newXP);
        }
      }, duration / steps);

      // Auto-dismiss after animation
      setTimeout(() => {
        handleComplete();
      }, 3000);

      return () => clearInterval(interval);
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
    width: `${progressWidth.value}%`,
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
              className={cn(
                "rounded-2xl p-4 shadow-lg",
                isDark 
                  ? "bg-card border border-border" 
                  : "bg-card border border-border"
              )}
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
                  <View className={cn(
                    "w-8 h-8 rounded-full items-center justify-center",
                    isDark ? "bg-purple-500/20" : "bg-purple-500/20"
                  )}>
                    <Star size={18} className="text-purple-500" fill="rgb(168, 85, 247)" />
                  </View>
                  <Text className={cn(
                    "text-base font-bold",
                    xpGained > 0 ? "text-purple-600" : "text-red-600"
                  )}>
                    {xpGained > 0 ? '+' : ''}{xpGained} XP
                  </Text>
                </View>
                
                <Text className="text-sm font-semibold">
                  {formatXP(displayXP)} XP
                </Text>
              </View>

              {/* Progress Bar */}
              <View className="mb-2">
                <View className={cn(
                  "w-full h-2 rounded-full overflow-hidden",
                  isDark ? "bg-muted" : "bg-muted"
                )}>
                  <Animated.View
                    style={progressStyle}
                    className="h-full bg-primary rounded-full"
                  />
                </View>
              </View>

              {/* Level Info */}
              <View className="flex-row items-center justify-between">
                <Text className="text-xs text-muted-foreground">
                  Level {level}
                </Text>
                <Text className="text-xs font-medium text-primary">
                  {formatXP(xpRemaining)} to Level {level + 1}
                </Text>
              </View>
            </View>
          </Pressable>
        </Animated.View>
      </SafeAreaView>
    </View>
  );
}
