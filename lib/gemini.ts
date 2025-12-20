import { GoogleGenerativeAI } from '@google/generative-ai';

const API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY || '';
const genAI = new GoogleGenerativeAI(API_KEY);

export interface Prerequisite {
  id: string;
  name: string;
  description: string;
  difficulty: 'basic' | 'intermediate' | 'advanced';
  estimatedHours: number;
  order: number;
}

export interface KnowledgeGraph {
  mainTopic: string;
  description: string;
  prerequisites: Prerequisite[];
  learningPath: {
    basic: string[];
    intermediate: string[];
    advanced: string[];
  };
}

export interface QuizQuestion {
  id: string;
  content: string;
  type: 'multiple_choice' | 'text' | 'code';
  difficulty: 'basic' | 'intermediate' | 'advanced';
  prerequisiteId: string;
  data: {
    options?: string[];
    correct: string | number;
    explanation?: string;
    codeSnippet?: string;
  };
}

export interface TopicSubtopic {
  id: string;
  title: string;
  explanation: string;
  example?: string;
  exampleExplanation?: string;
  keyPoints?: string[];
}

export interface TopicExplanation {
  topicName: string;
  overview: string;
  difficulty: 'basic' | 'intermediate' | 'advanced';
  whyLearn?: string;
  subtopics: TopicSubtopic[];
  bestPractices?: string[];
  commonPitfalls?: string[];
  resources?: string[];
}

export class GeminiService {
  private model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

