/**
 * TopicEmotionDetector.tsx
 * 
 * Real-time emotion detection during learning using MediaPipe Face Landmarker.
 * Captures a photo every 10 seconds and analyzes facial landmarks to determine
 * emotional state (engaged, drowsy, confused, frustrated, bored, looking_away).
 * 
 * IMPORTANT: This component requires a Dev Client (not Expo Go) because it uses
 * native MediaPipe modules. Run with: npx expo prebuild && npx expo run:android
 */

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Text } from "@/components/ui/text";
import { Card } from "@/components/ui/card";
import Animated, { FadeIn } from "react-native-reanimated";
import { Brain, Camera, AlertCircle } from "lucide-react-native";

// Import emotion detector with Python-ported logic
import {
  EmotionDetector,
  normalizeLandmarks,
  type EmotionResult as EmotionDetectorResult,
} from "@/lib/emotion/EmotionDetector";

// Conditionally import native face landmarks module
let FaceLandmarks: any = null;
let isFaceLandmarksAvailable = false;
let FaceLandmarksResult: any;

try {
  if (Platform.OS !== "web") {
    // Try to import the module - will throw if not available
    const faceLandmarksModule = require("@/modules/face-landmarks/src");
    FaceLandmarks = faceLandmarksModule.FaceLandmarks;
    FaceLandmarksResult = faceLandmarksModule.FaceLandmarksResult;
    isFaceLandmarksAvailable = FaceLandmarks !== null && FaceLandmarks !== undefined;
  }
} catch (error) {
  console.warn("FaceLandmarks native module not available:", error);
  isFaceLandmarksAvailable = false;
  FaceLandmarks = null;
}

interface EmotionResultState {
  emotion: string;
  confidence: number;
  timestamp: Date;
}

interface TopicEmotionDetectorProps {
  onEmotionDetected?: (emotion: string, confidence: number) => void;
}

// Emotion labels - matches Python output
const EMOTIONS = [
  "engaged",
  "drowsy",
  "confused",
  "frustrated",
  "bored",
  "looking_away",
];

const DETECTION_INTERVAL = 10000; // 30 seconds

