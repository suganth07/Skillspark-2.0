# Android Build Setup for FaceLandmarks Module

## Required Files

### 1. Module Configuration
- ✅ `expo-module.config.json` - Already configured
- ✅ `android/build.gradle` - Module build configuration
- ✅ `android/src/main/java/expo/modules/facelandmarks/FaceLandmarksModule.kt` - Native implementation

### 2. MediaPipe Model File

The MediaPipe Face Landmarker model must be placed in:
```
android/app/src/main/assets/face_landmarker.task
```

**Download the model:**
```bash
# From project root
curl -L "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task" -o face_landmarker.task

# Copy to Android assets (after running expo prebuild)
mkdir -p android/app/src/main/assets
cp face_landmarker.task android/app/src/main/assets/
```

Or use the provided script:
```bash
bash scripts/download-face-model.sh
```

### 3. Dependencies

The module's `build.gradle` already includes:
```gradle
dependencies {
  implementation "com.google.mediapipe:tasks-vision:0.10.14"
  implementation "androidx.exifinterface:exifinterface:1.3.7"
}
```

**No additional app-level dependencies needed** - the module is self-contained.

## Build Commands

### First-time setup
```bash
# Install JS dependencies
npm install
# or
bun install

# Generate Android/iOS native projects
npx expo prebuild

# Download and place the model file
bash scripts/download-face-model.sh
# or manually:
curl -L "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task" -o face_landmarker.task
mkdir -p android/app/src/main/assets
cp face_landmarker.task android/app/src/main/assets/
```

### Development builds
```bash
# Build and run on Android device/emulator
npx expo run:android

# Or with dev client
npx expo start --dev-client --android
```

## Troubleshooting

### "Could not find face_landmarker.task"
- Ensure the model file is in `android/app/src/main/assets/face_landmarker.task`
- Rebuild the app: `npx expo run:android`

### "MediaPipe dependencies not found"
- The dependencies are declared in the module's `build.gradle`, not the app's
- Make sure you ran `npx expo prebuild` to generate the Android project
- Check that `modules/face-landmarks/android/build.gradle` exists

### Portrait photos show incorrect landmarks
- This is **already fixed** in the Kotlin implementation
- The module reads EXIF orientation and rotates bitmaps upright before processing
- Both portrait and landscape should work identically

### Gradle sync issues
- Clean build: `cd android && ./gradlew clean`
- Invalidate caches in Android Studio: File → Invalidate Caches / Restart

## Implementation Details

### EXIF Orientation Handling
The Android module automatically handles device orientation:

1. Reads EXIF orientation tag from image bytes
2. Rotates bitmap to upright orientation using Matrix transformation
3. Runs MediaPipe on corrected image
4. Returns upright width/height dimensions

This ensures portrait and landscape photos produce consistent results.

### MediaPipe Configuration
```kotlin
FaceLandmarker.FaceLandmarkerOptions.builder()
  .setRunningMode(RunningMode.IMAGE)  // Single image mode
  .setNumFaces(1)                     // Detect one face
  .setMinFaceDetectionConfidence(0.5f)
  .setMinTrackingConfidence(0.5f)
  .build()
```

### Output Format
```typescript
{
  width: number;      // Upright image width
  height: number;     // Upright image height
  landmarks: [        // 468 normalized landmarks (0-1)
    { x: 0.5, y: 0.3, z: 0.01 },
    // ... 467 more
  ]
}
```

## Performance Notes

- First detection initializes MediaPipe (~100-300ms overhead)
- Subsequent detections: ~50-150ms on modern devices
- Bitmap rotation adds ~10-20ms
- EXIF reading adds ~5-10ms

For realtime video, consider:
- Using `RunningMode.LIVE_STREAM` mode
- Processing every 2nd or 3rd frame
- Running detection in background thread
- Implementing temporal smoothing for emotion classification