  async generateKnowledgeGraph(topic: string): Promise<KnowledgeGraph> {
    const prompt = `
      Create a comprehensive knowledge graph and learning roadmap for "${topic}".
      
      Analyze the topic and provide:
      1. A clear description of what "${topic}" is
      2. All prerequisites needed to learn this topic effectively
      3. Organize prerequisites by difficulty levels (basic, intermediate, advanced)
      4. Estimate learning hours for each prerequisite
      5. Create a logical learning path progression

      Return ONLY valid JSON in this exact format:
      {
        "mainTopic": "${topic}",
        "description": "Clear description of the topic",
        "prerequisites": [
          {
            "id": "unique-id",
            "name": "Prerequisite name",
            "description": "What this covers",
            "difficulty": "basic|intermediate|advanced",
            "estimatedHours": number,
            "order": number (sequential starting from 1)
          }
        ],
        "learningPath": {
          "basic": ["prerequisite names for basic level"],
          "intermediate": ["prerequisite names for intermediate level"],
          "advanced": ["prerequisite names for advanced level"]
        }
      }

      Make sure prerequisites are comprehensive and cover all foundational knowledge needed.
      For programming topics, include relevant languages, concepts, and tools.
      Order prerequisites logically - simpler concepts first, building complexity.
    `;

    try {
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      
      // Parse JSON response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Invalid JSON response from Gemini');
      }
      
      const knowledgeGraph = JSON.parse(jsonMatch[0]) as KnowledgeGraph;
      
      // Validate response structure
      if (!knowledgeGraph.mainTopic || !knowledgeGraph.prerequisites || !knowledgeGraph.learningPath) {
        throw new Error('Invalid knowledge graph structure');
      }
      
      return knowledgeGraph;
    } catch (error) {
      console.error('Error generating knowledge graph:', error);
      throw new Error(`Failed to generate knowledge graph: ${error}`);
    }
  }

  async generateQuizQuestions(prerequisite: Prerequisite, topicContext: string): Promise<QuizQuestion[]> {
    const prompt = `
      Create 5-8 comprehensive quiz questions for the prerequisite "${prerequisite.name}" 
      in the context of learning "${topicContext}".
      
      Prerequisite details:
      - Name: ${prerequisite.name}
      - Description: ${prerequisite.description}
      - Difficulty: ${prerequisite.difficulty}
      
      Generate questions that test essential knowledge of this prerequisite.
      
      Create ONLY multiple choice questions with 4 options each.
      Make questions practical and relevant to someone learning ${topicContext}.
      
      Return ONLY valid JSON in this exact format:
      [
        {
          "id": "unique-question-id",
          "content": "Question text here",
          "type": "multiple_choice",
          "difficulty": "${prerequisite.difficulty}",
          "prerequisiteId": "${prerequisite.id}",
          "data": {
            "options": ["Option A", "Option B", "Option C", "Option D"],
            "correct": 0,
            "explanation": "Why this answer is correct"
          }
        }
      ]
      
      Make questions challenging but fair for ${prerequisite.difficulty} level.
      Ensure correct answers are accurate and explanations are helpful.
    `;

    try {
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      
      // Parse JSON response
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        throw new Error('Invalid JSON response from Gemini');
      }
      
      const questions = JSON.parse(jsonMatch[0]) as QuizQuestion[];
      
      // Validate questions structure
      if (!Array.isArray(questions) || questions.length === 0) {
        throw new Error('Invalid questions structure');
      }
      
      return questions;
    } catch (error) {
      console.error('Error generating quiz questions:', error);
      throw new Error(`Failed to generate quiz questions: ${error}`);
    }
  }

  async generatePersonalizedFeedback(
    topic: string, 
    completedPrerequisites: string[], 
    strugglingAreas: string[]
  ): Promise<string> {
    const prompt = `
      Generate personalized learning feedback for a student learning "${topic}".
      
      Completed prerequisites: ${completedPrerequisites.join(', ')}
      Areas where student is struggling: ${strugglingAreas.join(', ')}
      
      Provide:
      1. Encouragement for completed areas
      2. Specific guidance for struggling areas
      3. Next recommended steps
      4. Study tips and resources
      
      Keep it motivational, specific, and actionable. Max 200 words.
    `;

    try {
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      return response.text();
    } catch (error) {
      console.error('Error generating feedback:', error);
      return 'Keep up the great work! Focus on practicing the fundamentals and you\'ll master this topic.';
    }
  }

  async generateTopicExplanation(topicName: string, context: string): Promise<TopicExplanation> {
    const prompt = `
      Create a comprehensive, educational explanation for the topic "${topicName}" in the context of learning "${context}".
      
      Provide:
      1. A clear overview of what ${topicName} is
      2. Why someone learning ${context} should understand ${topicName}
      3. 5-8 key subtopics/concepts within ${topicName}
      4. For EACH subtopic, provide:
         - A clear explanation
         - A practical code example (if applicable)
         - Explanation of the example
         - 2-3 key points to remember
      5. Best practices when using/applying ${topicName}
      6. Common mistakes/pitfalls to avoid
      7. Suggested resources for deeper learning
      
      Make explanations clear, beginner-friendly but thorough.
      Include real-world, practical examples.
      
      Return ONLY valid JSON in this exact format:
      {
        "topicName": "${topicName}",
        "overview": "Clear overview of the topic",
        "difficulty": "basic|intermediate|advanced",
        "whyLearn": "Why this topic matters for learning ${context}",
        "subtopics": [
          {
            "id": "subtopic-1",
            "title": "Subtopic name",
            "explanation": "Detailed explanation",
            "example": "Code example or practical example",
            "exampleExplanation": "What this example demonstrates",
            "keyPoints": ["Point 1", "Point 2", "Point 3"]
          }
        ],
        "bestPractices": ["Practice 1", "Practice 2"],
        "commonPitfalls": ["Pitfall 1", "Pitfall 2"],
        "resources": ["Resource suggestion 1", "Resource suggestion 2"]
      }
      
      Make content educational, accurate, and engaging.
    `;

    try {
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      
      // Parse JSON response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Invalid JSON response from Gemini');
      }
      
      const explanation = JSON.parse(jsonMatch[0]) as TopicExplanation;
      
      // Validate response structure
      if (!explanation.topicName || !explanation.overview || !explanation.subtopics) {
        throw new Error('Invalid topic explanation structure');
      }
      
      return explanation;
    } catch (error) {
      console.error('Error generating topic explanation:', error);
      throw new Error(`Failed to generate topic explanation: ${error}`);
    }
  }
}

export const geminiService = new GeminiService();