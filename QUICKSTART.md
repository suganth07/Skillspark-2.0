# 🚀 Quick Start Guide - Emotion Detection

## ⚡ Fastest Path to Testing

### 1. One-Command Setup
```bash
# This does everything: downloads model, sets up Android, copies files
bash setup-emotion-detection.sh
```

### 2. Build and Run
```bash
# Build the Android app (first time: ~5-10 minutes)
bun run android

# Or with dev client
bun expo start --dev-client
```

### 3. Test in Your App

**Option A: Use the Example Component (Easiest)**
```tsx
// In any screen file
import { EmotionDetectionExample } from '@/components/emotion/EmotionDetectionExample';

export default function TestScreen() {
  return <EmotionDetectionExample />;
}
```

**Option B: Existing Topic Detector**
```tsx
// Already integrated in your app
import { TopicEmotionDetector } from '@/components/emotion/TopicEmotionDetector';

export default function LearningScreen() {
  return (
    <TopicEmotionDetector 
      onEmotionDetected={(emotion, confidence) => {
        console.log('Detected:', emotion, confidence);
      }}
    />
  );
}
```

**Option C: Direct API Call**
```tsx
import { detectEmotionFromImageUri } from '@/lib/emotion/detectEmotion';
import { CameraView } from 'expo-camera';

const photo = await cameraRef.current.takePictureAsync();
const result = await detectEmotionFromImageUri(photo.uri);

console.log(result.emotion);      // "engaged", "drowsy", etc.
console.log(result.confidence);   // 0.0 to 1.0
console.log(result.features);     // All computed features
```

---

## 🎯 Expected Results

### First Detection
- **Time:** ~200-300ms (MediaPipe initialization)
- **Output:**
  ```json
  {
    "emotion": "engaged",
    "confidence": 0.87,
    "features": {
      "ear": 0.265,
      "mar": 0.142,
      "brow_height": 1.03,
      "brow_asymmetry": 0.08,
      "tilt_angle": 4.2,
      "rotation_ratio": 0.12,
      "symmetry_ratio": 0.42,
      "energy_concentration": 0.76,
      "jaw_width": 12.4,
      "brow_variance": 0.34,
      "looking_at_camera": true
    }
  }
  ```

### Subsequent Detections
- **Time:** ~50-150ms
- **Same format** as above

---

## 🧪 Testing Checklist

1. **Portrait mode** ✅
   - Hold phone vertically
   - Take selfie
   - Should detect emotion correctly

2. **Landscape mode** ✅
   - Rotate phone horizontally
   - Take selfie
   - Should detect **same emotion** as portrait

3. **Different emotions**
   - 😊 Engaged: Eyes open, looking at camera
   - 😴 Drowsy: Close eyes partially
   - 😕 Confused: Raise eyebrows, tilt head
   - 😤 Frustrated: Furrow brows, tense jaw
   - 😐 Bored: Slight eye droop, neutral face
   - 👀 Looking away: Turn head away from camera

4. **Edge cases**
   - No face: Camera pointing away → "no_face"
   - Multiple faces: Only detects first face
   - Poor lighting: May affect accuracy

---

## 🔧 Troubleshooting

### Problem: "Cannot find module FaceLandmarks"
**Solution:**
```bash
bun expo prebuild --clean
bun run android
```

### Problem: "Could not find face_landmarker.task"
**Solution:**
```bash
bash setup-emotion-detection.sh
# Or manually:
cp face_landmarker.task android/app/src/main/assets/
```

### Problem: "Same emotion detected regardless of expression"
**Check:**
1. Verify landmarks count: `result.landmarks.length === 468`
2. Check if looking at camera: `result.features.looking_at_camera`
3. View feature values: `console.log(result.features)`

### Problem: Build fails with Gradle error
**Solution:**
```bash
cd android
./gradlew clean
cd ..
bun run android
```

---

## 📊 Performance Tips

### Good Performance
✅ Process every frame → too slow (~30fps impossible)
✅ Process every 3rd frame → reasonable (~10fps detection)
✅ Process on timer (10 seconds) → current implementation
✅ Use quality: 0.8 for faster capture

### Optimize Further
```typescript
// Lower quality for faster processing
const photo = await camera.takePictureAsync({
  quality: 0.6,      // Lower = faster
  skipProcessing: true
});

// Skip detection if processing
if (!isProcessing) {
  detectEmotion();
}

// Debounce rapid calls
const debouncedDetect = debounce(detectEmotion, 500);
```

---

## 📚 Files Reference

### Core Implementation
| File | Purpose |
|------|---------|
| `lib/emotion/EmotionDetector.ts` | Core detection logic (Python port) |
| `lib/emotion/detectEmotion.ts` | High-level API |
| `modules/face-landmarks/android/.../FaceLandmarksModule.kt` | Native Android module |
| `modules/face-landmarks/src/index.ts` | TypeScript wrapper |

### Examples & Testing
| File | Purpose |
|------|---------|
| `components/emotion/EmotionDetectionExample.tsx` | Standalone test component |
| `components/emotion/TopicEmotionDetector.tsx` | Production component |

### Setup & Documentation
| File | Purpose |
|------|---------|
| `setup-emotion-detection.sh` | Automated setup script |
| `EMOTION_DETECTION_SUMMARY.md` | Complete implementation guide |
| `IMPLEMENTATION_REVIEW.md` | Code review & analysis |
| `modules/face-landmarks/ANDROID_SETUP.md` | Android build guide |

---

## 🎓 Understanding the Output

### Emotion Labels
- **engaged** - Attentive, looking at camera, eyes open
- **drowsy** - Eyes closing, low alertness
- **confused** - Eyebrows raised, head tilted, asymmetric
- **frustrated** - Brows furrowed, jaw tense
- **bored** - Slight eye droop, neutral expression
- **looking_away** - Not facing camera
- **no_face** - No face detected in image
- **unknown** - Processing error

### Confidence Score
- `0.9 - 1.0` - Very confident
- `0.7 - 0.9` - Confident
- `0.5 - 0.7` - Moderate
- `< 0.5` - Low confidence (might be wrong)

### Key Features
- **EAR (Eye Aspect Ratio)** - Lower = more closed eyes
  - Drowsy: < 0.18
  - Bored: 0.18 - 0.20
  - Normal: > 0.20

- **MAR (Mouth Aspect Ratio)** - Higher = more open mouth
  - Closed: < 0.15
  - Normal: 0.15 - 0.25
  - Open: > 0.25

- **Brow Height** - Distance from eye to eyebrow
  - Lowered: < 0.8 (frustrated)
  - Normal: 0.8 - 1.2
  - Raised: > 1.2 (confused/surprised)

- **Rotation Ratio** - Head turn left/right
  - Looking away: > 0.35
  - Normal: < 0.35

---

## ✅ You're Ready!

If you can run:
```bash
bash setup-emotion-detection.sh
bun run android
```

And see the EmotionDetectionExample working, you're all set! 🎉

For production use, integrate `TopicEmotionDetector` into your learning screens.

---

**Need Help?**
- Check: [EMOTION_DETECTION_SUMMARY.md](EMOTION_DETECTION_SUMMARY.md)
- Review: [IMPLEMENTATION_REVIEW.md](IMPLEMENTATION_REVIEW.md)
- Android: [modules/face-landmarks/ANDROID_SETUP.md](modules/face-landmarks/ANDROID_SETUP.md)
