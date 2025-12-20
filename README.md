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