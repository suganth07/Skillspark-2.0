const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Expo Config Plugin to copy face_landmarker.task to Android assets
 * This runs after prebuild generates the android/ folder
 */
const withFaceLandmarkerAsset = (config) => {
  return withDangerousMod(config, [
    'android',
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const sourceFile = path.join(projectRoot, 'face_landmarker.task');
      const targetDir = path.join(
        projectRoot,
        'android',
        'app',
        'src',
        'main',
        'assets'
      );
      const targetFile = path.join(targetDir, 'face_landmarker.task');

      // Create assets directory if it doesn't exist
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }

      // Copy model file if source exists
      if (fs.existsSync(sourceFile)) {
        fs.copyFileSync(sourceFile, targetFile);
        console.log('✅ Copied face_landmarker.task to Android assets');
      } else {
        console.warn('⚠️  face_landmarker.task not found in project root');
      }

      return config;
    },
  ]);
};

module.exports = withFaceLandmarkerAsset;
