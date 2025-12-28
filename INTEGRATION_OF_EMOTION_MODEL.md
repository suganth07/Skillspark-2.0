# Emotion Detection Integration Guide

This guide shows how to integrate the emotion detection feature into any React Native (Bun/Expo) app.

## 📦 Required Files

Copy these files to your project:

1. **Model Files** (copy to `assets/models/`):
   - `engagement6_int8_dynamic.tflite`
   - `labels.txt`

2. **Component** (copy to `components/`):
   - `RealTimeEmotionCamera.tsx`

3. **Service** (optional, for advanced usage):
   - `EmotionDetectionService.ts`

## 📥 Installation

### 1. Install Dependencies

```bash
# Using bun
bun install expo-camera @tensorflow/tfjs @tensorflow/tfjs-react-native expo-file-system

# Or using npm
npm install expo-camera @tensorflow/tfjs @tensorflow/tfjs-react-native expo-file-system
```

### 2. Configure app.json

Add camera permissions to your `app.json`:

```json
{
  "expo": {
    "plugins": [
      [
        "expo-camera",
        {
          "cameraPermission": "Allow $(PRODUCT_NAME) to access your camera for emotion detection."
        }
      ]
    ],
    "ios": {
      "infoPlist": {
        "NSCameraUsageDescription": "This app uses the camera to detect your emotions."
      }
    },
    "android": {
      "permissions": [
        "CAMERA"
      ]
    }
  }
}
```

## 🎯 Quick Integration

### Option 1: As a Standalone Screen

```tsx
// screens/EmotionDetectionScreen.tsx
import React from 'react';
import { View, StyleSheet } from 'react-native';
import RealTimeEmotionCamera from '../components/RealTimeEmotionCamera';

export default function EmotionDetectionScreen() {
  return (
    <View style={styles.container}>
      <RealTimeEmotionCamera />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
});
```

### Option 2: As a Modal/Overlay

```tsx
// In your existing component
import React, { useState } from 'react';
import { Modal, TouchableOpacity, Text } from 'react-native';
import RealTimeEmotionCamera from './components/RealTimeEmotionCamera';

export default function YourExistingComponent() {
  const [showCamera, setShowCamera] = useState(false);

  return (
    <>
      <TouchableOpacity onPress={() => setShowCamera(true)}>
        <Text>Start Emotion Detection</Text>
      </TouchableOpacity>

      <Modal visible={showCamera} animationType="slide">
        <RealTimeEmotionCamera />
        <TouchableOpacity onPress={() => setShowCamera(false)}>
          <Text>Close</Text>
        </TouchableOpacity>
      </Modal>
    </>
  );
}
```

### Option 3: With Custom Callbacks

```tsx
// components/CustomEmotionCamera.tsx
import React from 'react';
import RealTimeEmotionCamera from './RealTimeEmotionCamera';

export default function CustomEmotionCamera() {
  const handleEmotionChange = (emotion: string, confidence: number) => {
    console.log(`Detected: ${emotion} with ${confidence}% confidence`);
    // Send to your backend
    // Update state
    // Trigger actions
  };

  return <RealTimeEmotionCamera onEmotionDetected={handleEmotionChange} />;
}
```

## ⚙️ Customization

### Change Detection Interval

In `RealTimeEmotionCamera.tsx`, line 24:

```typescript
const DETECTION_INTERVAL = 20000; // Change this value (in milliseconds)
```

Examples:
- `5000` = 5 seconds
- `10000` = 10 seconds
- `30000` = 30 seconds
- `60000` = 1 minute

### Customize UI Colors

In `RealTimeEmotionCamera.tsx`, modify the `getEmotionColor` function:

```typescript
const getEmotionColor = (emotionName: string): string => {
  const colors: Record<string, string> = {
    'engaged': '#4CAF50',      // Green
    'confused': '#FF9800',     // Orange
    'frustrated': '#F44336',   // Red
    'drowsy': '#9C27B0',      // Purple
    'wbored': '#2196F3',      // Blue
    'looking_away': '#607D8B' // Grey
  };
  return colors[emotionName] || '#999';
};
```

### Customize Emojis

```typescript
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
```

## 🔧 Advanced Integration

### Send Emotion Data to Backend

```typescript
// services/EmotionAPI.ts
export const sendEmotionData = async (emotion: string, confidence: number) => {
  try {
    const response = await fetch('https://your-api.com/emotions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        emotion,
        confidence,
        timestamp: new Date().toISOString(),
        userId: 'user123'
      })
    });
    return await response.json();
  } catch (error) {
    console.error('Failed to send emotion data:', error);
  }
};

// In RealTimeEmotionCamera.tsx, inside detectEmotion():
setEmotion(mockResult);
await sendEmotionData(mockResult.emotion, mockResult.confidence);
```

