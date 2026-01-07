import { FaceLandmarks } from "@/modules/face-landmarks/src";
import { EmotionDetector, normalizeLandmarks, type EmotionResult } from "./EmotionDetector";

const detector = new EmotionDetector();

/**
 * Detect emotion from an image URI using MediaPipe Face Landmarker + rule-based classifier
 * 
 * @param uri - Image URI (file://, content://, or asset URI)
 * @returns EmotionResult with emotion label, confidence, and all computed features
 */
export async function detectEmotionFromImageUri(uri: string): Promise<EmotionResult> {
  try {
    // Call native module to get face landmarks
    const { width, height, landmarks } = await FaceLandmarks.detectFromImageAsync(uri);

    // Check if face was detected
    if (!landmarks || landmarks.length === 0) {
      return {
        emotion: "no_face",
        confidence: 0.0,
        features: {
          ear: 0,
          mar: 0,
          brow_height: 0,
          brow_asymmetry: 0,
          tilt_angle: 0,
          rotation_ratio: 0,
          symmetry_ratio: 0,
          energy_concentration: 0,
          jaw_width: 0,
          brow_variance: 0,
          looking_at_camera: false,
        },
      };
    }

    // Verify we have 468 landmarks (MediaPipe returns 478 but we only use first 468)
    if (landmarks.length < 468) {
      return {
        emotion: "unknown",
        confidence: 0.0,
        features: {
          ear: 0,
          mar: 0,
          brow_height: 0,
          brow_asymmetry: 0,
          tilt_angle: 0,
          rotation_ratio: 0,
          symmetry_ratio: 0,
          energy_concentration: 0,
          jaw_width: 0,
          brow_variance: 0,
          looking_at_camera: false,
        },
      };
    }

    // Convert normalized landmarks (0-1) to pixel coordinates
    const pixelLandmarks = normalizeLandmarks(width, height, landmarks);

    // Run emotion detection
    return detector.detectFromLandmarks(pixelLandmarks);
  } catch (error) {
    console.error("❌ Emotion detection failed:", error);
    return {
      emotion: "error",
      confidence: 0.0,
      features: {
        ear: 0,
        mar: 0,
        brow_height: 0,
        brow_asymmetry: 0,
        tilt_angle: 0,
        rotation_ratio: 0,
        symmetry_ratio: 0,
        energy_concentration: 0,
        jaw_width: 0,
        brow_variance: 0,
        looking_at_camera: false,
      },
    };
  }
}
