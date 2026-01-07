import React from 'react';
import { View } from 'react-native';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';
import {
  calculateLevelProgress,
  getXPForNextLevel,
  getXPForCurrentLevel,
  formatXP,
  getLevelTitle,
} from '@/lib/gamification';
import { Trophy, Zap } from 'lucide-react-native';

interface XPProgressBarProps {
  xp: number;
  level: number;
  showDetails?: boolean;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function XPProgressBar({ 
  xp, 
  level, 
  showDetails = true,
  className,
  size = 'md'
}: XPProgressBarProps) {
  const progress = calculateLevelProgress(xp, level);
  
  const currentLevelXP = getXPForCurrentLevel(level);
  const nextLevelXP = getXPForNextLevel(level);
  const xpInCurrentLevel = xp - currentLevelXP;
  const xpNeededForLevel = nextLevelXP - currentLevelXP;
  
  const isMaxLevel = level >= 50;

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

  return (
    <View className={cn('w-full', className)}>
      {showDetails && (
        <View className="flex-row items-center justify-between mb-2">
          <View className="flex-row items-center gap-2">
            <Trophy size={size === 'sm' ? 14 : size === 'md' ? 16 : 18} className="text-yellow-600" fill="rgb(202, 138, 4)" />
            <Text className={cn('font-semibold', textSizes[size])}>
              Level {level}
            </Text>
            <Text className={cn('text-muted-foreground', textSizes[size])}>
              • {getLevelTitle(level)}
            </Text>
          </View>
          
          <View className="flex-row items-center gap-1">
            <Zap size={size === 'sm' ? 12 : size === 'md' ? 14 : 16} className="text-yellow-500" fill="rgb(234, 179, 8)" />
            <Text className={cn('font-medium', textSizes[size])}>
              {formatXP(xp)} XP
            </Text>
          </View>
        </View>
      )}

      {/* Progress Bar */}
      <View className={cn(
        'w-full bg-muted rounded-full overflow-hidden',
        heights[size]
      )}>
        <View
          style={{ width: `${progress}%` }}
          className={cn(
            'h-full rounded-full',
            isMaxLevel 
              ? 'bg-yellow-500'
              : 'bg-primary'
          )}
        />
      </View>

      {/* XP Details */}
      {showDetails && !isMaxLevel && (
        <View className="flex-row justify-between mt-1">
          <Text className="text-xs text-muted-foreground">
            {formatXP(xpInCurrentLevel)} / {formatXP(xpNeededForLevel)} XP
          </Text>
          <Text className="text-xs text-muted-foreground">
            {Math.round(progress)}%
          </Text>
        </View>
      )}

      {showDetails && isMaxLevel && (
        <Text className="text-xs text-center mt-1 text-yellow-600 font-medium">
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
      'flex-row items-center gap-1 px-2 py-1 rounded-md bg-yellow-500/10',
      className
    )}>
      <Zap size={14} className="text-yellow-500" fill="rgb(234, 179, 8)" />
      <Text className="text-xs font-semibold text-yellow-600">
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
      'rounded-full bg-primary/10 border-2 border-primary items-center justify-center',
      config.container,
      className
    )}>
      <Text className={cn('font-bold text-primary', config.text)}>
        {level}
      </Text>
    </View>
  );
}
