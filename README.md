# SkillSpark

A knowledge graph-based super personalized learning companion built with React Native and Expo.

## 🚀 Features

- **Personalized Learning Roadmaps**: Create and customize learning paths tailored to your goals
- **Knowledge Graph Integration**: Visualize and connect concepts through an intelligent graph structure
- **Interactive Quizzes**: Test your knowledge with engaging, adaptive quizzes
- **Progress Tracking**: Monitor your learning journey with detailed analytics
- **User Management**: Manage profiles, preferences, and learning history
- **Theme Support**: Light and dark mode with seamless theme switching
- **AI-Powered Insights**: Leverage Gemini AI for personalized recommendations
- **Cross-Platform**: Native mobile experience on iOS and Android

## 🛠 Tech Stack

- **Framework**: React Native with Expo
- **Language**: TypeScript
- **Styling**: Tailwind CSS with NativeWind
- **Database**: Drizzle ORM with SQLite
- **State Management**: Zustand stores
- **UI Components**: Custom component library with Radix UI primitives
- **AI Integration**: Google Gemini API
- **Build Tools**: Metro bundler, Biome for linting/formatting

## 📦 Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/TharunCodes07/SkillSpark.git
   cd SkillSpark
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up the database**
   ```bash
   # Generate migration files
   npx drizzle-kit generate

   # Run migrations
   npm run migrate
   ```

4. **Configure environment variables**
   - Copy `.env.example` to `.env`
   - Add your Gemini API key and other required variables

5. **Start the development server**
   ```bash
   npx expo start
   ```

## 📱 Usage

1. **Launch the app** on your device or simulator
2. **Create an account** or sign in
3. **Build your learning roadmap** by selecting topics and goals
4. **Follow personalized paths** with interactive content
5. **Take quizzes** to reinforce learning
6. **Track progress** in your dashboard

## Emotion Detection (Android + EAS)

This project includes a custom Expo native module for emotion detection using MediaPipe Face Landmarker.

### Why It Worked Locally But Failed In EAS

The local Gradle build worked because native Android files existed on the laptop, but EAS cloud builds only use files that are tracked in Git and included in the uploaded project snapshot.

The root cause was that Android native files under `modules/face-landmarks/android` were effectively excluded from the EAS upload because of ignore rules. As a result, the EAS APK did not autolink the `face-landmarks` native module, and the app showed **Emotion Detection Unavailable**.

### Fixes Applied

1. Restored Android native module files:
   - `modules/face-landmarks/android/build.gradle`
   - `modules/face-landmarks/android/src/main/AndroidManifest.xml`
   - `modules/face-landmarks/android/src/main/java/expo/modules/facelandmarks/FaceLandmarksModule.kt`

2. Updated module Gradle config to match Expo SDK 54 project values:
   - `compileSdkVersion`, `minSdkVersion`, `targetSdkVersion`
   - MediaPipe dependency: `com.google.mediapipe:tasks-vision:0.10.14`

3. Added automatic model copy before Android build:
   - In `android/app/build.gradle`, a `copyFaceLandmarkerModel` task copies `face_landmarker.task` to `android/app/src/main/assets/`
   - `preBuild.dependsOn("copyFaceLandmarkerModel")` ensures this runs for local and EAS builds

4. Fixed ignore rules so EAS receives native source files while still ignoring generated artifacts:
   - Keep: `modules/face-landmarks/android/**`
   - Ignore: `modules/face-landmarks/android/.gradle/` and `modules/face-landmarks/android/build/`

### One-Time Setup (Any Laptop)

1. Install dependencies:

```bash
bun install
```

2. Prepare emotion model and Android assets:

```bash
bash setup-emotion-detection.sh
```

3. Verify required files exist:

```bash
ls -la modules/face-landmarks/android/src/main/java/expo/modules/facelandmarks/FaceLandmarksModule.kt
ls -la modules/face-landmarks/android/build.gradle
ls -lh face_landmarker.task
```

### Local APK Build (Verification)

```bash
cd android
./gradlew clean
./gradlew :app:assembleRelease
```

APK output:
- `android/app/build/outputs/apk/release/app-release.apk`

### EAS APK Build (Cloud)

1. Ensure native module and model changes are committed and pushed:

```bash
git add .gitignore modules/face-landmarks/android/build.gradle modules/face-landmarks/android/src/main/AndroidManifest.xml modules/face-landmarks/android/src/main/java/expo/modules/facelandmarks/FaceLandmarksModule.kt face_landmarker.task
git commit -m "Fix Android FaceLandmarks module for EAS"
git push
```

2. Build with EAS:

```bash
npx eas-cli@latest build --platform android --profile preview-release --clear-cache
```

3. In EAS logs, confirm module autolinking contains:
   - `Using expo modules`
   - `face-landmarks (1.0.0)`

If `face-landmarks` is missing from that list, the APK will show **Emotion Detection Unavailable**.

### Runtime Verification

1. Install APK on device.
2. Open app settings and enable Emotion Detection.
3. Open a topic screen.
4. Confirm the unavailable banner is not shown.

Optional log verification:

```bash
adb logcat | grep -i "FaceLandmarks\|FACE_DETECTION_ERROR\|face_landmarker"
```

### Common Pitfalls

- Building/running in Expo Go instead of a native APK/dev client.
- Not committing native module files before triggering EAS build.
- Missing `face_landmarker.task` at project root.
- Ignoring module source folders by mistake.

For deeper troubleshooting and architecture notes, see `EMOTION_DETECTION_SETUP.md`.

## 🏗 Project Structure

```
SkillSpark/
├── app/                    # Expo Router pages
├── components/             # Reusable UI components
├── db/                     # Database configuration and migrations
├── hooks/                  # Custom React hooks
├── lib/                    # Utilities and services
├── stores/                 # Zustand state stores
├── assets/                 # Images and static files
└── server/                 # Server-side queries
```

## 🤝 Contributing

We welcome contributions! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built with ❤️ using React Native and Expo
- UI components inspired by Radix UI
- AI features powered by Google Gemini

---

**Happy Learning! 🚀**