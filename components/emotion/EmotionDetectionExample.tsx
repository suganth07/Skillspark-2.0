import React, { useRef, useState } from "react";
import { Button, Text, View, StyleSheet, ActivityIndicator } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { detectEmotionFromImageUri } from "@/lib/emotion/detectEmotion";
import type { EmotionResult } from "@/lib/emotion/EmotionDetector";

/**
 * Example component demonstrating emotion detection from camera photos
 * 
 * Usage:
 *   import { EmotionDetectionExample } from '@/components/emotion/EmotionDetectionExample';
 *   <EmotionDetectionExample />
 */
export function EmotionDetectionExample() {
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [status, setStatus] = useState<string>("Tap 'Detect Emotion' to start");
  const [result, setResult] = useState<EmotionResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  if (!permission) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.text}>Camera permission required</Text>
        <Button title="Grant Permission" onPress={requestPermission} />
      </View>
    );
  }

  const handleDetectEmotion = async () => {
    try {
      setIsProcessing(true);
      setStatus("📸 Capturing photo...");

      // Take photo
      const photo = await cameraRef.current?.takePictureAsync({
        quality: 0.8,
        skipProcessing: true, // Faster capture
      });

      if (!photo?.uri) {
        setStatus("❌ Failed to capture photo");
        return;
      }

      setStatus("🔍 Detecting emotion...");

      // Detect emotion
      const startTime = Date.now();
      const emotionResult = await detectEmotionFromImageUri(photo.uri);
      const duration = Date.now() - startTime;

      setResult(emotionResult);

      // Format status message
      const emoji = getEmotionEmoji(emotionResult.emotion);
      const confidence = (emotionResult.confidence * 100).toFixed(1);
      setStatus(
        `${emoji} ${emotionResult.emotion.toUpperCase()}\n` +
        `Confidence: ${confidence}%\n` +
        `Processing time: ${duration}ms`
      );
    } catch (error) {
      console.error("Emotion detection error:", error);
      setStatus(`❌ Error: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <View style={styles.container}>
      <CameraView
        ref={cameraRef}
        style={styles.camera}
        facing="front"
        mode="picture"
      />

      <View style={styles.controls}>
        <Button
          title={isProcessing ? "Processing..." : "Detect Emotion"}
          onPress={handleDetectEmotion}
          disabled={isProcessing}
        />

        <Text style={styles.statusText}>{status}</Text>

        {result && (
          <View style={styles.details}>
            <Text style={styles.detailsTitle}>Features:</Text>
            <Text style={styles.detailsText}>
              EAR (eye): {result.features.ear.toFixed(3)}{"\n"}
              MAR (mouth): {result.features.mar.toFixed(3)}{"\n"}
              Brow height: {result.features.brow_height.toFixed(3)}{"\n"}
              Head tilt: {result.features.tilt_angle.toFixed(1)}°{"\n"}
              Rotation: {result.features.rotation_ratio.toFixed(3)}{"\n"}
              Looking at camera: {result.features.looking_at_camera ? "✅" : "❌"}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

function getEmotionEmoji(emotion: string): string {
  const emojiMap: Record<string, string> = {
    engaged: "😊",
    drowsy: "😴",
    confused: "😕",
    frustrated: "😤",
    bored: "😐",
    looking_away: "👀",
    no_face: "❓",
    unknown: "🤷",
    error: "❌",
  };
  return emojiMap[emotion] || "🙂";
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  camera: {
    flex: 1,
  },
  controls: {
    padding: 20,
    backgroundColor: "#fff",
    gap: 12,
  },
  text: {
    fontSize: 16,
    textAlign: "center",
    marginBottom: 12,
  },
  statusText: {
    fontSize: 18,
    fontWeight: "600",
    textAlign: "center",
    marginTop: 12,
    lineHeight: 24,
  },
  details: {
    marginTop: 16,
    padding: 12,
    backgroundColor: "#f5f5f5",
    borderRadius: 8,
  },
  detailsTitle: {
    fontSize: 14,
    fontWeight: "bold",
    marginBottom: 8,
  },
  detailsText: {
    fontSize: 12,
    fontFamily: "monospace",
    lineHeight: 18,
  },
});
