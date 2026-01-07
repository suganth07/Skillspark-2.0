#!/bin/bash
# Download MediaPipe Face Landmarker model for emotion detection
# Run this script from the project root

set -e

MODEL_URL="https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task"
ANDROID_ASSETS_DIR="android/app/src/main/assets"

echo "📥 Downloading MediaPipe Face Landmarker model..."

# Download the model
curl -L "$MODEL_URL" -o face_landmarker.task

echo "✅ Model downloaded: face_landmarker.task"

# Create Android assets directory if it doesn't exist
if [ -d "android" ]; then
    mkdir -p "$ANDROID_ASSETS_DIR"
    cp face_landmarker.task "$ANDROID_ASSETS_DIR/"
    echo "✅ Copied to Android assets: $ANDROID_ASSETS_DIR/face_landmarker.task"
fi

# For iOS, we'll need to add it via Xcode
echo ""
echo "📱 iOS Setup:"
echo "   1. Open the ios/ folder in Xcode"
echo "   2. Drag face_landmarker.task into your project"
echo "   3. Ensure 'Copy items if needed' is checked"
echo "   4. Add to target: your app target"
echo ""
echo "🚀 Next steps:"
echo "   1. Run: bun install"
echo "   2. Run: npx expo prebuild --clean"
echo "   3. Run: npx expo run:android (or run:ios)"
