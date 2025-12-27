import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  Easing,
  FadeInDown,
  FadeOutUp,
} from 'react-native-reanimated';
import { Text } from '@/components/ui/text';
import { Rocket } from 'lucide-react-native';

interface RocketLoadingAnimationProps {
  progress?: string;
}

const thinkingMessages = [
  'Analyzing your topic...',
  'Breaking down concepts...',
  'Mapping prerequisites...',
  'Structuring learning path...',
  'Organizing modules...',
  'Creating roadmap...',
];

export function RocketLoadingAnimation({ progress }: RocketLoadingAnimationProps) {
  const rocketY = useSharedValue(0);
  const [thinkingIndex, setThinkingIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setThinkingIndex((prev) => (prev + 1) % thinkingMessages.length);
    }, 2500);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    rocketY.value = withRepeat(
      withSequence(
        withTiming(-8, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 1000, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    );
  }, []);

  const rocketAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: rocketY.value }],
  }));

  const displayText = progress || thinkingMessages[thinkingIndex];

  return (
    <View className="items-center justify-center py-12">

      {/* Rocket */}
      <View className="items-center">
        <Animated.View
          style={rocketAnimatedStyle}
          className="
            items-center justify-center
            h-24 w-24 rounded-full
            bg-neutral-200 dark:bg-neutral-700
            mb-2
          "
        >
          <Rocket
            className="
              h-12 w-12
              text-neutral-600 dark:text-neutral-300
            "
            style={{ transform: [{ rotate: '-45deg' }] }}
          />
        </Animated.View>
      </View>

      {/* Text */}
      <View className="mt-8 items-center px-6">
        <Text className="text-base font-semibold text-foreground mb-2">
          Creating Your Roadmap
        </Text>
        <View className="h-12 justify-center">
          <Animated.View
            key={displayText}
            entering={FadeInDown.duration(400).springify()}
            exiting={FadeOutUp.duration(300)}
          >
            <Text className="text-sm text-muted-foreground text-center leading-relaxed">
              {displayText}
            </Text>
          </Animated.View>
        </View>
      </View>

      {/* Loading dots */}
      <View className="flex-row items-center gap-2 mt-4">
        <LoadingDot delay={0} />
        <LoadingDot delay={200} />
        <LoadingDot delay={400} />
      </View>
    </View>
  );
}

function LoadingDot({ delay }: { delay: number }) {
  const opacity = useSharedValue(0.3);

  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(0.3, { duration: 0 }),
        withTiming(0.3, { duration: delay }),
        withTiming(1, { duration: 400 }),
        withTiming(0.3, { duration: 400 })
      ),
      -1,
      false
    );
  }, [delay]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={animatedStyle}
      className="h-2 w-2 rounded-full bg-neutral-500 dark:bg-neutral-400"
    />
  );
}
