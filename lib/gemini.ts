import { GoogleGenerativeAI } from '@google/generative-ai';
import * as SecureStore from 'expo-secure-store';
import { generateContentBundle } from '@/server/agents/DynamicContent';
import { aiService } from '@/lib/aiService';

// Helper to get API key from SecureStore
async function getAPIKey(provider: 'gemini' | 'groq'): Promise<string | null> {
  try {
    const key = await SecureStore.getItemAsync(`api_key_${provider}`);
    return key && key.trim() ? key : null;
  } catch (error) {
    console.error(`Failed to retrieve ${provider} API key:`, error);
    return null;
  }
}

// Utility function to sanitize JSON strings by removing control characters
// This fixes issues with Groq and other LLMs that may include control characters in JSON responses
function sanitizeJsonString(jsonStr: string): string {
  // Remove ALL control characters (U+0000 through U+001F)
  // This includes tabs, newlines, carriage returns, etc.
  // While this removes formatting, it prevents JSON parse errors
  // caused by unescaped control characters from LLM responses
  return jsonStr.replace(/[\x00-\x1F]/g, '');
}

// Legacy retry function (now handled by aiService)
async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  delayMs: number = 2000
): Promise<T> {
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.warn(`⚠️ Attempt ${attempt}/${maxRetries} failed:`, lastError.message);
      
      if (attempt < maxRetries) {
        console.log(`⏳ Waiting ${delayMs}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
        delayMs = Math.floor(delayMs * 1.5); // Exponential backoff
      }
    }
  }
  
  throw lastError || new Error('Operation failed after retries');
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
  // Track which content generation failed
  failedTones?: {
    default: boolean;
    simplified: boolean;
    story: boolean;
  };
}

export class GeminiService {
  async generateKnowledgeGraph(topic: string, preferences?: string): Promise<KnowledgeGraph> {
    // Build preferences context with stronger emphasis
    let preferencesContext = '';
    let skipBasicsInstruction = '';
    
    if (preferences && preferences.trim()) {
      const lowerPrefs = preferences.toLowerCase();
      
      // Detect different user preferences
      const wantsBasicOnly = lowerPrefs.includes('only basic') || lowerPrefs.includes('show only basic') || 
                             lowerPrefs.includes('just basic') || lowerPrefs.includes('basic only') ||
                             lowerPrefs.includes('beginner');
      const skipBasics = lowerPrefs.includes('skip basic') || lowerPrefs.includes('skip the basic') || 
                         lowerPrefs.includes('already know') || lowerPrefs.includes('go advanced') ||
                         lowerPrefs.includes('skip fundamentals');
      const skipAdvanced = lowerPrefs.includes('skip advanced') || lowerPrefs.includes('no advanced') ||
                           lowerPrefs.includes('without advanced');
      const focusAdvanced = lowerPrefs.includes('advanced') && !skipAdvanced && !wantsBasicOnly;
      
      if (wantsBasicOnly) {
        skipBasicsInstruction = `
        
        🚨 CRITICAL INSTRUCTION:
        The user wants ONLY BASIC/BEGINNER level content. EXCLUDE all advanced and intermediate topics.
        
        DO NOT INCLUDE:
        - Advanced topics (like Redux, GraphQL, TypeScript advanced features, etc.)
        - Intermediate topics (like complex state management, advanced patterns)
        - Expert-level concepts
        
        ONLY INCLUDE:
        - Basic fundamentals (HTML, CSS, basic JavaScript)
        - Introductory concepts
        - Elementary prerequisites
        - Beginner-friendly topics
        - Foundation-level knowledge
        
        ALL prerequisites must have difficulty: "basic" ONLY.
        Focus on building a strong foundation for absolute beginners.
        `;
      } else if (skipBasics || focusAdvanced) {
        skipBasicsInstruction = `
        
        🚨 CRITICAL INSTRUCTION:
        The user wants to SKIP BASICS and focus on ${focusAdvanced ? 'ADVANCED/COMPLEX' : 'INTERMEDIATE TO ADVANCED'} topics.
        
        DO NOT INCLUDE:
        - Basic fundamentals (e.g., for React: skip HTML, CSS, basic JavaScript)
        - Introductory concepts the user likely already knows
        - Elementary prerequisites that are too foundational
        
        INSTEAD, INCLUDE:
        - Intermediate to advanced prerequisites only
        - Specialized, in-depth topics
        - Advanced patterns, architectures, and techniques
        - Expert-level concepts and best practices
        
        Start from an intermediate baseline - assume the user has foundational knowledge.
        `;
      } else if (skipAdvanced) {
        skipBasicsInstruction = `
        
        🚨 CRITICAL INSTRUCTION:
        The user wants to SKIP ADVANCED topics and focus on BASIC TO INTERMEDIATE content.
        
        DO NOT INCLUDE:
        - Advanced topics (Redux, GraphQL, advanced TypeScript, etc.)
        - Expert-level concepts
        - Complex architectures
        
        INCLUDE:
        - Basic fundamentals
        - Intermediate topics
        - Practical, commonly-used features
        
        Focus on "difficulty": "basic" and "intermediate" ONLY.
        `;
      }
      
      preferencesContext = `
      
      📝 USER PREFERENCES & INSTRUCTIONS (HIGHEST PRIORITY):
      "${preferences}"
      ${skipBasicsInstruction}
      
      MANDATORY - Follow these preferences strictly:
      - If they say "only basic" or "beginner" → ONLY include basic-level prerequisites, EXCLUDE intermediate and advanced
      - If they say "skip basics" or "go advanced" → EXCLUDE all basic/fundamental prerequisites
      - If they say "skip advanced" → EXCLUDE all advanced prerequisites, keep basic and intermediate
      - If they mention specific technologies → Include only those and related topics
      - If they mention areas to focus on → Make those the PRIMARY focus, 80% of content
      - If they mention areas they know → COMPLETELY EXCLUDE those from prerequisites
      - Tailor the entire learning path to their exact stated goals and preferences
      `;
    }

    const prompt = `
      Create a knowledge graph and learning roadmap for "${topic}".
      ${preferencesContext}
      
      Generate a learning path that:
      1. Provides a clear description of what "${topic}" is
      2. Lists prerequisites needed to learn this topic effectively
      3. Organizes prerequisites by difficulty (basic, intermediate, advanced)
      4. Estimates learning hours for each prerequisite
      5. Creates a logical progression
      
      ${preferences ? `⚠️ CRITICAL: User preferences are ABSOLUTE and OVERRIDE all default recommendations.
      - If user says "only basic" → ONLY include prerequisites with difficulty: "basic"
      - If user says "skip advanced" → ONLY include prerequisites with difficulty: "basic" or "intermediate"
      - If user says "skip basics" → ONLY include prerequisites with difficulty: "intermediate" or "advanced"
      Follow their exact instructions about difficulty levels. DO NOT deviate.` : 'Include all prerequisites from basic to advanced for a comprehensive learning path.'}

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

      ${preferences ? '🎯 Remember: User preferences are ABSOLUTE. Respect their stated goals about difficulty levels completely. If they want only basic, DO NOT include any intermediate or advanced topics.' : 'Make prerequisites comprehensive and cover all foundational knowledge.'}
    `;

    try {
      const text = await aiService.generateContent({ prompt });
      
      // Parse JSON response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Invalid JSON response from AI');
      }
      
      const sanitizedJson = sanitizeJsonString(jsonMatch[0]);
      const knowledgeGraph = JSON.parse(sanitizedJson) as KnowledgeGraph;
      
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
      const text = await aiService.generateContent({ prompt });
      
      // Parse JSON response
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        throw new Error('Invalid JSON response from AI');
      }
      
      const sanitizedJson = sanitizeJsonString(jsonMatch[0]);
      const questions = JSON.parse(sanitizedJson) as QuizQuestion[];
      
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
    
    const subtopicCount = subtopics.length;
    const minQuestionsPerSubtopic = 2;
    const maxQuestionsPerSubtopic = 3;
    const totalMinQuestions = subtopicCount * minQuestionsPerSubtopic;
    const totalMaxQuestions = subtopicCount * maxQuestionsPerSubtopic;
    
    const prompt = `
      Create a comprehensive quiz for "${topicName}" in the context of learning "${context}".
      
      🎯 CRITICAL REQUIREMENTS FOR COMPLETE COVERAGE:
      Generate ${minQuestionsPerSubtopic}-${maxQuestionsPerSubtopic} questions for EACH of the following ${subtopicCount} subtopics.
      Total questions: ${totalMinQuestions}-${totalMaxQuestions} questions
      
      SUBTOPICS TO COVER (ALL ${subtopicCount} MUST have questions):
      ${subtopicsList}
      
      📋 MANDATORY RULES:
      1. EVERY SINGLE subtopic listed above MUST have at least ${minQuestionsPerSubtopic} questions
      2. Questions can test multiple subtopics (use subtopicNames array for this)
      3. Create ONLY multiple choice questions with 5 options each (4 regular + "Not sure")
      4. Questions should test deep understanding, not just memorization
      5. Make questions practical and relevant to real-world scenarios
      6. Difficulty level: ${difficulty}
      7. Verify at the end that ALL ${subtopicCount} subtopics are covered!
      
      Return ONLY valid JSON array (no markdown, no code blocks, no extra text):
      [
        {
          "id": "unique-question-id",
          "content": "Question text here",
          "type": "multiple_choice",
          "difficulty": "${difficulty}",
          "subtopicName": "exact subtopic name from the list above",
          "subtopicNames": ["subtopic1", "subtopic2"],
          "data": {
            "options": ["Option A", "Option B", "Option C", "Option D", "Not sure"],
            "correct": 0,
            "explanation": "Why this answer is correct and how it relates to the subtopic(s)"
          }
        }
      ]
      
      ⚠️ VERIFICATION CHECKLIST BEFORE SUBMITTING:
      - Does EVERY subtopic from the list have at least ${minQuestionsPerSubtopic} questions? ✓
      - Are there ${totalMinQuestions}-${totalMaxQuestions} total questions? ✓
      - Do all questions include "Not sure" as the 5th option? ✓
      - Are subtopicNames arrays used for questions testing multiple concepts? ✓
    `;

    // aiService already has retry logic built-in
    const text = await aiService.generateContent({ prompt });
      
      // Log raw response for debugging
      console.log('📝 AI raw response length:', text.length);
      console.log('📝 AI response first 200 chars:', text.substring(0, 200));
      
      // Check if response is empty or starts with error indicators
      if (!text || text.trim().length === 0) {
        throw new Error('Empty response from AI');
      }
      
      // Check for common error patterns
      if (text.startsWith('Unable') || text.startsWith('Unavailable') || text.startsWith('Unfortunately')) {
        throw new Error(`AI error: ${text.substring(0, 100)}`);
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
        throw new Error('Invalid JSON response from AI - no array found');
      }
      
      let questions: QuizQuestion[];
      try {
        const sanitizedJson = sanitizeJsonString(jsonMatch[0]);
        questions = JSON.parse(sanitizedJson) as QuizQuestion[];
      } catch (parseError) {
        console.error('📛 JSON parse error:', parseError);
        console.error('📛 Attempted to parse:', jsonMatch[0].substring(0, 500));
        throw new Error(`Failed to parse quiz JSON: ${parseError}`);
      }
      
      // Validate questions structure
      if (!Array.isArray(questions) || questions.length === 0) {
        throw new Error('Invalid questions structure - empty array');
      }
      
      // Map subtopic names to IDs and verify coverage
      const subtopicCoverage = new Map<string, number>();
      subtopics.forEach(st => subtopicCoverage.set(st.id, 0));
      
      questions.forEach(q => {
        const matchingSubtopic = subtopics.find(
          st => st.name.toLowerCase() === q.subtopicName?.toLowerCase()
        );
        if (matchingSubtopic) {
          q.subtopicId = matchingSubtopic.id;
          subtopicCoverage.set(matchingSubtopic.id, (subtopicCoverage.get(matchingSubtopic.id) || 0) + 1);
        }
      });
      
      // Log coverage statistics
      const uncoveredSubtopics = Array.from(subtopicCoverage.entries())
        .filter(([_, count]) => count === 0)
        .map(([id, _]) => subtopics.find(st => st.id === id)?.name);
      
      if (uncoveredSubtopics.length > 0) {
        console.warn(`⚠️ WARNING: ${uncoveredSubtopics.length} subtopics not covered in quiz:`, uncoveredSubtopics);
      }
      
      const coverageStats = Array.from(subtopicCoverage.entries())
        .map(([id, count]) => {
          const name = subtopics.find(st => st.id === id)?.name;
          return `${name}: ${count} questions`;
        });
      
      console.log(`✅ Generated ${questions.length} quiz questions from ${subtopics.length} subtopics`);
      console.log(`📊 Coverage:`, coverageStats.join(', '));
      return questions;
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
      return await aiService.generateContent({ prompt });
    } catch (error) {
      console.error('Error generating feedback:', error);
      return 'Keep up the great work! Focus on practicing the fundamentals and you\'ll master this topic.';
    }
  }

  async generateTopicExplanation(
    topicName: string, 
    context: string,
    subtopicPerformance?: Array<{ subtopicName: string; status: string; accuracy: number }>,
    userPreferences?: string
  ): Promise<TopicExplanation> {
    console.log(`🎯 [Content Agent] Delegating content generation to agent for "${topicName}"`);
    if (userPreferences) {
      console.log(`📝 [Content Agent] User preferences: ${userPreferences}`);
    }
    
    // Use the content agent to orchestrate parallel content generation
    const result = await generateContentBundle(topicName, context, subtopicPerformance, userPreferences);
    
    if (!result) {
      throw new Error('Failed to generate content bundle - received null result');
    }
    
    console.log(`✅ [Content Agent] Content generation complete via agent for "${topicName}"`);
    return result;
  }

  // Generate default/normal content
  async generateDefaultContent(
    topicName: string,
    context: string,
    subtopicPerformance?: Array<{ subtopicName: string; status: string; accuracy: number }>,
    userPreferences?: string,
    specificSubtopics?: string[] // NEW: If provided, only generate these subtopics
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
           : `❌ COMPREHENSIVE DEEP TEACHING: 5-8 FULL DETAILED PARAGRAPHS covering:
              * Fundamental concepts with thorough explanations
              * Step-by-step breakdowns of how it works
              * WHY this concept matters and common use cases
              * 3-5 DIVERSE examples (beginner, intermediate, real-world)
              * Common mistakes and how to avoid them
              * Best practices and tips for mastery
              * 5-7 key points with detailed explanations
              The weak content MUST be SIGNIFICANTLY longer and more comprehensive!`
         }`
      ).join('\n')}
      
      REQUIREMENTS:
      - Strong subtopics (≥70%): MAX 1 paragraph + 1 basic example (user knows this)
      - Weak/Neutral (<70%): MIN 5-8 DETAILED paragraphs + 3-5 diverse examples + extensive explanations (user struggles here!)
      - Weak content should be 5-8x longer than strong content
      - Content length difference MUST be DRAMATICALLY OBVIOUS
      - Match subtopic titles EXACTLY to names above to apply correct depth
      `;
    }

    // Build preferences guidance for AI
    let preferencesGuidance = '';
    if (userPreferences && userPreferences.trim()) {
      preferencesGuidance = `
      
      📝 USER LEARNING PREFERENCES (Important - incorporate these into content):
      ${userPreferences}
      
      Adapt the content to align with these preferences where applicable.
      `;
    }

    // Build specific subtopics constraint
    let subtopicConstraint = '';
    if (specificSubtopics && specificSubtopics.length > 0) {
      subtopicConstraint = `
      
      🎯 CRITICAL CONSTRAINT - ONLY GENERATE THESE SPECIFIC SUBTOPICS:
${specificSubtopics.map((title, i) => `      ${i + 1}. "${title}"`).join('\n')}
      
      ⚠️ DO NOT generate any other subtopics!
      ⚠️ ONLY generate content for the ${specificSubtopics.length} subtopic${specificSubtopics.length > 1 ? 's' : ''} listed above!
      ⚠️ Use EXACTLY these titles, do not change them!
      ⚠️ The response MUST contain ONLY ${specificSubtopics.length} subtopic${specificSubtopics.length > 1 ? 's' : ''}!
      `;
    }
    
    const prompt = `
      Create a comprehensive, educational explanation for the topic "${topicName}" in the context of learning "${context}".
      ${performanceGuidance}
      ${preferencesGuidance}
      ${subtopicConstraint}
      
      Provide:
      1. A clear overview of what ${topicName} is
      2. Why someone learning ${context} should understand ${topicName}
      3. ${specificSubtopics && specificSubtopics.length > 0 
          ? `THE FOLLOWING ${specificSubtopics.length} SPECIFIC SUBTOPIC${specificSubtopics.length > 1 ? 'S' : ''} (and ONLY these):`
          : '5-8 UNIQUE key subtopics/concepts within ${topicName}'}
         ${specificSubtopics && specificSubtopics.length > 0
           ? specificSubtopics.map((title, i) => `\n         ${i + 1}. "${title}"`).join('')
           : `
         ⚠️ CRITICAL: Each subtopic MUST have a UNIQUE, SPECIFIC title
         ⚠️ DO NOT repeat subtopic names like "Basic HTML", "Basic HTML", "Basic HTML"
         ⚠️ Examples of GOOD unique titles: "HTML Document Structure", "Common HTML Tags", "HTML Attributes", "Semantic HTML Elements"
         ⚠️ Examples of BAD duplicate titles: "Basic HTML", "Basic HTML", "HTML Elements", "HTML Elements"`
         }
      4. For EACH subtopic, provide:
         - A clear, balanced explanation ${subtopicPerformance ? '(LENGTH MUST VARY based on performance data above!)' : ''}
         - A practical code example (if applicable)
         - Explanation of the example
         - 2-3 key points to remember
      5. Best practices when using/applying ${topicName}
      6. Common mistakes/pitfalls to avoid
      7. Suggested resources for deeper learning
      
      ${subtopicPerformance && subtopicPerformance.length > 0 
        ? '🔥🔥🔥 CRITICAL: Strong subtopics = SHORT (1 paragraph), Weak subtopics = VERY LONG (5-8 detailed paragraphs with extensive examples and explanations). The difference MUST be DRAMATIC - weak content should be 5-8x longer!'
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
      
      CRITICAL: Use sequential IDs starting from "subtopic-1", "subtopic-2", "subtopic-3", etc.
      Do NOT use slugified titles as IDs.
      
      Make content educational, accurate, and engaging.
    `;

    try {
      const text = await aiService.generateContent({ prompt });
      
      // Parse JSON response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Invalid JSON response from AI');
      }
      
      const sanitizedJson = sanitizeJsonString(jsonMatch[0]);
      const explanation = JSON.parse(sanitizedJson) as RawTopicExplanation;
      
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
    subtopicPerformance?: Array<{ subtopicName: string; status: string; accuracy: number }>,
    canonicalTitles?: string[],
    userPreferences?: string
  ): Promise<RawTopicExplanation> {
    let performanceGuidance = '';
    if (subtopicPerformance && subtopicPerformance.length > 0) {
      performanceGuidance = `
      
      📊 User Performance Data (CRITICAL for content depth):
${subtopicPerformance.map(p => 
`      - "${p.subtopicName}": ${Math.round(p.accuracy)}% accuracy (${p.status})
        ${p.status === 'weak' || p.status === 'neutral' 
          ? '→ ELABORATE EXTENSIVELY: 5-8 paragraphs, multiple detailed examples, step-by-step breakdowns, analogies, real-world scenarios'
          : '→ Keep brief: 1-2 paragraphs, simple review'
        }`
      ).join('\n')}
      
      Focus MUCH MORE content, examples, and simpler language on weak areas. Weak subtopics need COMPREHENSIVE teaching!
      `;
    }

    // Add canonical titles guidance if provided
    let titlesGuidance = '';
    if (canonicalTitles && canonicalTitles.length > 0) {
      titlesGuidance = `
      
      🎯 CRITICAL - USE THESE EXACT SUBTOPIC TITLES (in this exact order):
${canonicalTitles.map((title, idx) => `      ${idx + 1}. "${title}"`).join('\n')}
      
      You MUST use these exact titles for your ${canonicalTitles.length} subtopics.
      Do NOT create different titles or add/remove subtopics.
      `;
    }

    // Build preferences guidance for AI
    let preferencesGuidance = '';
    if (userPreferences && userPreferences.trim()) {
      preferencesGuidance = `
      
      📝 USER LEARNING PREFERENCES (Important - incorporate these into content):
      ${userPreferences}
      
      Adapt the simplified content to align with these preferences where applicable.
      `;
    }

    const prompt = `
      Create a SIMPLIFIED, beginner-friendly explanation for the topic "${topicName}" in the context of learning "${context}".
      ${performanceGuidance}
      ${titlesGuidance}
      ${preferencesGuidance}
      
      THIS VERSION IS FOR LEARNERS WHO NEED:
      - Simpler language and clearer explanations
      - MORE examples (2-3 per subtopic)
      - Step-by-step breakdowns
      - Real-world analogies and relatable examples
      
      Provide:
      1. A simple, easy-to-understand overview
      2. Why this topic matters (in simple terms)
      3. ${canonicalTitles ? `EXACTLY ${canonicalTitles.length}` : '5-8'} key subtopics/concepts ${canonicalTitles ? '(using the exact titles provided above)' : ''}
         ${!canonicalTitles ? '⚠️ CRITICAL: Each subtopic MUST have a UNIQUE, SPECIFIC title - NO DUPLICATES!' : ''}
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
      
      CRITICAL REQUIREMENTS:
      1. Use sequential IDs: "subtopic-1", "subtopic-2", "subtopic-3", etc.
      2. ${canonicalTitles ? `Use the EXACT ${canonicalTitles.length} titles listed above - do NOT change them` : 'Keep titles simple and clear'}
      3. Do NOT add or remove subtopics
      4. Do NOT use slugified titles as IDs
      
      Make this version significantly LONGER and SIMPLER than a typical explanation.
    `;

    try {
      const text = await aiService.generateContent({ prompt });
      
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Invalid JSON response from AI');
      }
      
      const sanitizedJson = sanitizeJsonString(jsonMatch[0]);
      const explanation = JSON.parse(sanitizedJson) as RawTopicExplanation;
      
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
    subtopicPerformance?: Array<{ subtopicName: string; status: string; accuracy: number }>,
    canonicalTitles?: string[],
    userPreferences?: string
  ): Promise<RawTopicExplanation> {
    let performanceGuidance = '';
    if (subtopicPerformance && subtopicPerformance.length > 0) {
      performanceGuidance = `
      
      📊 User Quiz Performance - Adjust storytelling depth DRAMATICALLY:
${subtopicPerformance.map(p => 
`      - "${p.subtopicName}": ${Math.round(p.accuracy)}% accuracy (${p.status})
        ${p.status === 'weak' || p.status === 'neutral'
          ? '→ ELABORATE STORY: Multi-chapter narrative with detailed character development, extensive plot points teaching the concept, multiple story-based examples, deeper analogies, and thorough lesson integration (5-8 story paragraphs)'
          : '→ Brief story: Short engaging narrative (1-2 paragraphs)'
        }`
      ).join('\n')}
      
      - Strong areas: Keep story brief and engaging (1-2 paragraphs)
      - Weak areas: Tell an EXTENSIVE, multi-layered educational story with deep analogies and comprehensive teaching (5-8 detailed paragraphs)
      `;
    }

    // Add canonical titles guidance if provided
    let titlesGuidance = '';
    if (canonicalTitles && canonicalTitles.length > 0) {
      titlesGuidance = `
      
      🎯 CRITICAL - USE THESE EXACT SUBTOPIC TITLES (in this exact order):
${canonicalTitles.map((title, idx) => `      ${idx + 1}. "${title}"`).join('\n')}
      
      You MUST use these exact titles for your ${canonicalTitles.length} subtopics.
      Do NOT create different titles or add/remove subtopics.
      The titles stay the same, only the explanation content should be story-based.
      `;
    }

    // Build preferences guidance for AI
    let preferencesGuidance = '';
    if (userPreferences && userPreferences.trim()) {
      preferencesGuidance = `
      
      📝 USER LEARNING PREFERENCES (Important - incorporate these into stories):
      ${userPreferences}
      
      Adapt the story-based content to align with these preferences where applicable.
      `;
    }

    const prompt = `
      Create a STORY-BASED explanation for the topic "${topicName}" in the context of learning "${context}".
      ${performanceGuidance}
      ${titlesGuidance}
      ${preferencesGuidance}
      
      THIS VERSION USES STORYTELLING TO TEACH:
      - Present concepts through engaging narratives
      - Use characters, scenarios, and real-world situations
      - Make abstract concepts concrete through stories
      - Create memorable learning experiences
      
      Provide:
      1. An engaging story-based overview that introduces the topic
      2. Why this topic matters (told through a brief scenario)
      3. ${canonicalTitles ? `EXACTLY ${canonicalTitles.length}` : '5-8'} key subtopics/concepts ${canonicalTitles ? '(using the exact titles provided above)' : ''}
         ${!canonicalTitles ? '⚠️ CRITICAL: Each subtopic MUST have a UNIQUE, SPECIFIC title - NO DUPLICATES!' : ''}
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
      
      CRITICAL REQUIREMENTS:
      1. Use sequential IDs: "subtopic-1", "subtopic-2", "subtopic-3", etc.
      2. ${canonicalTitles ? `Use the EXACT ${canonicalTitles.length} titles listed above - do NOT change them` : 'Keep titles consistent with default version'}
      3. Do NOT add or remove subtopics
      4. Do NOT use slugified titles as IDs
      5. Only the explanation content should be story-based - titles remain factual
      
      Make each subtopic a compelling mini-story that teaches the concept.
    `;

    try {
      const text = await aiService.generateContent({ prompt });
      
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Invalid JSON response from AI');
      }
      
      const sanitizedJson = sanitizeJsonString(jsonMatch[0]);
      const explanation = JSON.parse(sanitizedJson) as RawTopicExplanation;
      
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

  // Generate humor/entertaining content to combat boredom
  async generateHumorContent(
    topicName: string,
    context: string,
    subtopicPerformance?: Array<{ subtopicName: string; status: string; accuracy: number }>,
    canonicalTitles?: string[],
    userPreferences?: string
  ): Promise<RawTopicExplanation> {
    let performanceGuidance = '';
    if (subtopicPerformance && subtopicPerformance.length > 0) {
      performanceGuidance = `
      
      📊 User Quiz Performance - Adjust humor and depth:
${subtopicPerformance.map(p => 
`      - "${p.subtopicName}": ${Math.round(p.accuracy)}% accuracy (${p.status})
        ${p.status === 'weak' || p.status === 'neutral'
          ? '→ EXTRA HILARIOUS & COMPREHENSIVE: 5-8 paragraphs of comedy gold mixed with deep teaching, multiple funny examples, witty analogies, and entertaining explanations that make learning stick'
          : '→ Quick funny review: 1-2 paragraphs with light humor'
        }`
      ).join('\n')}
      
      Make weak areas extra fun and engaging with MUCH MORE humor, interactive examples, and comprehensive funny explanations!
      `;
    }

    // Add canonical titles guidance if provided
    let titlesGuidance = '';
    if (canonicalTitles && canonicalTitles.length > 0) {
      titlesGuidance = `
      
      🎯 CRITICAL - USE THESE EXACT SUBTOPIC TITLES (in this exact order):
${canonicalTitles.map((title, idx) => `      ${idx + 1}. "${title}"`).join('\n')}
      
      You MUST use these exact titles for your ${canonicalTitles.length} subtopics.
      Do NOT create different titles or add/remove subtopics.
      The titles stay the same, only make the explanation content funny and engaging.
      `;
    }

    // Build preferences guidance for AI
    let preferencesGuidance = '';
    if (userPreferences && userPreferences.trim()) {
      preferencesGuidance = `
      
      📝 USER LEARNING PREFERENCES (Important - incorporate into humor content):
      ${userPreferences}
      
      Adapt the humorous content to align with these preferences where applicable.
      `;
    }

    const prompt = `
      Create a FUNNY, ENTERTAINING, and HUMOROUS explanation for the topic "${topicName}" in the context of learning "${context}".
      ${performanceGuidance}
      ${titlesGuidance}
      ${preferencesGuidance}
      
      ⚠️ THIS VERSION MUST BE HILARIOUS AND ENGAGING TO COMBAT LEARNER BOREDOM:
      - Use jokes, puns, and witty remarks throughout
      - Include funny analogies and pop culture references
      - Add memes-style humor and relatable developer jokes
      - Use playful language while still being educational
      - Make learning feel like entertainment, not a chore
      - Include "fun facts" and amusing observations
      - Add humorous warnings about common mistakes
      - Use emojis to add personality 🚀 😂 🎉
      
      Provide:
      1. A funny, attention-grabbing overview (with a joke or pun)
      2. Why this topic matters (make it entertaining and relatable)
      3. ${canonicalTitles ? `EXACTLY ${canonicalTitles.length}` : '5-8'} key subtopics/concepts ${canonicalTitles ? '(using the exact titles provided above)' : ''}
         ${!canonicalTitles ? '⚠️ CRITICAL: Each subtopic MUST have a UNIQUE, SPECIFIC title - NO DUPLICATES!' : ''}
      4. For EACH subtopic:
         - A FUNNY explanation that makes the concept memorable through humor
         - Include jokes, puns, or witty observations
         - Use amusing real-world analogies (like comparing code to pizza ordering 🍕)
         - A practical example with humorous comments in the code
         - 2-3 key points delivered with wit and charm
      5. Best practices (delivered as "Pro tips from a fellow developer who learned the hard way 😅")
      6. Common mistakes (as "Hilarious ways people mess this up - don't be that person!")
      7. Fun resources with quirky descriptions
      
      Make it educational BUT PRIMARILY ENTERTAINING!
      Think: "If a stand-up comedian who codes had to teach this..."
      
      Return ONLY valid JSON in this exact format:
      {
        "topicName": "${topicName}",
        "overview": "Funny, engaging overview with humor and emojis",
        "difficulty": "basic|intermediate|advanced",
        "whyLearn": "Entertaining take on why this matters (with a joke)",
        "subtopics": [
          {
            "id": "subtopic-1",
            "title": "Subtopic name",
            "explanation": "Hilarious explanation with jokes, puns, and wit while still teaching the concept. Include emojis and pop culture references where appropriate! 🎯",
            "example": "Code example with funny comments like // This is where the magic happens ✨ or // If this breaks, blame the rubber duck 🦆",
            "exampleExplanation": "Witty explanation of the code that makes you smile",
            "keyPoints": ["Funny key point 1 😎", "Amusing observation 2 🎉", "Witty takeaway 3 🚀"]
          }
        ],
        "bestPractices": ["Pro tip 1 (with humor)", "Pro tip 2 (with a joke)"],
        "commonPitfalls": ["Hilarious mistake 1 (how to avoid it)", "Amusing blunder 2 (the fix)"],
        "resources": ["Fun resource 1", "Entertaining resource 2"]
      }
      
      CRITICAL REQUIREMENTS:
      1. Use sequential IDs: "subtopic-1", "subtopic-2", "subtopic-3", etc.
      2. ${canonicalTitles ? `Use the EXACT ${canonicalTitles.length} titles listed above - do NOT change them` : 'Keep titles consistent'}
      3. Do NOT add or remove subtopics
      4. Do NOT use slugified titles as IDs
      5. MUST be genuinely funny - not just add "haha" or "(funny)" - actual wit and humor!
      6. Include relevant emojis throughout the content
      
      Remember: The goal is to make learning FUN so the user stays engaged! 🎮
    `;

    try {
      const text = await aiService.generateContent({ prompt });
      
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Invalid JSON response from AI');
      }
      
      const sanitizedJson = sanitizeJsonString(jsonMatch[0]);
      const explanation = JSON.parse(sanitizedJson) as RawTopicExplanation;
      
      if (!explanation.topicName || !explanation.overview || !explanation.subtopics) {
        throw new Error('Invalid humor explanation structure');
      }
      
      console.log(`✅ Generated HUMOR content with ${explanation.subtopics.length} subtopics`);
      return explanation;
    } catch (error) {
      console.error('Error generating humor topic explanation:', error);
      throw new Error(`Failed to generate humor topic explanation: ${error}`);
    }
  }

  /**
   * Generate a video script for HeyGen based on topic subtopics
   * Creates an educational video script of specified length
   * @param tone - The tone/style of the script (default, simplified, or story)
   * @param lengthInSeconds - The desired length of the video in seconds (default: 120)
   */
  async generateVideoScript(
    topicName: string,
    context: string,
    subtopics: TopicSubtopic[],
    tone: 'default' | 'simplified' | 'story' = 'default',
    lengthInSeconds: number = 120
  ): Promise<string> {
    let toneGuidance = '';
    
    if (tone === 'simplified') {
      toneGuidance = `
Use SIMPLE, beginner-friendly language.
Avoid technical jargon. Explain as if to someone just starting out.
Be encouraging and welcoming.
Include relatable examples and analogies.`;
    } else if (tone === 'story') {
      toneGuidance = `
Use a STORYTELLING approach.
Create engaging scenarios or narratives that introduce each concept.
Make it relatable through stories and real-world examples.
Build a narrative arc throughout the video.`;
    } else {
      toneGuidance = `
Use a professional, educational tone.
Be clear and informative while maintaining accuracy.
Include practical examples and key insights.`;
    }

    // Calculate word count based on speaking rate (~140 words per minute average)
    const targetWordCount = Math.round((lengthInSeconds / 60) * 140);
    const hookDuration = Math.round(lengthInSeconds * 0.12); // 12% for hook
    const introDuration = Math.round(lengthInSeconds * 0.18); // 18% for intro
    const mainDuration = Math.round(lengthInSeconds * 0.53); // 53% for main content
    const practicalDuration = Math.round(lengthInSeconds * 0.12); // 12% for practical
    const conclusionDuration = Math.round(lengthInSeconds * 0.05); // 5% for conclusion
    
    const prompt = `
Create a comprehensive, engaging script for a ${lengthInSeconds} second (${Math.floor(lengthInSeconds / 60)} minutes ${lengthInSeconds % 60} seconds) educational video about "${topicName}" in the context of learning "${context}".
${toneGuidance}

The script should be approximately ${targetWordCount} words (speaking pace: ~140 words per minute for ${lengthInSeconds} seconds).

Structure the script as follows:
1. Opening Hook (${hookDuration} seconds): Grab attention with an interesting fact or question about ${topicName}
2. Introduction (${introDuration} seconds): Explain what ${topicName} is and why it matters for ${context}
3. Main Content (${mainDuration} seconds): Cover the key subtopics below, with clear explanations and examples
4. Practical Application (${practicalDuration} seconds): Show how to apply this knowledge in real scenarios
5. Conclusion & Call-to-Action (${conclusionDuration} seconds): Summarize key takeaways and encourage practice

Cover these subtopics in the main content section:
${JSON.stringify(subtopics.map(s => ({ title: s.title, explanation: s.explanationDefault?.substring(0, 150) + '...' })), null, 2)}

Requirements:
- Write in a conversational, engaging style as if speaking directly to the learner
- Use transitions between sections to maintain flow
- Include ${lengthInSeconds >= 180 ? '2-3' : lengthInSeconds >= 120 ? '1-2' : '1'} concrete example${lengthInSeconds >= 120 ? 's' : ''} throughout
- Keep sentences concise and easy to understand when spoken aloud
- Avoid overly complex vocabulary
- Include natural pauses (indicated by periods and paragraph breaks)
- Focus on the most important points given the ${lengthInSeconds} second time constraint
${lengthInSeconds <= 90 ? '- Keep explanations brief and focus only on essential concepts' : ''}
${lengthInSeconds >= 240 ? '- Provide more detailed explanations with additional examples and context' : ''}

Output ONLY the script text ready for voice narration. Do NOT include:
- JSON formatting
- Markdown headers or formatting
- Section labels like "Introduction:" or "Section 1:"
- Bullets or numbered lists
- Stage directions or meta-commentary

CRITICAL: The script MUST be approximately ${targetWordCount} words to achieve ${lengthInSeconds} seconds of speaking time.
Count your words carefully. Too short = video ends abruptly. Too long = video gets cut off.

The script should flow naturally as continuous narration that a presenter would speak.
    `;

    try {
      const result = await withRetry(async () => {
        const text = await aiService.generateContent({ prompt });
        return { response: { text: () => text } };
      });
      const response = await result.response;
      const text = response.text();

      // Clean up the script text (remove any markdown artifacts)
      const cleanedScript = text
        .replace(/```[\s\S]*?```/g, '')
        .replace(/\*\*/g, '')
        .replace(/#{1,6}\s/g, '')
        .replace(/^\s*[-*]\s+/gm, '') // Remove bullet points
        .replace(/^\s*\d+\.\s+/gm, '') // Remove numbered lists
        .trim();

      const minLength = Math.round(lengthInSeconds * 2); // Roughly 2 chars per second minimum
      if (!cleanedScript || cleanedScript.length < minLength) {
        throw new Error(`Generated script is too short for a ${lengthInSeconds} second video (minimum ${minLength} characters)`);
      }

      return cleanedScript;
    } catch (error) {
      console.error('Error generating video script:', error);
      throw new Error(`Failed to generate video script: ${error}`);
    }
  }
}

export const geminiService = new GeminiService();