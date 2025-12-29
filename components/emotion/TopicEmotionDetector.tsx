import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, ActivityIndicator, Dimensions, Image } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Text } from '@/components/ui/text';
import { Card } from '@/components/ui/card';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { Brain, Camera } from 'lucide-react-native';

interface EmotionResult {
  emotion: string;
  confidence: number;
  timestamp: Date;
}

interface TopicEmotionDetectorProps {
  onEmotionDetected?: (emotion: string, confidence: number) => void;
}

const EMOTIONS = [
  'wbored',
  'confused',
  'drowsy',
  'engaged',
  'frustrated',
  'looking_away'
];

const DETECTION_INTERVAL = 10000; // 10 seconds
const { width: screenWidth } = Dimensions.get('window');

export function TopicEmotionDetector({ onEmotionDetected }: TopicEmotionDetectorProps) {
  const [permission, requestPermission] = useCameraPermissions();
  const [emotion, setEmotion] = useState<EmotionResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [countdown, setCountdown] = useState(DETECTION_INTERVAL / 1000);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const cameraRef = useRef<CameraView>(null);

  useEffect(() => {
    if (!permission) {
      requestPermission();
    }
  }, [permission]);

  useEffect(() => {
    if (!permission?.granted) return;

    // Start continuous emotion detection
    const interval = setInterval(() => {
      detectEmotion();
      setCountdown(DETECTION_INTERVAL / 1000);
    }, DETECTION_INTERVAL);

    // Initial detection after 2 seconds
    const initialTimeout = setTimeout(() => {
      detectEmotion();
    }, 2000);

    return () => {
      clearInterval(interval);
      clearTimeout(initialTimeout);
    };
  }, [permission]);

  useEffect(() => {
    if (!permission?.granted) return;

    // Countdown timer
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          return DETECTION_INTERVAL / 1000;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [permission]);

  const detectEmotion = async () => {
    if (isProcessing || !cameraRef.current || !permission?.granted) return;

    setIsProcessing(true);

    try {
      // Capture photo
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.5,
        base64: true,
      });

      if (photo) {
        setCapturedImage(photo.uri);
      }

      // TODO: Replace with actual TensorFlow Lite model inference
      // For now, simulate emotion detection
      const randomEmotion = EMOTIONS[Math.floor(Math.random() * EMOTIONS.length)];
      const randomConfidence = 0.6 + Math.random() * 0.4;
      
      const result: EmotionResult = {
        emotion: randomEmotion,
        confidence: randomConfidence,
        timestamp: new Date(),
      };

      setEmotion(result);
      onEmotionDetected?.(result.emotion, result.confidence);

      console.log('📸 Emotion detected:', result);
    } catch (error) {
      console.error('Error detecting emotion:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const getEmotionColor = (emotionName: string): string => {
    const colors: Record<string, string> = {
      'engaged': '#4CAF50',
      'confused': '#FF9800',
      'frustrated': '#F44336',
      'drowsy': '#9C27B0',
      'wbored': '#2196F3',
      'looking_away': '#607D8B'
    };
    return colors[emotionName] || '#999';
  };

  const getEmotionEmoji = (emotionName: string): string => {
    const emojis: Record<string, string> = {
      'engaged': '😊',
      'confused': '😕',
      'frustrated': '😤',
      'drowsy': '😴',
      'wbored': '😐',
      'looking_away': '👀'
    };
    return emojis[emotionName] || '😐';
  };

  const getEmotionLabel = (emotionName: string): string => {
    const labels: Record<string, string> = {
      'engaged': 'Engaged',
      'confused': 'Confused',
      'frustrated': 'Frustrated',
      'drowsy': 'Drowsy',
      'wbored': 'Bored',
      'looking_away': 'Distracted'
    };
    return labels[emotionName] || emotionName;
  };

  if (!permission) {
    return null;
  }

  if (!permission.granted) {
    return (
      <Card className="mb-4">
        <View className="p-4 flex-row items-center gap-3">
          <Camera size={20} className="text-muted-foreground" />
          <View className="flex-1">
            <Text className="text-sm font-medium">Emotion Detection Available</Text>
            <Text className="text-xs text-muted-foreground">Grant camera permission to track engagement</Text>
          </View>
        </View>
      </Card>
    );
  }

  return (
    <View className="mb-6">
      {/* Hidden Camera View */}
      <View style={{ height: 0, width: 0, overflow: 'hidden' }}>
        <CameraView
          style={{ width: 1, height: 1 }}
          facing="front"
          ref={cameraRef}
        />
      </View>

      {/* Emotion Display Card */}
      <Card>
        <View className="p-4">
          <View className="flex-row items-center justify-between mb-3">
            <View className="flex-row items-center gap-2">
              <Brain size={18} className="text-purple-600 dark:text-purple-400" />
              <Text className="text-sm font-semibold">Learning Engagement</Text>
            </View>
            
            {/* Timer */}
            <View className="flex-row items-center gap-2 bg-secondary px-3 py-1.5 rounded-full">
              <Camera size={14} className="text-foreground" />
              <Text className="text-xs font-medium">Next: {countdown}s</Text>
            </View>
          </View>

          {/* Current Emotion Display */}
          {emotion && (
            <Animated.View 
              entering={FadeIn.duration(300)}
              className="flex-row items-center gap-3"
            >
              {/* Captured Image Thumbnail */}
              {capturedImage && (
                <View className="relative">
                  <Image 
                    source={{ uri: capturedImage }} 
                    style={styles.thumbnail}
                    className="rounded-lg"
                  />
                  {isProcessing && (
                    <View style={styles.thumbnailOverlay}>
                      <ActivityIndicator size="small" color="#fff" />
                    </View>
                  )}
                </View>
              )}

              {/* Emotion Info */}
              <View className="flex-1">
                <View className="flex-row items-center gap-2 mb-1">
                  <Text style={{ fontSize: 24 }}>
                    {getEmotionEmoji(emotion.emotion)}
                  </Text>
                  <Text 
                    className="text-base font-bold"
                    style={{ color: getEmotionColor(emotion.emotion) }}
                  >
                    {getEmotionLabel(emotion.emotion)}
                  </Text>
                </View>
                <View className="flex-row items-center gap-2">
                  <View 
                    className="h-2 flex-1 rounded-full bg-secondary overflow-hidden"
                    style={{ maxWidth: 120 }}
                  >
                    <View 
                      className="h-full rounded-full"
                      style={{ 
                        width: `${emotion.confidence * 100}%`,
                        backgroundColor: getEmotionColor(emotion.emotion)
                      }}
                    />
                  </View>
                  <Text className="text-xs text-muted-foreground">
                    {(emotion.confidence * 100).toFixed(0)}%
                  </Text>
                </View>
              </View>
            </Animated.View>
          )}

          {/* Initial State */}
          {!emotion && (
            <View className="flex-row items-center gap-3 py-2">
              {isProcessing ? (
                <>
                  <ActivityIndicator size="small" />
                  <Text className="text-sm text-muted-foreground">Analyzing your engagement...</Text>
                </>
              ) : (
                <>
                  <Camera size={16} className="text-muted-foreground" />
                  <Text className="text-sm text-muted-foreground">
                    Detecting your learning engagement...
                  </Text>
                </>
              )}
            </View>
          )}
        </View>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  thumbnail: {
    width: 60,
    height: 60,
    borderWidth: 2,
    borderColor: 'rgba(147, 51, 234, 0.3)',
  },
  thumbnailOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
  },
});
