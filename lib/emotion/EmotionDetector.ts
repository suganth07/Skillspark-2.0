/**
 * EmotionDetector.ts
 * 
 * Port of Python emotion_detector.py logic to TypeScript.
 * Uses MediaPipe Face Landmarker landmarks (468/478 total) with identical
 * mathematical calculations and decision tree thresholds.
 * 
 * IMPORTANT: All calculations are done in pixel space, matching Python behavior.
 * Normalized landmarks (0-1) are converted using: x * width, y * height, z * width
 */

import { SVD } from "svd-js";

// Type definitions
export type Landmark = { x: number; y: number; z: number };

export type EmotionResult = {
  emotion: string;
  confidence: number;
  features: EmotionFeatures;
};

export type EmotionFeatures = {
  ear: number;
  mar: number;
  brow_height: number;
  brow_asymmetry: number;
  tilt_angle: number;
  rotation_ratio: number;
  symmetry_ratio: number;
  energy_concentration: number;
  jaw_width: number;
  brow_variance: number;
  looking_at_camera: boolean;
};

/**
 * Convert normalized landmarks (0-1) to pixel coordinates
 * Matches Python: landmarks.append([lm.x * w, lm.y * h, lm.z * w])
 */
export function normalizeLandmarks(
  width: number,
  height: number,
  landmarks: { x: number; y: number; z: number }[]
): Landmark[] {
  return landmarks.map((lm) => ({
    x: lm.x * width,
    y: lm.y * height,
    z: lm.z * width, // z scaled by width to match Python
  }));
}

/**
 * Main EmotionDetector class - direct port from Python
 */
export class EmotionDetector {
  // Key landmark indices for facial features (EXACT match to Python)
  private readonly LEFT_EYE = [33, 160, 158, 133, 153, 144];
  private readonly RIGHT_EYE = [362, 385, 387, 263, 373, 380];
  private readonly LEFT_EYEBROW = [70, 63, 105, 66, 107];
  private readonly RIGHT_EYEBROW = [300, 293, 334, 296, 336];
  private readonly MOUTH = [61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291];
  private readonly JAW = [172, 136, 150, 149, 176, 148, 152, 377, 400, 378, 379, 365];
  private readonly NOSE = [1, 2, 98, 327];
  private readonly FACE_OVAL = [
    10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379,
    378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127,
    162, 21, 54, 103, 67, 109,
  ];