### Store Emotion History

```typescript
// With AsyncStorage
import AsyncStorage from '@react-native-async-storage/async-storage';

const saveEmotionHistory = async (emotion: string, confidence: number) => {
  try {
    const history = await AsyncStorage.getItem('emotionHistory') || '[]';
    const parsed = JSON.parse(history);
    parsed.push({
      emotion,
      confidence,
      timestamp: new Date().toISOString()
    });
    await AsyncStorage.setItem('emotionHistory', JSON.stringify(parsed));
  } catch (error) {
    console.error('Failed to save emotion history:', error);
  }
};
```

### React Context for Global State

```typescript
// context/EmotionContext.tsx
import React, { createContext, useContext, useState } from 'react';

interface EmotionContextType {
  currentEmotion: string | null;
  confidence: number;
  updateEmotion: (emotion: string, confidence: number) => void;
}

const EmotionContext = createContext<EmotionContextType | undefined>(undefined);

export const EmotionProvider: React.FC = ({ children }) => {
  const [currentEmotion, setCurrentEmotion] = useState<string | null>(null);
  const [confidence, setConfidence] = useState(0);

  const updateEmotion = (emotion: string, conf: number) => {
    setCurrentEmotion(emotion);
    setConfidence(conf);
  };

  return (
    <EmotionContext.Provider value={{ currentEmotion, confidence, updateEmotion }}>
      {children}
    </EmotionContext.Provider>
  );
};

export const useEmotion = () => {
  const context = useContext(EmotionContext);
  if (!context) throw new Error('useEmotion must be used within EmotionProvider');
  return context;
};
```

## 📱 Usage in Different App Types

### React Native CLI (Bare Workflow)

```bash
# Install dependencies
npm install expo-camera expo-modules-core

# iOS
cd ios && pod install && cd ..

# Android - add to android/app/build.gradle
dependencies {
    implementation project(':expo-camera')
}
```

### Next.js / React Web (Not Recommended)

Emotion detection requires native camera access. For web:
1. Use WebRTC `getUserMedia` API
2. Use TensorFlow.js for browser
3. Load the model in JSON format (not .tflite)

## 🎨 Full Component Code

