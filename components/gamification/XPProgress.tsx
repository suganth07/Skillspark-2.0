import React, { useEffect, useState, useRef } from 'react';
import { View } from 'react-native';
import { Text } from '@/components/ui/text';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { cn } from '@/lib/utils';
import {
  calculateLevel,
  calculateLevelProgress,
  getXPForNextLevel,
  getXPForCurrentLevel,
  formatXP,
  getLevelTitle,
} from '@/lib/gamification';
import { Star, Zap } from '@/components/Icons';

interface XPProgressBarProps {
  xp: number;
  level: number;
  showDetails?: boolean;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  animateFrom?: number; // Optional: animate from this XP value
}

export function XPProgressBar({ 
  xp, 
  level: levelProp, 
  showDetails = true,
  className,
  size = 'md',
  animateFrom
}: XPProgressBarProps) {
  // Always calculate actual level from XP to ensure consistency
  const level = calculateLevel(xp);
  
  const [displayXP, setDisplayXP] = useState(animateFrom ?? xp);
  const progressWidth = useSharedValue(0);
  const prevXPRef = useRef(xp);
  
  const currentLevelXP = getXPForCurrentLevel(level);
  const nextLevelXP = getXPForNextLevel(level);
  const xpInCurrentLevel = Math.max(0, xp - currentLevelXP);
  const xpNeededForLevel = nextLevelXP - currentLevelXP;
  const progress = calculateLevelProgress(xp, level);
  
  const isMaxLevel = level >= 50;

  // Animate progress bar and XP counter when xp changes
  useEffect(() => {
    const startXP = animateFrom ?? prevXPRef.current;
    const startProgress = calculateLevelProgress(startXP, level);
    
    // Set initial progress
    progressWidth.value = startProgress;
    
    // Animate to new progress
    progressWidth.value = withTiming(progress, {
      duration: 800,
      easing: Easing.out(Easing.cubic),
    });

    // Streaming XP counter animation
    if (startXP !== xp) {
      const duration = 800;
      const steps = 30;
      const increment = (xp - startXP) / steps;
      let current = 0;

      const interval = setInterval(() => {
        current++;
        const nextValue = Math.round(startXP + (increment * current));
        setDisplayXP(Math.min(Math.max(nextValue, 0), xp));

        if (current >= steps) {
          clearInterval(interval);
          setDisplayXP(xp);
        }
      }, duration / steps);

      prevXPRef.current = xp;
      return () => clearInterval(interval);
    } else {
      setDisplayXP(xp);
      prevXPRef.current = xp;
    }
  }, [xp, level, animateFrom, progress]);

  const progressStyle = useAnimatedStyle(() => ({
    width: `${Math.max(0, Math.min(100, progressWidth.value))}%`,
  }));

  const heights = {
    sm: 'h-2',
    md: 'h-3',
    lg: 'h-4',
  };

  const textSizes = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base',
  };

  const iconSizes = {
    sm: 14,
    md: 16,
    lg: 18,
  };

  return (
    <View className={cn('w-full', className)}>
      {showDetails && (
        <View className="flex-row items-center justify-between mb-2">
          <View className="flex-row items-center gap-2">
            <View className="w-6 h-6 rounded-full items-center justify-center bg-purple-500/20">
              <Star 
                size={iconSizes[size]} 
                className="text-purple-500" 
                fill="rgb(168, 85, 247)" 
              />
            </View>
            <Text className={cn('font-semibold text-foreground', textSizes[size])}>
              Level {level}
            </Text>
            <Text className={cn('text-muted-foreground', textSizes[size])}>
              • {getLevelTitle(level)}
            </Text>
          </View>
        </View>
      )}

      {/* Progress Bar */}
      <View className={cn(
        'w-full bg-muted rounded-full overflow-hidden',
        heights[size]
      )}>
        <Animated.View
          style={progressStyle}
          className={cn(
            'h-full rounded-full',
            isMaxLevel 
              ? 'bg-yellow-500'
              : 'bg-purple-500'
          )}
        />
      </View>

      {/* XP Details - show total XP / next level threshold */}
      {showDetails && !isMaxLevel && (
        <View className="flex-row justify-end mt-1.5">
          <Text className="text-xs font-medium text-muted-foreground">
            <Text className="text-foreground font-semibold">
              {formatXP(displayXP)}
            </Text>
            {' / '}
            {formatXP(nextLevelXP)} XP
          </Text>
        </View>
      )}

      {showDetails && isMaxLevel && (
        <Text className="text-xs text-center mt-1.5 text-yellow-600 font-medium">
          Max Level Reached! 🎉
        </Text>
      )}
    </View>
  );
}

interface XPBadgeProps {
  xp: number;
  className?: string;
}

export function XPBadge({ xp, className }: XPBadgeProps) {
  return (
    <View className={cn(
      'flex-row items-center gap-1 px-2 py-1 rounded-md bg-purple-500/10',
      className
    )}>
      <Star size={14} className="text-purple-500" fill="rgb(168, 85, 247)" />
      <Text className="text-xs font-semibold text-purple-600">
        +{xp} XP
      </Text>
    </View>
  );
}

interface LevelBadgeProps {
  level: number;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function LevelBadge({ level, size = 'md', className }: LevelBadgeProps) {
  const sizes = {
    sm: { container: 'w-8 h-8', icon: 12, text: 'text-xs' },
    md: { container: 'w-10 h-10', icon: 14, text: 'text-sm' },
    lg: { container: 'w-12 h-12', icon: 16, text: 'text-base' },
  };

  const config = sizes[size];

  return (
    <View className={cn(
      'rounded-full bg-purple-500/10 border-2 border-purple-500 items-center justify-center',
      config.container,
      className
    )}>
      <Text className={cn('font-bold text-purple-500', config.text)}>
        {level}
      </Text>
    </View>
  );
}
