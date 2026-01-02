
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

// Test image - original size, will be resized by our bilinear function
const TEST_IMAGE = require('@/assets/images/test_image.jpeg');

/**
 * Bilinear resize to match Python PIL's Image.resize() behavior
 * This ensures pixel values match between RN and Python
 */
function bilinearResize(
  srcData: Uint8Array,
  srcWidth: number,
  srcHeight: number,
  dstWidth: number,
  dstHeight: number,
  channels: number = 3
): Uint8Array {
  const dst = new Uint8Array(dstWidth * dstHeight * channels);
  
  const xRatio = srcWidth / dstWidth;
  const yRatio = srcHeight / dstHeight;
  
  for (let dstY = 0; dstY < dstHeight; dstY++) {
    for (let dstX = 0; dstX < dstWidth; dstX++) {
      // Map destination pixel to source coordinates
      const srcX = dstX * xRatio;
      const srcY = dstY * yRatio;
      
      // Get the four surrounding pixels
      const x0 = Math.floor(srcX);
      const y0 = Math.floor(srcY);
      const x1 = Math.min(x0 + 1, srcWidth - 1);
      const y1 = Math.min(y0 + 1, srcHeight - 1);
      
      // Calculate interpolation weights
      const xWeight = srcX - x0;
      const yWeight = srcY - y0;
      
      // For each channel
      for (let c = 0; c < channels; c++) {
        // Get the four pixel values
        const p00 = srcData[(y0 * srcWidth + x0) * channels + c];
        const p10 = srcData[(y0 * srcWidth + x1) * channels + c];
        const p01 = srcData[(y1 * srcWidth + x0) * channels + c];
        const p11 = srcData[(y1 * srcWidth + x1) * channels + c];
        
        // Bilinear interpolation
        const top = p00 * (1 - xWeight) + p10 * xWeight;
        const bottom = p01 * (1 - xWeight) + p11 * xWeight;
        const value = top * (1 - yWeight) + bottom * yWeight;
        
        dst[(dstY * dstWidth + dstX) * channels + c] = Math.round(value);
      }
    }
  }
  
  return dst;
}

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

async function photoToRgbUint8(uri: string, targetWidth: number, targetHeight: number) {
  console.log('📷 Processing image URI:', uri);
  
  // Get full resolution image as base64 (no resize by ImageManipulator)
  const result = await ImageManipulator.manipulateAsync(
    uri,
    [], // No operations - we'll resize ourselves
    { 
      compress: 1, 
      format: ImageManipulator.SaveFormat.JPEG, 
      base64: true,
    }
  );

  console.log('📷 Original image dimensions:', result.width, 'x', result.height);

  if (!result.base64) throw new Error('No base64 returned from ImageManipulator');

  // Decode JPEG -> RGBA
  const jpgBytes = Buffer.from(result.base64, 'base64');
  const decoded = jpeg.decode(jpgBytes, { useTArray: true, formatAsRGBA: true });

  // Convert RGBA -> RGB
  const rgba = decoded.data;
  const srcRgb = new Uint8Array(decoded.width * decoded.height * 3);
  
  let j = 0;
  for (let i = 0; i < rgba.length; i += 4) {
    srcRgb[j++] = rgba[i]; // R
    srcRgb[j++] = rgba[i + 1]; // G
    srcRgb[j++] = rgba[i + 2]; // B
  }

  // Use our bilinear resize to match Python PIL behavior
  const rgb = bilinearResize(srcRgb, decoded.width, decoded.height, targetWidth, targetHeight, 3);
  
  console.log('📷 Resized to:', targetWidth, 'x', targetHeight);

  // Log first few RGB triplets for comparison with Python
  console.log('📷 First 3 pixels (RGB):', 
    `[${rgb[0]}, ${rgb[1]}, ${rgb[2]}]`,
    `[${rgb[3]}, ${rgb[4]}, ${rgb[5]}]`,
    `[${rgb[6]}, ${rgb[7]}, ${rgb[8]}]`
  );

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
    () => isTfliteAvailable ? require('@/assets/model/engagement6_fp16.tflite') : null,
    []
  );
  
  // Only use TensorFlow model if available
  const tflite = isTfliteAvailable && useTensorflowModel && modelAsset ? useTensorflowModel(modelAsset) : null;
  const model = tflite?.state === 'loaded' ? tflite.model : undefined;

  // ---- tweak these to match your model ----
  const INPUT_W = 224;
  const INPUT_H = 224;

  // MobileNetV3 preprocess_input expects [0-255] range, not [0-1]
  const USE_FLOAT_INPUT_0_255 = true;
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
    // Use test image instead of camera
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
  }, [model]);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => (prev <= 1 ? DETECTION_INTERVAL / 1000 : prev - 1));
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const detectEmotion = async () => {
    if (isProcessing) return;

    if (!model) {
      // model still loading
      return;
    }

    setIsProcessing(true);

    try {
      // Use test image instead of camera
      const photo = { uri: Image.resolveAssetSource(TEST_IMAGE).uri };
      setCapturedImage(photo.uri);

      const rgb = await photoToRgbUint8(photo.uri, INPUT_W, INPUT_H);

      // MobileNetV3 preprocess_input expects Float32 with [0-255] range
      // The model will internally convert to [-1, 1]
      const inputTensor = USE_FLOAT_INPUT_0_255
        ? Float32Array.from(rgb)  // Convert uint8 [0-255] to float32 [0-255]
        : rgb;

      // Log input tensor stats
      let min = Infinity, max = -Infinity, sum = 0;
      for (let i = 0; i < inputTensor.length; i++) {
        const val = inputTensor[i];
        if (val < min) min = val;
        if (val > max) max = val;
        sum += val;
      }
      const mean = sum / inputTensor.length;
      console.log('📊 Input tensor stats:', {
        type: inputTensor.constructor.name,
        length: inputTensor.length,
        min,
        max,
        mean: mean.toFixed(3),
        first10: Array.from(inputTensor.slice(0, 10)),
      });

      // Run inference
      const outputs = model.runSync([inputTensor]);
      
      // Model outputs probabilities directly
      const probs = outputs[0] as Float32Array;
      
      // Log all probabilities with labels
      console.log('📊 Model output probabilities:');
      EMOTIONS.forEach((emotion, i) => {
        console.log(`   ${i}: ${emotion} = ${(probs[i] * 100).toFixed(2)}%`);
      });
      
      const { index } = argMax(probs);
      const predicted = EMOTIONS[index] ?? 'unknown';
      const confidence = probs[index] ?? 0;
      
      console.log(`🎯 Winner: index=${index}, emotion=${predicted}, confidence=${(confidence * 100).toFixed(2)}%`);

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

  return (
    <View className="mb-6">

      <Card>
        <View className="p-4">
          <View className="flex-row items-center justify-between mb-3">
            <View className="flex-row items-center gap-2">
              <Brain size={18} className="text-purple-600 dark:text-purple-400" />
              <Text className="text-sm font-semibold">Learning Engagement (Test Mode)</Text>
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
