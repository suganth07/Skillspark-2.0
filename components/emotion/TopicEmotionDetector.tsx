import React, { useState, useEffect, useRef, useMemo } from 'react';
import { View, StyleSheet, ActivityIndicator, Dimensions, Image, Platform } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Text } from '@/components/ui/text';
import { Card } from '@/components/ui/card';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Brain, Camera } from 'lucide-react-native';

import * as ImageManipulator from 'expo-image-manipulator';
import { Buffer } from 'buffer';
import jpeg from 'jpeg-js';

// Conditionally import TFLite only if the native module is available
let useTensorflowModel: any = null;
let isTfliteAvailable = false;

try {
  // Only attempt to import on native platforms where it should work
  if (Platform.OS !== 'web') {
    const tflite = require('react-native-fast-tflite');
    useTensorflowModel = tflite.useTensorflowModel;
    isTfliteAvailable = true;
  }
} catch (error) {
  console.warn('TensorFlow Lite native module not available:', error);
  isTfliteAvailable = false;
}

interface EmotionResult {
  emotion: string;
  confidence: number;
  timestamp: Date;
}

interface TopicEmotionDetectorProps {
  onEmotionDetected?: (emotion: string, confidence: number) => void;
}

/**
 * IMPORTANT:
 * - This component requires a Dev Client (not Expo Go), because fast-tflite is native.
 * - Ensure metro.config.js includes "tflite" in assetExts.
 */

// Keep your label order EXACTLY as your model output order.
// If you have labels.txt and it's different, update this array.
const EMOTIONS = ['wbored', 'confused', 'drowsy', 'engaged', 'frustrated', 'looking_away'];

const DETECTION_INTERVAL = 10000; // 10 seconds
const { width: screenWidth } = Dimensions.get('window');

function argMax(arr: ArrayLike<number>) {
  let bestIdx = 0;
  let bestVal = arr[0] ?? -Infinity;
  for (let i = 1; i < arr.length; i++) {
    const v = arr[i]!;
    if (v > bestVal) {
      bestVal = v;
      bestIdx = i;
    }
  }
  return { index: bestIdx, value: bestVal };
}

function softmax(logits: ArrayLike<number>) {
  // stable softmax
  let max = -Infinity;
  for (let i = 0; i < logits.length; i++) max = Math.max(max, logits[i] as number);
  const exps = new Float32Array(logits.length);
  let sum = 0;
  for (let i = 0; i < logits.length; i++) {
    const e = Math.exp((logits[i] as number) - max);
    exps[i] = e;
    sum += e;
  }
  for (let i = 0; i < exps.length; i++) exps[i] = exps[i] / (sum || 1);
  return exps;
}

async function photoToRgbUint8(uri: string, width: number, height: number) {
  // Resize, return base64 JPEG
  const resized = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width, height } }],
    { compress: 1, format: ImageManipulator.SaveFormat.JPEG, base64: true }
  );

  if (!resized.base64) throw new Error('No base64 returned from ImageManipulator');

  // Decode JPEG -> RGBA
  const jpgBytes = Buffer.from(resized.base64, 'base64');
  const decoded = jpeg.decode(jpgBytes, { useTArray: true });

  // Convert RGBA -> RGB
  const rgba = decoded.data; // Uint8Array length = w*h*4
  const rgb = new Uint8Array(width * height * 3);

  let j = 0;
  for (let i = 0; i < rgba.length; i += 4) {
    rgb[j++] = rgba[i]; // R
    rgb[j++] = rgba[i + 1]; // G
    rgb[j++] = rgba[i + 2]; // B
  }

  return rgb;
}

