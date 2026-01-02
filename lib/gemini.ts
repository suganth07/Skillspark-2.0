import { GoogleGenerativeAI } from '@google/generative-ai';
import { generateContentBundle } from '../agents/DynamicContent';

const API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY;

if (!API_KEY) {
  console.error('⚠️ EXPO_PUBLIC_GEMINI_API_KEY is not set. Gemini features will not work.');
}
const genAI = new GoogleGenerativeAI(API_KEY || '');

// Helper function to retry API calls
async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  delayMs: number = 1000
): Promise<T> {
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.warn(`⚠️ Attempt ${attempt}/${maxRetries} failed:`, lastError.message);
      
      if (attempt < maxRetries) {
        console.log(`⏳ Retrying in ${delayMs}ms...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
        delayMs *= 1.5; // Exponential backoff
      }
    }
  }
  
  throw lastError;
}

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
  subtopicId?: string; // Link to specific subtopic
  subtopicName?: string; // Name of the subtopic this question tests
  data: {
    options?: string[];
    correct: string | number;
    explanation?: string;
    codeSnippet?: string;
  };
}

// Raw type for individual content versions (before merging)
export interface RawSubtopic {
  id: string;
  title: string;
  explanation: string;  // Will be mapped to explanationDefault/Simplified/Story
  example?: string;
  exampleExplanation?: string;
  keyPoints?: string[];
}

export interface RawTopicExplanation {
  topicName: string;
  overview: string;
  difficulty: 'basic' | 'intermediate' | 'advanced';
  whyLearn?: string;
  subtopics: RawSubtopic[];
  bestPractices?: string[];
  commonPitfalls?: string[];
  resources?: string[];
}

export interface TopicSubtopic {
  id: string;
  title: string;
  // Three types of explanations
  explanationDefault: string;
  explanationSimplified: string;
  explanationStory: string;
  // Examples for each type
  example?: string;
  exampleExplanation?: string;
  exampleSimplified?: string;
  exampleStory?: string;
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
  private model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });

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
            "options": ["Option A", "Option B", "Option C", "Option D", "Not sure"],
            "correct": 0,
            "explanation": "Why this answer is correct"
          }
        }
      ]
      
      IMPORTANT: Always include "Not sure" as the last option (5th option). If user selects "Not sure", give 0 marks.
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

  // NEW: Generate quiz questions from subtopics
  async generateQuizQuestionsFromSubtopics(
    topicName: string,
    subtopics: Array<{ id: string; name: string; description: string }>,
    difficulty: 'basic' | 'intermediate' | 'advanced',
    context: string
  ): Promise<QuizQuestion[]> {
    const subtopicsList = subtopics.map(st => `- ${st.name}: ${st.description}`).join('\n');
    
    const prompt = `
      Create a comprehensive quiz for "${topicName}" in the context of learning "${context}".
      
      Generate 1-2 questions for EACH of the following subtopics (total 8-12 questions):
      ${subtopicsList}
      
      Requirements:
      - Each question MUST specify which subtopic it tests
      - Create ONLY multiple choice questions with 5 options each (4 regular + "Not sure")
      - Questions should test understanding of that specific subtopic
      - Make questions practical and relevant
      - Difficulty level: ${difficulty}
      
      Return ONLY valid JSON array (no markdown, no code blocks, no extra text):
      [
        {
          "id": "unique-question-id",
          "content": "Question text here",
          "type": "multiple_choice",
          "difficulty": "${difficulty}",
          "subtopicName": "exact subtopic name from the list above",
          "data": {
            "options": ["Option A", "Option B", "Option C", "Option D", "Not sure"],
            "correct": 0,
            "explanation": "Why this answer is correct and how it relates to the subtopic"
          }
        }
      ]
      
      IMPORTANT: 
      - Return ONLY the JSON array, nothing else
      - Always include "Not sure" as the last option (5th option)
      - Ensure each subtopic gets at least 1 question
      - Make questions challenging but fair for ${difficulty} level
    `;

    // Use retry wrapper for resilience
    return withRetry(async () => {
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      
      // Log raw response for debugging
      console.log('📝 Gemini raw response length:', text.length);
      console.log('📝 Gemini response first 200 chars:', text.substring(0, 200));
      
      // Check if response is empty or starts with error indicators
      if (!text || text.trim().length === 0) {
        throw new Error('Empty response from Gemini API');
      }
      
      // Check for common error patterns
      if (text.startsWith('Unable') || text.startsWith('Unavailable') || text.startsWith('Unfortunately')) {
        throw new Error(`Gemini API error: ${text.substring(0, 100)}`);
      }
      
      // Try to extract JSON - handle markdown code blocks too
      let jsonText = text;
      
      // Remove markdown code blocks if present
      const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (codeBlockMatch) {
        jsonText = codeBlockMatch[1];
      }
      
      // Parse JSON response
      const jsonMatch = jsonText.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        console.error('📛 Failed to find JSON array in response:', text.substring(0, 500));
        throw new Error('Invalid JSON response from Gemini - no array found');
      }
      
      let questions: QuizQuestion[];
      try {
        questions = JSON.parse(jsonMatch[0]) as QuizQuestion[];
      } catch (parseError) {
        console.error('📛 JSON parse error:', parseError);
        console.error('📛 Attempted to parse:', jsonMatch[0].substring(0, 500));
        throw new Error(`Failed to parse quiz JSON: ${parseError}`);
      }
      
      // Validate questions structure
      if (!Array.isArray(questions) || questions.length === 0) {
        throw new Error('Invalid questions structure - empty array');
      }
      
      // Map subtopic names to IDs
      questions.forEach(q => {
        const matchingSubtopic = subtopics.find(
          st => st.name.toLowerCase() === q.subtopicName?.toLowerCase()
        );
        if (matchingSubtopic) {
          q.subtopicId = matchingSubtopic.id;
        }
      });
      
      console.log(`✅ Generated ${questions.length} quiz questions from subtopics`);
      return questions;
    }, 3, 1500); // 3 retries with 1.5s initial delay
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

  async generateTopicExplanation(
    topicName: string, 
    context: string,
    subtopicPerformance?: Array<{ subtopicName: string; status: string; accuracy: number }>
  ): Promise<TopicExplanation> {
    console.log(`🎯 [Content Agent] Delegating content generation to agent for "${topicName}"`);
    
    // Use the content agent to orchestrate parallel content generation
    const result = await generateContentBundle(topicName, context, subtopicPerformance);
    
    console.log(`✅ [Content Agent] Content generation complete via agent for "${topicName}"`);
    return result;
  }

  // Generate default/normal content
  async generateDefaultContent(
    topicName: string,
    context: string,
    subtopicPerformance?: Array<{ subtopicName: string; status: string; accuracy: number }>
  ): Promise<RawTopicExplanation> {
    // Build performance guidance for AI
    let performanceGuidance = '';
    if (subtopicPerformance && subtopicPerformance.length > 0) {
      performanceGuidance = `
      
      ⚡ CRITICAL: The user has taken a quiz. Adjust content length DRASTICALLY based on performance:
      
${subtopicPerformance.map(p => 
`      📊 "${p.subtopicName}": ${Math.round(p.accuracy)}% accuracy (${p.status.toUpperCase()})
         → ${p.status === 'strong' 
           ? '✅ BRIEF REVIEW ONLY: 1 short paragraph (3-4 sentences), 1 simple example, 2 key points'
           : '❌ COMPREHENSIVE TEACHING: 3-4 full paragraphs, 2-3 detailed examples, 3-4 key points with explanations'
         }`
      ).join('\n')}
      
      REQUIREMENTS:
      - Strong subtopics (≥70%): MAX 1 paragraph + 1 basic example (user knows this)
      - Weak/Neutral (<70%): MIN 3 paragraphs + 2-3 diverse examples (user needs deep learning)
      - Content length difference should be OBVIOUSLY visible
      - Match subtopic titles EXACTLY to names above to apply correct depth
      `;
    }
    
    const prompt = `
      Create a comprehensive, educational explanation for the topic "${topicName}" in the context of learning "${context}".
      ${performanceGuidance}
      
      Provide:
      1. A clear overview of what ${topicName} is
      2. Why someone learning ${context} should understand ${topicName}
      3. 5-8 key subtopics/concepts within ${topicName}
      4. For EACH subtopic, provide:
         - A clear, balanced explanation ${subtopicPerformance ? '(LENGTH MUST VARY based on performance data above!)' : ''}
         - A practical code example (if applicable)
         - Explanation of the example
         - 2-3 key points to remember
      5. Best practices when using/applying ${topicName}
      6. Common mistakes/pitfalls to avoid
      7. Suggested resources for deeper learning
      
      ${subtopicPerformance && subtopicPerformance.length > 0 
        ? '🔥 CRITICAL: Strong subtopics = SHORT (1 paragraph), Weak subtopics = LONG (3-4 paragraphs). Do NOT make them all the same length!'
        : 'Make explanations clear, beginner-friendly but thorough.'
      }
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
            "explanation": "Detailed explanation (or minimal if user is strong in this area)",
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
      
      const explanation = JSON.parse(jsonMatch[0]) as RawTopicExplanation;
      
      // Validate response structure
      if (!explanation.topicName || !explanation.overview || !explanation.subtopics) {
        throw new Error('Invalid topic explanation structure');
      }
      
      console.log(`✅ Generated DEFAULT content with ${explanation.subtopics.length} subtopics`);
      return explanation;
    } catch (error) {
      console.error('Error generating default topic explanation:', error);
      throw new Error(`Failed to generate default topic explanation: ${error}`);
    }
  }

  // Generate simplified content with longer explanations and more examples
  async generateSimplifiedContent(
    topicName: string,
    context: string,
    subtopicPerformance?: Array<{ subtopicName: string; status: string; accuracy: number }>
  ): Promise<RawTopicExplanation> {
    let performanceGuidance = '';
    if (subtopicPerformance && subtopicPerformance.length > 0) {
      performanceGuidance = `
      
      📊 User Performance Data (use for prioritization):
${subtopicPerformance.map(p => `      - "${p.subtopicName}": ${Math.round(p.accuracy)}% accuracy (${p.status})`).join('\n')}
      
      Focus MORE examples and simpler language on weak areas, but keep all content accessible.
      `;
    }

    const prompt = `
      Create a SIMPLIFIED, beginner-friendly explanation for the topic "${topicName}" in the context of learning "${context}".
      ${performanceGuidance}
      
      THIS VERSION IS FOR LEARNERS WHO NEED:
      - Simpler language and clearer explanations
      - MORE examples (2-3 per subtopic)
      - Step-by-step breakdowns
      - Real-world analogies and relatable examples
      
      Provide:
      1. A simple, easy-to-understand overview
      2. Why this topic matters (in simple terms)
      3. 5-8 key subtopics/concepts
      4. For EACH subtopic:
         - A LONGER, simpler explanation (4-5 paragraphs, break down complex ideas)
         - 2-3 practical examples with detailed explanations
         - Real-world analogies when possible
         - 3-4 key takeaway points in simple language
      5. Best practices (explained simply)
      6. Common mistakes and how to avoid them
      7. Beginner-friendly learning resources
      
      Use simple vocabulary, avoid jargon, and explain everything step-by-step.
      Make examples very concrete and relatable.
      
      Return ONLY valid JSON in this exact format:
      {
        "topicName": "${topicName}",
        "overview": "Simple, clear overview",
        "difficulty": "basic|intermediate|advanced",
        "whyLearn": "Why this matters (simple explanation)",
        "subtopics": [
          {
            "id": "subtopic-1",
            "title": "Subtopic name",
            "explanation": "LONGER, simpler explanation with step-by-step breakdown",
            "example": "Detailed, relatable example with step-by-step walkthrough",
            "exampleExplanation": "Clear explanation of what the example shows",
            "keyPoints": ["Simple point 1", "Simple point 2", "Simple point 3", "Simple point 4"]
          }
        ],
        "bestPractices": ["Simple practice 1", "Simple practice 2"],
        "commonPitfalls": ["Mistake 1 and how to avoid it", "Mistake 2 and how to avoid it"],
        "resources": ["Beginner resource 1", "Beginner resource 2"]
      }
      
      Make this version significantly LONGER and SIMPLER than a typical explanation.
    `;

    try {
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Invalid JSON response from Gemini');
      }
      
      const explanation = JSON.parse(jsonMatch[0]) as RawTopicExplanation;
      
      if (!explanation.topicName || !explanation.overview || !explanation.subtopics) {
        throw new Error('Invalid simplified explanation structure');
      }
      
      console.log(`✅ Generated SIMPLIFIED content with ${explanation.subtopics.length} subtopics`);
      return explanation;
    } catch (error) {
      console.error('Error generating simplified topic explanation:', error);
      throw new Error(`Failed to generate simplified topic explanation: ${error}`);
    }
  }

  // Generate story-based content
  async generateStoryContent(
    topicName: string,
    context: string,
    subtopicPerformance?: Array<{ subtopicName: string; status: string; accuracy: number }>
  ): Promise<RawTopicExplanation> {
    let performanceGuidance = '';
    if (subtopicPerformance && subtopicPerformance.length > 0) {
      performanceGuidance = `
      
      📊 User Performance Data:
${subtopicPerformance.map(p => `      - "${p.subtopicName}": ${Math.round(p.accuracy)}% accuracy (${p.status})`).join('\n')}
      
      Create more detailed story scenarios for weak areas to help understanding.
      `;
    }

    const prompt = `
      Create a STORY-BASED explanation for the topic "${topicName}" in the context of learning "${context}".
      ${performanceGuidance}
      
      THIS VERSION USES STORYTELLING TO TEACH:
      - Present concepts through engaging narratives
      - Use characters, scenarios, and real-world situations
      - Make abstract concepts concrete through stories
      - Create memorable learning experiences
      
      Provide:
      1. An engaging story-based overview that introduces the topic
      2. Why this topic matters (told through a brief scenario)
      3. 5-8 key subtopics/concepts
      4. For EACH subtopic:
         - A STORY or SCENARIO that illustrates the concept
         - Include characters, setting, and a plot that demonstrates the learning point
         - Show the concept in action through the story
         - Example: code within the context of the story
         - 2-3 key lessons learned from the story
      5. Best practices (illustrated through story examples)
      6. Common mistakes (shown through cautionary tales)
      7. Resources for further exploration
      
      Make the stories engaging, relatable, and memorable.
      Use real-world scenarios that learners can connect with emotionally.
      
      Return ONLY valid JSON in this exact format:
      {
        "topicName": "${topicName}",
        "overview": "Story-based introduction to the topic",
        "difficulty": "basic|intermediate|advanced",
        "whyLearn": "Why this matters (told as a mini-scenario)",
        "subtopics": [
          {
            "id": "subtopic-1",
            "title": "Subtopic name",
            "explanation": "Story or scenario that teaches this concept. Include characters, setting, and demonstrate the learning point through narrative.",
            "example": "Code or practical example within the story context",
            "exampleExplanation": "How this example fits into the story and what it teaches",
            "keyPoints": ["Lesson 1 from the story", "Lesson 2 from the story", "Lesson 3 from the story"]
          }
        ],
        "bestPractices": ["Practice 1 (with story example)", "Practice 2 (with story example)"],
        "commonPitfalls": ["Cautionary tale 1", "Cautionary tale 2"],
        "resources": ["Resource 1", "Resource 2"]
      }
      
      Make each subtopic a compelling mini-story that teaches the concept.
    `;

    try {
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Invalid JSON response from Gemini');
      }
      
      const explanation = JSON.parse(jsonMatch[0]) as RawTopicExplanation;
      
      if (!explanation.topicName || !explanation.overview || !explanation.subtopics) {
        throw new Error('Invalid story explanation structure');
      }
      
      console.log(`✅ Generated STORY content with ${explanation.subtopics.length} subtopics`);
      return explanation;
    } catch (error) {
      console.error('Error generating story topic explanation:', error);
      throw new Error(`Failed to generate story topic explanation: ${error}`);
    }
  }

  /**
   * Generate a video script for HeyGen based on topic subtopics
   * Creates a ~10 second educational video script for testing
   */
  async generateVideoScript(
    topicName: string,
    context: string,
    subtopics: TopicSubtopic[]
  ): Promise<string> {
    const prompt = `
Create a very brief, concise script for a ~10 second video introducing the topic "${topicName}".

Provide ONLY:
1. A single sentence introducing ${topicName}
2. One key point about why it's important

Use this subtopic information for context:
${JSON.stringify(subtopics.slice(0, 2).map(s => ({ title: s.title })), null, 2)}

Output ONLY the script text. Do NOT include JSON, markdown, bullets, or extra metadata.
Keep overall length suitable for ~10 seconds (~30-40 words maximum).
Write in a friendly, conversational tone as if speaking directly to the learner.
    `;

    try {
      const result = await withRetry(async () => {
        return await this.model.generateContent(prompt);
      });
      const response = await result.response;
      const text = response.text();

      // Clean up the script text (remove any markdown artifacts)
      const cleanedScript = text
        .replace(/```[\s\S]*?```/g, '')
        .replace(/\*\*/g, '')
        .replace(/#{1,6}\s/g, '')
        .trim();

      if (!cleanedScript || cleanedScript.length < 20) {
        throw new Error('Generated script is too short or empty');
      }

      return cleanedScript;
    } catch (error) {
      console.error('Error generating video script:', error);
      throw new Error(`Failed to generate video script: ${error}`);
    }
  }
}

export const geminiService = new GeminiService();