```typescript
// components/RealTimeEmotionCamera.tsx
import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, Dimensions } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';

interface EmotionResult {
  emotion: string;
  confidence: number;
}

const EMOTIONS = [
  'wbored',
  'confused',
  'drowsy',
  'engaged',
  'frustrated',
  'looking_away'
];

type CameraFacing = 'front' | 'back';

const { width: screenWidth } = Dimensions.get('window');
const DETECTION_INTERVAL = 20000; // 20 seconds - CHANGE THIS VALUE

export default function RealTimeEmotionCamera() {
  const [permission, requestPermission] = useCameraPermissions();
  const [emotion, setEmotion] = useState<EmotionResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [facing, setFacing] = useState<CameraFacing>('front');
  const [countdown, setCountdown] = useState(DETECTION_INTERVAL / 1000);
  const cameraRef = useRef<CameraView>(null);

  useEffect(() => {
    if (!permission) {
      requestPermission();
    }
  }, [permission]);

  useEffect(() => {
    // Start continuous emotion detection
    const interval = setInterval(() => {
      detectEmotion();
      setCountdown(DETECTION_INTERVAL / 1000);
    }, DETECTION_INTERVAL);

    return () => clearInterval(interval);
  }, [permission]);

  useEffect(() => {
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
  }, []);

  const detectEmotion = async () => {
    if (isProcessing || !cameraRef.current || !permission?.granted) return;

    setIsProcessing(true);

    try {
      // Simulate emotion detection
      // TODO: Replace with actual TensorFlow Lite model inference
      const randomEmotion = EMOTIONS[Math.floor(Math.random() * EMOTIONS.length)];
      const randomConfidence = 0.6 + Math.random() * 0.4;
      
      setEmotion({
        emotion: randomEmotion,
        confidence: randomConfidence
      });
    } catch (error) {
      console.error('Error detecting emotion:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const toggleCameraFacing = () => {
    setFacing(current => (current === 'back' ? 'front' : 'back'));
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

  if (!permission) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.text}>Requesting camera permission...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.text}>Camera permission is required</Text>
        <TouchableOpacity style={styles.button} onPress={requestPermission}>
          <Text style={styles.buttonText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        style={styles.camera}
        facing={facing}
        ref={cameraRef}
      />
      
      <View style={styles.overlay}>
        {/* Timer Display - Top Right */}
        <View style={styles.timerContainer}>
          <Text style={styles.timerText}>Next scan in</Text>
          <Text style={styles.timerCountdown}>{countdown}s</Text>
        </View>

        {/* Emotion Display */}
        {emotion && (
          <View style={[styles.emotionCard, { backgroundColor: getEmotionColor(emotion.emotion) + '20' }]}>
            <Text style={styles.emoji}>{getEmotionEmoji(emotion.emotion)}</Text>
            <Text style={[styles.emotionText, { color: getEmotionColor(emotion.emotion) }]}>
              {emotion.emotion.replace('_', ' ').toUpperCase()}
            </Text>
            <Text style={styles.confidenceText}>
              {(emotion.confidence * 100).toFixed(1)}% confidence
            </Text>
          </View>
        )}

        {/* Processing Indicator */}
        {isProcessing && (
          <View style={styles.processingIndicator}>
            <ActivityIndicator size="small" color="#fff" />
            <Text style={styles.processingText}>Analyzing...</Text>
          </View>
        )}

        {/* Controls */}
        <View style={styles.controls}>
          <TouchableOpacity
            style={styles.controlButton}
            onPress={toggleCameraFacing}
          >
            <Text style={styles.controlButtonText}>Flip</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.controlButton}
            onPress={detectEmotion}
            disabled={isProcessing}
          >
            <Text style={styles.controlButtonText}>
              {isProcessing ? 'Processing...' : 'Detect'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Face Overlay */}
        <View style={styles.faceOverlay}>
          <View style={styles.faceCorner} />
          <View style={[styles.faceCorner, styles.faceCornerTopRight]} />
          <View style={[styles.faceCorner, styles.faceCornerBottomLeft]} />
          <View style={[styles.faceCorner, styles.faceCornerBottomRight]} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  camera: {
    flex: 1,
    width: '100%',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
    justifyContent: 'space-between',
    padding: 20,
  },
  timerContainer: {
    position: 'absolute',
    top: 20,
    right: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
    minWidth: 100,
  },
  timerText: {
    color: '#fff',
    fontSize: 12,
    opacity: 0.8,
  },
  timerCountdown: {
    color: '#4CAF50',
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 4,
  },
  emotionCard: {
    alignSelf: 'center',
    marginTop: 80,
    padding: 20,
    borderRadius: 20,
    alignItems: 'center',
    minWidth: 200,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  emoji: {
    fontSize: 60,
    marginBottom: 10,
  },
  emotionText: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  confidenceText: {
    fontSize: 16,
    color: '#666',
  },
  processingIndicator: {
    position: 'absolute',
    top: 100,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    padding: 10,
    borderRadius: 10,
  },
  processingText: {
    color: '#fff',
    marginLeft: 10,
    fontSize: 14,
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    marginBottom: 40,
  },
  controlButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    padding: 15,
    borderRadius: 10,
    minWidth: 100,
    alignItems: 'center',
  },
  controlButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  text: {
    color: '#fff',
    fontSize: 16,
    marginTop: 20,
    textAlign: 'center',
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 10,
    marginTop: 20,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  faceOverlay: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: screenWidth * 0.6,
    height: screenWidth * 0.8,
    marginLeft: -(screenWidth * 0.3),
    marginTop: -(screenWidth * 0.4),
  },
  faceCorner: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderColor: '#fff',
    top: 0,
    left: 0,
    borderTopWidth: 3,
    borderLeftWidth: 3,
  },
  faceCornerTopRight: {
    left: undefined,
    right: 0,
    borderLeftWidth: 0,
    borderRightWidth: 3,
  },
  faceCornerBottomLeft: {
    top: undefined,
    bottom: 0,
    borderTopWidth: 0,
    borderBottomWidth: 3,
  },
  faceCornerBottomRight: {
    top: undefined,
    right: 0,
    bottom: 0,
    left: undefined,
    borderTopWidth: 0,
    borderLeftWidth: 0,
    borderBottomWidth: 3,
    borderRightWidth: 3,
  },
});
```

## 🔄 Migration Checklist

- [ ] Copy `RealTimeEmotionCamera.tsx` to your project
- [ ] Copy model files to `assets/models/`
- [ ] Install dependencies
- [ ] Update `app.json` with camera permissions
- [ ] Import and use component in your screen/route
- [ ] Test on physical device (camera doesn't work in simulator)
- [ ] Customize interval, colors, and emojis as needed
- [ ] Add backend integration if needed
- [ ] Implement emotion history if needed

## 📝 Notes

1. **Timer Location**: Top right corner of the screen
2. **Timer Customization**: Change `DETECTION_INTERVAL` constant (line 24)
3. **Testing**: Must test on a real device (emulator cameras don't work properly)
4. **Model**: Currently using simulated detection - replace with actual TensorFlow Lite inference
5. **Permissions**: Camera permission must be granted by user

## 🚀 Next Steps

1. Replace simulated detection with actual TensorFlow Lite model
2. Add backend API integration
3. Implement emotion history tracking
4. Add analytics and reporting
5. Optimize model performance
