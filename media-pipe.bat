#!/bin/bash
echo "📦 Installing dependencies..."
bun install

echo "📥 Downloading MediaPipe model..."
curl -L "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task" -o face_landmarker.task

echo "📁 Setting up Android assets..."
mkdir -p android/app/src/main/assets/models
cp face_landmarker.task android/app/src/main/assets/models/

echo "🔨 Building native code..."
npx expo prebuild --clean

echo "✅ Setup complete! Run: bun run android"