export function TopicEmotionDetector({
  onEmotionDetected,
}: TopicEmotionDetectorProps) {
  const [permission, requestPermission] = useCameraPermissions();
  const [emotion, setEmotion] = useState<EmotionResultState | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [countdown, setCountdown] = useState(DETECTION_INTERVAL / 1000);
  const [error, setError] = useState<string | null>(null);
  const cameraRef = useRef<CameraView>(null);
  
  // Initialize emotion detector
  const emotionDetector = useRef(new EmotionDetector()).current;
  
  // Store callback in ref to prevent interval recreation
  const onEmotionDetectedRef = useRef(onEmotionDetected);
  useEffect(() => {
    onEmotionDetectedRef.current = onEmotionDetected;
  }, [onEmotionDetected]);

  // Main emotion detection function
  const detectEmotion = useCallback(async () => {
    if (isProcessing) return;
    if (!cameraRef.current) {
      console.warn("Camera ref not available");
      return;
    }

    // Reset countdown immediately when detection starts
    setCountdown(DETECTION_INTERVAL / 1000);
    setIsProcessing(true);
    setError(null);

    try {
      // Capture photo from camera (silently, no processing to avoid sound/flicker)
      const photo = await cameraRef.current.takePictureAsync({
        quality: 1,
        skipProcessing: true,
        exif: false,
        base64: false,
        imageType: 'jpg',
        isImageMirror: false,
        shutterSound: false
      });

      if (!photo?.uri) {
        console.warn("No photo captured");
        setIsProcessing(false);
        return;
      }

      console.log("📷 Photo captured:", photo.uri);

      // Detect face landmarks using native module
      const result: any =
        await FaceLandmarks.detectFromImageAsync(photo.uri);

      console.log(
        `📊 Face detection result: ${result.landmarks.length} landmarks, ${result.width}x${result.height}`
      );

      if (result.landmarks.length === 0) {
        // No face detected
        const unknownResult: EmotionResultState = {
          emotion: "unknown",
          confidence: 0,
          timestamp: new Date(),
        };
        setEmotion(unknownResult);
        onEmotionDetected?.("unknown", 0);
        console.log("⚠️ No face detected in image");
        setIsProcessing(false);
        return;
      }

      // Convert normalized landmarks to pixel coordinates (matches Python)
      const pixelLandmarks = normalizeLandmarks(
        result.width,
        result.height,
        result.landmarks
      );

      console.log(
        `📊 Converted ${pixelLandmarks.length} landmarks to pixel coordinates`
      );

      // Run emotion detection using rule-based logic
      const emotionResult: EmotionDetectorResult =
        emotionDetector.detectFromLandmarks(pixelLandmarks);

      console.log(
        `🎯 Emotion detected: ${emotionResult.emotion} (${(emotionResult.confidence * 100).toFixed(1)}%)`
      );
      console.log("📊 Features:", JSON.stringify(emotionResult.features, null, 2));

      const result_state: EmotionResultState = {
        emotion: emotionResult.emotion,
        confidence: emotionResult.confidence,
        timestamp: new Date(),
      };

      setEmotion(result_state);
      onEmotionDetectedRef.current?.(emotionResult.emotion, emotionResult.confidence);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      console.error("Error detecting emotion:", errorMessage);
      setError(errorMessage);
    } finally {
      setIsProcessing(false);
    }
  }, [isProcessing, emotionDetector]);

  // Store detectEmotion in ref to prevent interval recreation
  const detectEmotionRef = useRef(detectEmotion);
  useEffect(() => {
    detectEmotionRef.current = detectEmotion;
  }, [detectEmotion]);

  // Set up detection interval - runs only once on mount
  useEffect(() => {
    if (!isFaceLandmarksAvailable) return;

    console.log('🔄 Setting up emotion detection interval (30 seconds)');

    // Initial detection after 2 seconds
    const initialTimeout = setTimeout(() => {
      detectEmotionRef.current();
    }, 2000);

    // Regular detection every 30 seconds
    const interval = setInterval(() => {
      detectEmotionRef.current();
    }, DETECTION_INTERVAL);

    return () => {
      console.log('🛑 Cleaning up emotion detection interval');
      clearInterval(interval);
      clearTimeout(initialTimeout);
    };
  }, []);

  // Countdown timer
  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) =>
        prev <= 1 ? DETECTION_INTERVAL / 1000 : prev - 1
      );
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Helper functions for UI
  const getEmotionColor = (emotionName: string): string => {
    const colors: Record<string, string> = {
      engaged: "#4CAF50",
      confused: "#FF9800",
      frustrated: "#F44336",
      drowsy: "#9C27B0",
      bored: "#2196F3",
      looking_away: "#607D8B",
      unknown: "#999999",
    };
    return colors[emotionName] || "#999";
  };

  const getEmotionEmoji = (emotionName: string): string => {
    const emojis: Record<string, string> = {
      engaged: "😊",
      confused: "😕",
      frustrated: "😤",
      drowsy: "😴",
      bored: "😐",
      looking_away: "👀",
      unknown: "❓",
    };
    return emojis[emotionName] || "😐";
  };

  const getEmotionLabel = (emotionName: string): string => {
    const labels: Record<string, string> = {
      engaged: "Engaged",
      confused: "Confused",
      frustrated: "Frustrated",
      drowsy: "Drowsy",
      bored: "Bored",
      looking_away: "Distracted",
      unknown: "No Face Detected",
    };
    return labels[emotionName] || emotionName;
  };

  // Early return if native module is not available
  if (!isFaceLandmarksAvailable) {
    return (
      <Card className="mx-4 mb-4 border-yellow-500">
        <View className="p-4">
          <View className="flex-row items-center space-x-2 mb-2">
            <AlertCircle className="h-5 w-5 text-yellow-600" />
            <Text className="font-semibold text-yellow-700 ml-2">
              Emotion Detection Unavailable
            </Text>
          </View>
          <Text className="text-sm text-muted-foreground">
            Emotion detection requires a development build with native modules.
            This feature is not available in Expo Go.
          </Text>
          <Text className="text-xs text-muted-foreground mt-2">
            Run: npx expo prebuild && npx expo run:android
          </Text>
        </View>
      </Card>
    );
  }

  // Handle camera permissions
  if (!permission) {
    return (
      <Card className="mx-4 mb-4">
        <View className="p-4">
          <ActivityIndicator size="small" />
          <Text className="text-sm text-muted-foreground mt-2">
            Checking camera permissions...
          </Text>
        </View>
      </Card>
    );
  }

  if (!permission.granted) {
    return (
      <Card className="mx-4 mb-4 border-yellow-500">
        <View className="p-4">
          <View className="flex-row items-center space-x-2 mb-2">
            <Camera className="h-5 w-5 text-yellow-600" />
            <Text className="font-semibold text-yellow-700 ml-2">
              Camera Permission Required
            </Text>
          </View>
          <Text className="text-sm text-muted-foreground mb-3">
            This feature needs camera access to monitor your learning
            engagement.
          </Text>
          <View
            className="bg-primary px-4 py-2 rounded-lg"
            onTouchEnd={requestPermission}
          >
            <Text className="text-primary-foreground text-center font-medium">
              Grant Permission
            </Text>
          </View>
        </View>
      </Card>
    );
  }

  return (
    <View className="mb-6">
      {/* Hidden camera - positioned off-screen to prevent flicker */}
      <View style={{ position: "absolute", left: -9999, top: -9999, width: 1, height: 1, opacity: 0, zIndex: -1 }}>
        <CameraView
          ref={cameraRef}
          style={{ width: 1, height: 1 }}
          facing="front"
          mirror={false}
          enableTorch={false}
          animateShutter={false}
        />
      </View>

      <Card>
        <View className="p-4">
          <View className="flex-row items-center gap-2 mb-3">
            <Brain
              size={18}
              className="text-purple-600 dark:text-purple-400"
            />
            <Text className="text-sm font-semibold">Learning Engagement</Text>
          </View>

          {error && (
            <View className="bg-red-50 dark:bg-red-900/20 p-2 rounded-lg mb-3">
              <Text className="text-xs text-red-600 dark:text-red-400">
                {error}
              </Text>
            </View>
          )}

          {emotion && (
            <Animated.View
              entering={FadeIn.duration(300)}
              className="flex-row items-center gap-3"
            >
              <View className="flex-1">
                <View className="flex-row items-center gap-2 mb-1">
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
                        backgroundColor: getEmotionColor(emotion.emotion),
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

          {!emotion && (
            <View className="flex-row items-center gap-3 py-2">
              {isProcessing ? (
                <>
                  <ActivityIndicator size="small" />
                  <Text className="text-sm text-muted-foreground">
                    Analyzing your engagement…
                  </Text>
                </>
              ) : (
                <>
                  <Camera size={16} className="text-muted-foreground" />
                  <Text className="text-sm text-muted-foreground">
                    Detecting your learning engagement…
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
    borderColor: "rgba(147, 51, 234, 0.3)",
  },
  thumbnailOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 8,
  },
});
