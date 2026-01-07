# FaceLandmarks Native Module

Native Expo module providing MediaPipe Face Landmarker functionality for emotion detection.

## Requirements

- Expo SDK 54+
- Expo Dev Client (NOT Expo Go)
- iOS 15.0+
- Android SDK 24+

## Setup

### 1. Download the MediaPipe Face Landmarker Model

Download `face_landmarker.task` from the MediaPipe model hub:

```bash
# Download the model
curl -L "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task" -o face_landmarker.task
```

### 2. Add Model to App Assets

**Android:**
```bash
# Copy to Android assets folder
mkdir -p android/app/src/main/assets
cp face_landmarker.task android/app/src/main/assets/
```

**iOS:**
- Add `face_landmarker.task` to your Xcode project
- Ensure it's included in the "Copy Bundle Resources" build phase

### 3. Install Dependencies

```bash
bun install svd-js
```

### 4. Build the App

This module requires a development build - it does NOT work with Expo Go.

```bash
# Clean previous build
npx expo prebuild --clean

# Run on Android
npx expo run:android

# Run on iOS
npx expo run:ios
```

## Usage

```typescript
import { FaceLandmarks } from '@/modules/face-landmarks/src';
import { EmotionDetector, normalizeLandmarks } from '@/lib/emotion/EmotionDetector';

const detector = new EmotionDetector();

async function detectEmotion(imageUri: string) {
  // Get landmarks from native module
  const result = await FaceLandmarks.detectFromImageAsync(imageUri);
  
  if (result.landmarks.length === 0) {
    return { emotion: 'unknown', confidence: 0 };
  }
  
  // Convert normalized landmarks to pixel coordinates
  const pixelLandmarks = normalizeLandmarks(
    result.width,
    result.height,
    result.landmarks
  );
  
  // Run emotion detection
  return detector.detectFromLandmarks(pixelLandmarks);
}
```

## API

### `FaceLandmarks.detectFromImageAsync(uri: string)`

Detects face landmarks from an image.

**Parameters:**
- `uri`: Image URI (file://, content://, or local path)

**Returns:**
```typescript
{
  width: number;          // Image width in pixels
  height: number;         // Image height in pixels
  landmarks: Array<{      // 478 landmarks (468 face mesh + 10 iris)
    x: number;           // Normalized X (0-1)
    y: number;           // Normalized Y (0-1)
    z: number;           // Normalized Z
  }>;
}
```

## Emotions Detected

| Emotion | Description |
|---------|-------------|
| `engaged` | Attentive, eyes open, looking at camera |
| `drowsy` | Eyes nearly closed |
| `confused` | Raised eyebrows, tilted head |
| `frustrated` | Furrowed brow, tense jaw |
| `bored` | Droopy eyes, slight head tilt |
| `looking_away` | Not looking at camera |
| `unknown` | No face detected |

## Troubleshooting

### "FaceLandmarks native module not available"
- You're running in Expo Go. Build a dev client instead.

### "Could not find face_landmarker.task"
- Ensure the model file is in the correct assets folder
- For Android: `android/app/src/main/assets/face_landmarker.task`
- For iOS: Added to Xcode project bundle resources

### "Module not found" errors
- Run `npx expo prebuild --clean` to regenerate native code
- Reinstall dependencies with `bun install`
