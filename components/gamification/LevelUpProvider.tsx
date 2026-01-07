import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { View, Modal, Pressable } from 'react-native';
import { Text } from '@/components/ui/text';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  withSequence,
  withSpring,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import { cn } from '@/lib/utils';
import { getLevelTitle, getXPForNextLevel, getXPForCurrentLevel, formatXP } from '@/lib/gamification';
import { Sparkles, Star } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useColorScheme } from '@/lib/useColorScheme';
import { XPGainAnimation } from './XPGainAnimation';

interface LevelUpData {
  newLevel: number;
  oldLevel: number;
  xpGained: number;
  action: string;
  oldXP?: number;
  newXP?: number;
}

interface LevelUpContextType {
  showLevelUp: (data: LevelUpData) => void;
  showXPGain: (oldXP: number, newXP: number, level: number) => void;
}

const LevelUpContext = createContext<LevelUpContextType | undefined>(undefined);

export function useLevelUp() {
  const context = useContext(LevelUpContext);
  if (!context) {
    throw new Error('useLevelUp must be used within LevelUpProvider');
  }
  return context;
}

export function LevelUpProvider({ children }: { children: React.ReactNode }) {
  const [visible, setVisible] = useState(false);
  const [levelData, setLevelData] = useState<LevelUpData | null>(null);
  const [showXPGainModal, setShowXPGainModal] = useState(false);
  const [xpGainData, setXPGainData] = useState<{ oldXP: number; newXP: number; level: number } | null>(null);
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

  // Animation values
  const scale = useSharedValue(0.95);
  const opacity = useSharedValue(0);

  const showXPGain = useCallback((oldXP: number, newXP: number, level: number) => {
    setXPGainData({ oldXP, newXP, level });
    setShowXPGainModal(true);
  }, []);

  const showLevelUp = useCallback((data: LevelUpData) => {
    // If we have XP data, show XP gain first, then level up
    if (data.oldXP !== undefined && data.newXP !== undefined) {
      setXPGainData({ oldXP: data.oldXP, newXP: data.newXP, level: data.oldLevel });
      setShowXPGainModal(true);
      // Store level data to show after XP animation
      setLevelData(data);
    } else {
      // Just show level up
      setLevelData(data);
      setVisible(true);
      startAnimations();
    }
  }, []);

  const handleXPGainComplete = useCallback(() => {
    setShowXPGainModal(false);
    setXPGainData(null);
    
    // If we have pending level up data, show it now
    if (levelData && levelData.newLevel > levelData.oldLevel) {
      setTimeout(() => {
        setVisible(true);
        startAnimations();
      }, 300);
    }
  }, [levelData]);

  const startAnimations = useCallback(() => {
    // Simple fast animations to prevent stuttering
    scale.value = withTiming(1, { duration: 200, easing: Easing.out(Easing.ease) });
    opacity.value = withTiming(1, { duration: 200 });
  }, []);

  const hideModal = useCallback(() => {
    opacity.value = withTiming(0, { duration: 150 }, () => {
      runOnJS(setVisible)(false);
      runOnJS(setLevelData)(null);
      scale.value = 0.95;
    });
  }, []);

  const containerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  const value = { showLevelUp, showXPGain };

  return (
    <LevelUpContext.Provider value={value}>
      {children}
      
      {/* XP Gain Animation */}
      {xpGainData && (
        <XPGainAnimation
          visible={showXPGainModal}
          oldXP={xpGainData.oldXP}
          newXP={xpGainData.newXP}
          level={xpGainData.level}
          onComplete={handleXPGainComplete}
        />
      )}
      
      {/* Level Up Modal */}
      <Modal
        visible={visible}
        transparent
        animationType="none"
        onRequestClose={hideModal}
      >
        <Pressable 
          onPress={hideModal}
          className="flex-1 items-center justify-center bg-black/60"
        >
          <Pressable onPress={(e) => e.stopPropagation()}>
            <Animated.View style={containerStyle}>
              <View 
                className={cn(
                  "w-80 rounded-3xl p-8 border",
                  isDark ? "bg-card border-border" : "bg-card border-border"
                )}
                style={{
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 8 },
                  shadowOpacity: 0.3,
                  shadowRadius: 16,
                  elevation: 10,
                }}
              >
                {/* Star Icon */}
                <View className="items-center mb-6">
                  <View className={cn(
                    "w-16 h-16 rounded-full items-center justify-center",
                    isDark ? "bg-purple-500/10" : "bg-purple-500/10"
                  )}>
                    <Star size={32} className="text-purple-500" fill="rgb(168, 85, 247)" />
                  </View>
                </View>

                {/* Level Number */}
                <View className="items-center mb-2">
                  <Text className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                    Level
                  </Text>
                  <Text className="text-5xl font-bold my-2">
                    {levelData?.newLevel}
                  </Text>
                  <Text className="text-base text-muted-foreground">
                    {getLevelTitle(levelData?.newLevel || 1)}
                  </Text>
                </View>

                {/* Divider */}
                <View className="w-full h-px bg-border my-6" />

                {/* XP Stats */}
                <View className="mb-6">
                  <View className="flex-row items-center justify-between mb-3">
                    <Text className="text-sm text-muted-foreground">Total XP</Text>
                    <Text className="text-sm font-semibold">{formatXP(levelData?.newXP || 0)}</Text>
                  </View>

                  {/* Progress to Next Level */}
                  <View>
                    <View className="flex-row items-center justify-between mb-2">
                      <Text className="text-xs text-muted-foreground">Progress to Level {(levelData?.newLevel || 1) + 1}</Text>
                      <Text className="text-xs font-medium text-purple-500">
                        {(() => {
                          const currentLevelXP = getXPForCurrentLevel(levelData?.newLevel || 1);
                          const nextLevelXP = getXPForNextLevel(levelData?.newLevel || 1);
                          const userXP = levelData?.newXP || 0;
                          const progressXP = userXP - currentLevelXP;
                          const totalNeeded = nextLevelXP - currentLevelXP;
                          return `${formatXP(progressXP)} / ${formatXP(totalNeeded)}`;
                        })()}
                      </Text>
                    </View>
                    
                    {/* Progress Bar */}
                    <View className={cn(
                      "w-full h-2 rounded-full overflow-hidden",
                      isDark ? "bg-muted" : "bg-muted"
                    )}>
                      <View 
                        className="h-full rounded-full bg-purple-500"
                        style={{ 
                          width: `${(() => {
                            const currentLevelXP = getXPForCurrentLevel(levelData?.newLevel || 1);
                            const nextLevelXP = getXPForNextLevel(levelData?.newLevel || 1);
                            const userXP = levelData?.newXP || 0;
                            const progressXP = userXP - currentLevelXP;
                            const totalNeeded = nextLevelXP - currentLevelXP;
                            const progress = (progressXP / totalNeeded) * 100;
                            return Math.min(100, Math.max(0, progress));
                          })()}%`
                        }}
                      />
                    </View>
                  </View>
                </View>

                {/* Continue Button */}
                <Pressable
                  onPress={hideModal}
                  className={cn(
                    "w-full py-3.5 rounded-xl items-center",
                    isDark ? "bg-primary" : "bg-primary"
                  )}
                >
                  <Text className="text-sm font-semibold text-primary-foreground uppercase tracking-wide">
                    Continue
                  </Text>
                </Pressable>
              </View>
            </Animated.View>
          </Pressable>
        </Pressable>
      </Modal>
    </LevelUpContext.Provider>
  );
}