export function TopicEmotionDetector({ onEmotionDetected }: TopicEmotionDetectorProps) {
  const [permission, requestPermission] = useCameraPermissions();
  const [emotion, setEmotion] = useState<EmotionResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [countdown, setCountdown] = useState(DETECTION_INTERVAL / 1000);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const cameraRef = useRef<CameraView>(null);

  // Choose ONE model:
  // - int8 dynamic: usually fastest, input often uint8 (0..255)
  // - fp16: often expects float32 normalized (0..1) depending on conversion
  const modelAsset = useMemo(
    () => isTfliteAvailable ? require('@/assets/model/engagement6_int8_dynamic.tflite') : null,
    []
  );
  
  // Only use TensorFlow model if available
  const tflite = isTfliteAvailable && useTensorflowModel && modelAsset ? useTensorflowModel(modelAsset) : null;
  const model = tflite?.state === 'loaded' ? tflite.model : undefined;

  // ---- tweak these to match your model ----
  const INPUT_W = 224;
  const INPUT_H = 224;

  // If your model expects float input, set this true and it will use Float32 normalized [0..1]
  // If your model expects uint8, set false (default).
  const USE_FLOAT_INPUT = false;

  // If your output looks like logits (not probabilities), set true to compute a softmax confidence.
  // If your output is already probabilities, set false.
  const OUTPUT_IS_LOGITS = true;
  // ----------------------------------------

  // Early return if TFLite is not available
  if (!isTfliteAvailable) {
    return (
      <Card className="mx-4 mb-4 border-yellow-500">
        <View className="p-4">
          <View className="flex-row items-center space-x-2 mb-2">
            <Brain className="h-5 w-5 text-yellow-600" />
            <Text className="font-semibold text-yellow-700">Emotion Detection Unavailable</Text>
          </View>
          <Text className="text-sm text-muted-foreground">
            Emotion detection requires a development build with native modules. This feature is not available in Expo Go.
          </Text>
        </View>
      </Card>
    );
  }

  useEffect(() => {
    if (!permission) requestPermission();
  }, [permission, requestPermission]);

  useEffect(() => {
    if (!permission?.granted) return;

    const interval = setInterval(() => {
      detectEmotion();
      setCountdown(DETECTION_INTERVAL / 1000);
    }, DETECTION_INTERVAL);

    const initialTimeout = setTimeout(() => {
      detectEmotion();
    }, 2000);

    return () => {
      clearInterval(interval);
      clearTimeout(initialTimeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [permission?.granted, model]);

  useEffect(() => {
    if (!permission?.granted) return;

    const timer = setInterval(() => {
      setCountdown((prev) => (prev <= 1 ? DETECTION_INTERVAL / 1000 : prev - 1));
    }, 1000);

    return () => clearInterval(timer);
  }, [permission?.granted]);

  const detectEmotion = async () => {
    if (isProcessing || !cameraRef.current || !permission?.granted) return;

    if (!model) {
      // model still loading
      return;
    }

    setIsProcessing(true);

    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.5,
        // Keep this OFF for speed and memory.
        // (You do not need base64 here; we get it after resizing.)
        base64: false,
        skipProcessing: true,
      });

      if (photo?.uri) setCapturedImage(photo.uri);

      const rgb = await photoToRgbUint8(photo.uri, INPUT_W, INPUT_H);

      // Build input tensor
      // Many image TFLite models accept either:
      // - Uint8Array length H*W*3
      // - Float32Array length H*W*3 (normalized)
      // Some require a batch dimension; fast-tflite generally infers it if model expects it,
      // but if it fails in your case, tell me your Netron input shape and I’ll adjust.
      const inputTensor: Uint8Array | Float32Array = USE_FLOAT_INPUT
        ? (() => {
            const f = new Float32Array(rgb.length);
            for (let i = 0; i < rgb.length; i++) f[i] = rgb[i] / 255.0;
            return f;
          })()
        : rgb;

      // Run inference
      const outputs = model.runSync([inputTensor]);

      // Assume single output tensor:
      const out0 = outputs[0] as Float32Array | Uint8Array | Int8Array;

      // Convert int outputs to floats if needed
      const scores = out0 instanceof Float32Array ? out0 : Float32Array.from(out0 as any);

      // If logits, compute probabilities
      const probs = OUTPUT_IS_LOGITS ? softmax(scores) : Float32Array.from(scores);

      const { index } = argMax(probs);
      const predicted = EMOTIONS[index] ?? 'unknown';
      const confidence = probs[index] ?? 0;

      const result: EmotionResult = {
        emotion: predicted,
        confidence,
        timestamp: new Date(),
      };

      setEmotion(result);
      onEmotionDetected?.(result.emotion, result.confidence);

      console.log('✅ TFLite Emotion detected:', result);
    } catch (error) {
      console.error('Error detecting emotion:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const getEmotionColor = (emotionName: string): string => {
    const colors: Record<string, string> = {
      engaged: '#4CAF50',
      confused: '#FF9800',
      frustrated: '#F44336',
      drowsy: '#9C27B0',
      wbored: '#2196F3',
      looking_away: '#607D8B',
    };
    return colors[emotionName] || '#999';
  };

  const getEmotionEmoji = (emotionName: string): string => {
    const emojis: Record<string, string> = {
      engaged: '😊',
      confused: '😕',
      frustrated: '😤',
      drowsy: '😴',
      wbored: '😐',
      looking_away: '👀',
    };
    return emojis[emotionName] || '😐';
  };

  const getEmotionLabel = (emotionName: string): string => {
    const labels: Record<string, string> = {
      engaged: 'Engaged',
      confused: 'Confused',
      frustrated: 'Frustrated',
      drowsy: 'Drowsy',
      wbored: 'Bored',
      looking_away: 'Distracted',
    };
    return labels[emotionName] || emotionName;
  };

  if (!permission) return null;

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
        <CameraView style={{ width: 1, height: 1 }} facing="front" ref={cameraRef} />
      </View>

      <Card>
        <View className="p-4">
          <View className="flex-row items-center justify-between mb-3">
            <View className="flex-row items-center gap-2">
              <Brain size={18} className="text-purple-600 dark:text-purple-400" />
              <Text className="text-sm font-semibold">Learning Engagement</Text>
            </View>

            <View className="flex-row items-center gap-2 bg-secondary px-3 py-1.5 rounded-full">
              <Camera size={14} className="text-foreground" />
              <Text className="text-xs font-medium">
                {tflite.state !== 'loaded' ? 'Loading model…' : `Next: ${countdown}s`}
              </Text>
            </View>
          </View>

          {emotion && (
            <Animated.View entering={FadeIn.duration(300)} className="flex-row items-center gap-3">
              {capturedImage && (
                <View className="relative">
                  <Image source={{ uri: capturedImage }} style={styles.thumbnail} className="rounded-lg" />
                  {isProcessing && (
                    <View style={styles.thumbnailOverlay}>
                      <ActivityIndicator size="small" color="#fff" />
                    </View>
                  )}
                </View>
              )}

              <View className="flex-1">
                <View className="flex-row items-center gap-2 mb-1">
                  <Text style={{ fontSize: 24 }}>{getEmotionEmoji(emotion.emotion)}</Text>
                  <Text className="text-base font-bold" style={{ color: getEmotionColor(emotion.emotion) }}>
                    {getEmotionLabel(emotion.emotion)}
                  </Text>
                </View>

                <View className="flex-row items-center gap-2">
                  <View className="h-2 flex-1 rounded-full bg-secondary overflow-hidden" style={{ maxWidth: 120 }}>
                    <View
                      className="h-full rounded-full"
                      style={{
                        width: `${emotion.confidence * 100}%`,
                        backgroundColor: getEmotionColor(emotion.emotion),
                      }}
                    />
                  </View>
                  <Text className="text-xs text-muted-foreground">{(emotion.confidence * 100).toFixed(0)}%</Text>
                </View>
              </View>
            </Animated.View>
          )}

          {!emotion && (
            <View className="flex-row items-center gap-3 py-2">
              {isProcessing ? (
                <>
                  <ActivityIndicator size="small" />
                  <Text className="text-sm text-muted-foreground">Analyzing your engagement…</Text>
                </>
              ) : (
                <>
                  <Camera size={16} className="text-muted-foreground" />
                  <Text className="text-sm text-muted-foreground">
                    {tflite.state !== 'loaded' ? 'Loading ML model…' : 'Detecting your learning engagement…'}
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