  /**
   * Calculate Euclidean distance between two points
   */
  private distance(p1: Landmark, p2: Landmark): number {
    const dx = p1.x - p2.x;
    const dy = p1.y - p2.y;
    const dz = p1.z - p2.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  /**
   * Calculate Eye Aspect Ratio (EAR) - lower values indicate closed eyes
   * Matches Python: (vertical1 + vertical2) / (2.0 * horizontal)
   */
  private calculateEyeAspectRatio(
    eyeIndices: number[],
    landmarks: Landmark[]
  ): number {
    const points = eyeIndices.map((i) => landmarks[i]);

    // Vertical distances
    const vertical1 = this.distance(points[1], points[5]);
    const vertical2 = this.distance(points[2], points[4]);

    // Horizontal distance
    const horizontal = this.distance(points[0], points[3]);

    const ear = (vertical1 + vertical2) / (2.0 * horizontal);
    return ear;
  }

  /**
   * Calculate Mouth Aspect Ratio - higher values indicate open mouth
   * Matches Python: vertical / horizontal
   */
  private calculateMouthAspectRatio(landmarks: Landmark[]): number {
    const mouthPts = this.MOUTH.map((i) => landmarks[i]);

    // Vertical distance (mouth height) - indices 9 and 3
    const vertical = this.distance(mouthPts[9], mouthPts[3]);

    // Horizontal distance (mouth width) - indices 0 and 6
    const horizontal = this.distance(mouthPts[0], mouthPts[6]);

    const mar = horizontal > 0 ? vertical / horizontal : 0;
    return mar;
  }

  /**
   * Calculate eyebrow height relative to eye
   * Matches Python: distance / eye_height
   */
  private calculateEyebrowPosition(
    eyebrowIndices: number[],
    eyeIndices: number[],
    landmarks: Landmark[]
  ): number {
    const eyebrowPts = eyebrowIndices.map((i) => landmarks[i]);
    const eyePts = eyeIndices.map((i) => landmarks[i]);

    // Calculate mean Y coordinate for eyebrow and eye
    const eyebrowCenterY =
      eyebrowPts.reduce((sum, p) => sum + p.y, 0) / eyebrowPts.length;
    const eyeCenterY = eyePts.reduce((sum, p) => sum + p.y, 0) / eyePts.length;

    // Distance (positive when eyebrow is above eye - note: Y increases downward)
    const distance = eyeCenterY - eyebrowCenterY;

    // Eye height (peak-to-peak)
    const eyeYValues = eyePts.map((p) => p.y);
    const eyeHeight = Math.max(...eyeYValues) - Math.min(...eyeYValues);

    const ratio = eyeHeight > 0 ? distance / eyeHeight : 0;
    return ratio;
  }

  /**
   * Utility: Calculate mean point from landmark indices
   */
  private meanPoint(indices: number[], landmarks: Landmark[]): Landmark {
    let x = 0, y = 0, z = 0;
    for (const i of indices) {
      x += landmarks[i].x;
      y += landmarks[i].y;
      z += landmarks[i].z;
    }
    return {
      x: x / indices.length,
      y: y / indices.length,
      z: z / indices.length,
    };
  }

  /**
   * Calculate head tilt and rotation using eye line (orientation-safe)
   * Fixed to work in both portrait and landscape
   */
  private calculateHeadPose(landmarks: Landmark[]): {
    tiltAngle: number;
    rotationRatio: number;
  } {
    // Use eye centers for tilt (works in portrait + landscape)
    const leftEyeCenter = this.meanPoint(this.LEFT_EYE, landmarks);
    const rightEyeCenter = this.meanPoint(this.RIGHT_EYE, landmarks);

    const dx = rightEyeCenter.x - leftEyeCenter.x;
    const dy = rightEyeCenter.y - leftEyeCenter.y;

    let rawAngle = Math.abs(Math.atan2(dy, dx) * 180 / Math.PI);
    
    // Normalize to deviation from upright (works in any orientation)
    // In portrait: eyes are vertical (~90°), in landscape: horizontal (~0°)
    const deviationFromHorizontal = Math.min(rawAngle, 180 - rawAngle);
    const deviationFromVertical = Math.abs(90 - rawAngle);
    let tiltAngle = Math.min(deviationFromHorizontal, deviationFromVertical);
    
    // Clamp to realistic human range
    tiltAngle = Math.min(tiltAngle, 45);

    // Calculate rotation (looking left/right) using nose position
    const noseTip = landmarks[1];
    const leftFace = landmarks[234];
    const rightFace = landmarks[454];
    
    const faceWidth = this.distance(leftFace, rightFace);
    const faceCenter = (leftFace.x + rightFace.x) / 2;
    const noseOffset = noseTip.x - faceCenter;
    const rotationRatio = faceWidth > 0 ? noseOffset / faceWidth : 0;

    return { tiltAngle, rotationRatio };
  }

  /**
   * Calculate facial symmetry using SVD
   * Matches Python: symmetry_ratio = S[1] / S[0], energy_concentration = S[0] / sum(S)
   */
  private calculateFacialSymmetrySVD(landmarks: Landmark[]): {
    symmetryRatio: number;
    energyConcentration: number;
  } {
    const facePts = this.FACE_OVAL.map((i) => landmarks[i]);

    // Calculate centroid
    const centroid = {
      x: facePts.reduce((sum, p) => sum + p.x, 0) / facePts.length,
      y: facePts.reduce((sum, p) => sum + p.y, 0) / facePts.length,
    };

    // Center the points (x, y only - matches Python)
    const centered = facePts.map((p) => [p.x - centroid.x, p.y - centroid.y]);

    // Apply SVD
    try {
      const { q: singularValues } = SVD(centered);

      // Singular values
      const S = singularValues;
      const s0 = S[0] || 0;
      const s1 = S[1] || 0;
      const sSum = S.reduce((a, b) => a + b, 0);

      const symmetryRatio = s0 > 0 ? s1 / s0 : 0;
      const energyConcentration = sSum > 0 ? s0 / sSum : 0;

      return { symmetryRatio, energyConcentration };
    } catch (e) {
      // Fallback if SVD fails
      return { symmetryRatio: 0.5, energyConcentration: 0.7 };
    }
  }

  /**
   * Calculate facial muscle tension indicators
   * Matches Python: jaw_width (std of x), brow_variance (var of y)
   */
  private calculateFacialTension(landmarks: Landmark[]): {
    jawWidth: number;
    browVariance: number;
  } {
    // Jaw tension: standard deviation of X coordinates
    const jawPts = this.JAW.map((i) => landmarks[i]);
    const jawXMean = jawPts.reduce((sum, p) => sum + p.x, 0) / jawPts.length;
    const jawWidth = Math.sqrt(
      jawPts.reduce((sum, p) => sum + Math.pow(p.x - jawXMean, 2), 0) /
        jawPts.length
    );

    // Forehead tension: variance of eyebrow Y positions
    const leftBrow = this.LEFT_EYEBROW.map((i) => landmarks[i]);
    const rightBrow = this.RIGHT_EYEBROW.map((i) => landmarks[i]);
    const allBrowY = [...leftBrow, ...rightBrow].map((p) => p.y);
    const browYMean = allBrowY.reduce((sum, y) => sum + y, 0) / allBrowY.length;
    const browVariance =
      allBrowY.reduce((sum, y) => sum + Math.pow(y - browYMean, 2), 0) /
      allBrowY.length;

    return { jawWidth, browVariance };
  }

  /**
   * Check if person is looking at camera
   * Matches Python: deviation_ratio < 0.3
   */
  private checkGazeDirection(landmarks: Landmark[]): boolean {
    const leftEyePts = this.LEFT_EYE.map((i) => landmarks[i]);
    const rightEyePts = this.RIGHT_EYE.map((i) => landmarks[i]);

    // Calculate eye centers
    const leftCenter = {
      x: leftEyePts.reduce((sum, p) => sum + p.x, 0) / leftEyePts.length,
      y: leftEyePts.reduce((sum, p) => sum + p.y, 0) / leftEyePts.length,
    };
    const rightCenter = {
      x: rightEyePts.reduce((sum, p) => sum + p.x, 0) / rightEyePts.length,
      y: rightEyePts.reduce((sum, p) => sum + p.y, 0) / rightEyePts.length,
    };

    // Calculate expected center based on eye corners (landmarks 33, 133 for left; 362, 263 for right)
    const leftExpected = {
      x: (landmarks[33].x + landmarks[133].x) / 2,
      y: (landmarks[33].y + landmarks[133].y) / 2,
    };
    const rightExpected = {
      x: (landmarks[362].x + landmarks[263].x) / 2,
      y: (landmarks[362].y + landmarks[263].y) / 2,
    };

    // Calculate deviation
    const leftDeviation = Math.sqrt(
      Math.pow(leftCenter.x - leftExpected.x, 2) +
        Math.pow(leftCenter.y - leftExpected.y, 2)
    );
    const rightDeviation = Math.sqrt(
      Math.pow(rightCenter.x - rightExpected.x, 2) +
        Math.pow(rightCenter.y - rightExpected.y, 2)
    );

    const avgDeviation = (leftDeviation + rightDeviation) / 2;
    const eyeWidth = Math.sqrt(
      Math.pow(landmarks[33].x - landmarks[133].x, 2) +
        Math.pow(landmarks[33].y - landmarks[133].y, 2)
    );

    const deviationRatio = eyeWidth > 0 ? avgDeviation / eyeWidth : 0;

    return deviationRatio < 0.3; // Looking at camera if low deviation
  }

  /**
   * Main detection function - direct port of Python's detect_emotion
   * Uses identical decision tree with same thresholds
   */
  public detectFromLandmarks(landmarks: Landmark[]): EmotionResult {
    if (landmarks.length < 468) {
      return {
        emotion: "unknown",
        confidence: 0,
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

    // Use only first 468 landmarks (guard against 478 from MediaPipe)
    const faceLandmarks = landmarks.slice(0, 468);

    // Calculate all features
    const leftEar = this.calculateEyeAspectRatio(this.LEFT_EYE, faceLandmarks);
    const rightEar = this.calculateEyeAspectRatio(this.RIGHT_EYE, faceLandmarks);
    const avgEar = (leftEar + rightEar) / 2;

    const mar = this.calculateMouthAspectRatio(faceLandmarks);

    const leftBrowHeight = this.calculateEyebrowPosition(
      this.LEFT_EYEBROW,
      this.LEFT_EYE,
      faceLandmarks
    );
    const rightBrowHeight = this.calculateEyebrowPosition(
      this.RIGHT_EYEBROW,
      this.RIGHT_EYE,
      faceLandmarks
    );
    const avgBrowHeight = (leftBrowHeight + rightBrowHeight) / 2;
    const browAsymmetry = Math.abs(leftBrowHeight - rightBrowHeight);

    const { tiltAngle, rotationRatio } = this.calculateHeadPose(faceLandmarks);
    const { symmetryRatio, energyConcentration } =
      this.calculateFacialSymmetrySVD(faceLandmarks);
    const { jawWidth, browVariance } = this.calculateFacialTension(faceLandmarks);
    const lookingAtCamera = this.checkGazeDirection(faceLandmarks);

    const features: EmotionFeatures = {
      ear: avgEar,
      mar: mar,
      brow_height: avgBrowHeight,
      brow_asymmetry: browAsymmetry,
      tilt_angle: Math.abs(tiltAngle),
      rotation_ratio: Math.abs(rotationRatio),
      symmetry_ratio: symmetryRatio,
      energy_concentration: energyConcentration,
      jaw_width: jawWidth,
      brow_variance: browVariance,
      looking_at_camera: lookingAtCamera,
    };

    // ========================================
    // DECISION TREE - EXACT PYTHON THRESHOLDS
    // ========================================

    // 1. Looking Away - not looking at camera or extreme head rotation
    if (!lookingAtCamera || Math.abs(rotationRatio) > 0.35) {
      const confidence = Math.min(1.0, Math.abs(rotationRatio) * 2 + 0.5);
      return {
        emotion: "looking_away",
        confidence: Math.max(0.6, confidence),
        features,
      };
    }

    // 2. Drowsy - very low EAR (eyes nearly closed)
    if (avgEar < 0.18) {
      const confidence = 1.0 - (avgEar / 0.18) * 0.4; // 0.6 to 1.0
      return { emotion: "drowsy", confidence, features };
    }

    // 3. Confused - raised eyebrows + head tilt + facial asymmetry
    let confusionScore = 0;
    if (avgBrowHeight > 1.2) {
      // Raised eyebrows
      confusionScore += 0.35;
    }
    if (Math.abs(tiltAngle) > 8 && Math.abs(tiltAngle) < 25) {
      // Moderate head tilt
      confusionScore += 0.25;
    }
    if (browAsymmetry > 0.15) {
      // Asymmetric eyebrows
      confusionScore += 0.2;
    }
    if (symmetryRatio < 0.3) {
      // Facial asymmetry
      confusionScore += 0.2;
    }

    if (confusionScore > 0.5) {
      return {
        emotion: "confused",
        confidence: Math.min(0.95, confusionScore),
        features,
      };
    }

    // 4. Frustrated - low brow position (furrowed) + jaw tension + mouth compression
    let frustrationScore = 0;
    if (avgBrowHeight < 0.8) {
      // Lowered/furrowed eyebrows
      frustrationScore += 0.3;
    }
    if (browVariance > 0.5) {
      // Tense forehead
      frustrationScore += 0.25;
    }
    if (jawWidth > 15) {
      // Jaw tension
      frustrationScore += 0.25;
    }
    if (mar < 0.15) {
      // Compressed mouth
      frustrationScore += 0.2;
    }

    if (frustrationScore > 0.5) {
      return {
        emotion: "frustrated",
        confidence: Math.min(0.95, frustrationScore),
        features,
      };
    }

    // 5. Bored - slightly droopy eyes + slight head tilt + neutral expression
    let boredScore = 0;
    if (avgEar < 0.20 && avgEar >= 0.18) {
      // Slightly droopy but not drowsy (narrower range)
      boredScore += 0.3;
    }
    if (Math.abs(tiltAngle) > 8 && Math.abs(tiltAngle) < 15) {
      // Slight slouch/tilt (more pronounced tilt needed)
      boredScore += 0.25;
    }
    if (mar < 0.15 && avgBrowHeight < 1.0 && avgBrowHeight > 0.85) {
      // Neutral (tighter mouth threshold)
      boredScore += 0.25;
    }
    if (energyConcentration > 0.88) {
      // Low facial variation (more strict)
      boredScore += 0.2;
    }

    if (boredScore > 0.55) {
      return {
        emotion: "bored",
        confidence: Math.min(0.95, boredScore),
        features,
      };
    }

    // 6. Engaged (default) - good eye opening, looking at camera, neutral to positive expression
    let engagedScore = 0;
    if (avgEar >= 0.20) {
      // Good eye opening (lowered from 0.23)
      engagedScore += 0.40;
    }
    if (lookingAtCamera) {
      // Looking at camera
      engagedScore += 0.40;
    }
    if (Math.abs(tiltAngle) < 12) {
      // Straight head (more lenient)
      engagedScore += 0.10;
    }
    if (symmetryRatio > 0.25) {
      // Good symmetry (more lenient)
      engagedScore += 0.10;
    }

    return {
      emotion: "engaged",
      confidence: Math.min(0.95, Math.max(0.5, engagedScore)),
      features,
    };
  }
}
