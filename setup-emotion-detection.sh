#!/bin/bash

# Setup script for FaceLandmarks emotion detection module
# This script prepares the Android build environment

set -e

echo "🚀 Setting up FaceLandmarks module for Android..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Step 1: Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ Error: package.json not found. Run this from the project root.${NC}"
    exit 1
fi

echo -e "${GREEN}✓${NC} Found package.json"

# Step 2: Download MediaPipe model if not present
MODEL_FILE="face_landmarker.task"
MODEL_URL="https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task"
EXPECTED_SIZE=3758596

if [ ! -f "$MODEL_FILE" ]; then
    echo -e "${YELLOW}📥 Downloading MediaPipe Face Landmarker model...${NC}"
    
    # Download with error handling
    if ! curl -L "$MODEL_URL" -o "$MODEL_FILE"; then
        echo -e "${RED}❌ Error: Failed to download model from $MODEL_URL${NC}"
        echo -e "${RED}   Please check your internet connection and try again.${NC}"
        exit 1
    fi
    
    # Verify file exists
    if [ ! -f "$MODEL_FILE" ]; then
        echo -e "${RED}❌ Error: Model file $MODEL_FILE was not created after download.${NC}"
        exit 1
    fi
    
    # Verify file size
    ACTUAL_SIZE=$(stat -f%z "$MODEL_FILE" 2>/dev/null || stat -c%s "$MODEL_FILE" 2>/dev/null)
    if [ "$ACTUAL_SIZE" != "$EXPECTED_SIZE" ]; then
        echo -e "${RED}❌ Error: Model file size mismatch!${NC}"
        echo -e "${RED}   Expected: $EXPECTED_SIZE bytes${NC}"
        echo -e "${RED}   Actual:   $ACTUAL_SIZE bytes${NC}"
        echo -e "${RED}   The download may be corrupted. Please delete $MODEL_FILE and try again.${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✓${NC} Model downloaded and verified: $MODEL_FILE ($ACTUAL_SIZE bytes)"
else
    echo -e "${GREEN}✓${NC} Model already exists: $MODEL_FILE"
fi

# Step 3: Run expo prebuild if android folder doesn't exist
if [ ! -d "android" ]; then
    echo -e "${YELLOW}🔨 Running expo prebuild to generate Android project...${NC}"
    bun expo prebuild
    echo -e "${GREEN}✓${NC} Android project generated with expo prebuild"
else
    echo -e "${GREEN}✓${NC} Android project already exists"
fi

# Step 4: Create assets directory and copy model
ASSETS_DIR="android/app/src/main/assets"
echo -e "${YELLOW}📁 Creating assets directory...${NC}"
mkdir -p "$ASSETS_DIR"
echo -e "${GREEN}✓${NC} Assets directory created: $ASSETS_DIR"

# Step 5: Copy model to assets
echo -e "${YELLOW}📋 Copying model to Android assets...${NC}"
cp "$MODEL_FILE" "$ASSETS_DIR/"
echo -e "${GREEN}✓${NC} Model copied to: $ASSETS_DIR/$MODEL_FILE"

# Step 6: Verify module files exist
echo -e "${YELLOW}🔍 Verifying module files...${NC}"

MODULE_KT="modules/face-landmarks/android/src/main/java/expo/modules/facelandmarks/FaceLandmarksModule.kt"
MODULE_GRADLE="modules/face-landmarks/android/build.gradle"
MODULE_CONFIG="modules/face-landmarks/expo-module.config.json"

if [ -f "$MODULE_KT" ]; then
    echo -e "${GREEN}✓${NC} Found: $MODULE_KT"
else
    echo -e "${RED}✗${NC} Missing: $MODULE_KT"
fi

if [ -f "$MODULE_GRADLE" ]; then
    echo -e "${GREEN}✓${NC} Found: $MODULE_GRADLE"
else
    echo -e "${RED}✗${NC} Missing: $MODULE_GRADLE"
fi

if [ -f "$MODULE_CONFIG" ]; then
    echo -e "${GREEN}✓${NC} Found: $MODULE_CONFIG"
else
    echo -e "${RED}✗${NC} Missing: $MODULE_CONFIG"
fi

# Step 7: Check if svd-js is installed
echo -e "${YELLOW}🔍 Checking JavaScript dependencies...${NC}"
if grep -q "svd-js" package.json; then
    echo -e "${GREEN}✓${NC} svd-js is in package.json"
else
    echo -e "${YELLOW}⚠${NC} svd-js not found in package.json, installing..."
    bun add svd-js
fi

# Final summary
echo ""
echo -e "${GREEN}═══════════════════════════════════════════════════${NC}"
echo -e "${GREEN}✅ Setup complete!${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════${NC}"
echo ""
echo "Next steps:"
echo "  1. Build the app:    bun run android"
echo "  2. Or dev client:    bun run dev:android"
echo ""
echo "Test emotion detection with:"
echo "  import { detectEmotionFromImageUri } from '@/lib/emotion/detectEmotion';"
echo "  const result = await detectEmotionFromImageUri(photoUri);"
echo ""
echo -e "${YELLOW}Note:${NC} First detection will take ~200ms for initialization."
echo -e "${YELLOW}      Subsequent detections: ~50-150ms${NC}"
echo ""
