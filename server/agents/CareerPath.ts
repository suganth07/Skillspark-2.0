// CareerPath.ts - Agent for generating career path topics
import { aiService } from "@/lib/aiService";

// ------------------------------
// Career Path Types
// ------------------------------
export interface CareerTopic {
  id: string;
  name: string;
  description: string;
  category: string; // e.g., "Frontend", "Backend", "DevOps", "Soft Skills"
  difficulty: 'basic' | 'intermediate' | 'advanced';
  estimatedHours: number;
  order: number;
  isCore: boolean; // Is this a core skill or optional?
  prerequisites: string[]; // Names of prerequisite topics
}

export interface CareerPathResult {
  roleName: string;
  roleDescription: string;
  totalEstimatedHours: number;
  categories: string[];
  topics: CareerTopic[];
}

// ------------------------------
// Helper: Retry with exponential backoff
// ------------------------------
async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  delayMs: number = 1000,
  context: string = 'operation'
): Promise<T> {
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.warn(`⚠️ ${context} - Attempt ${attempt}/${maxRetries} failed:`, lastError.message);
      
      if (attempt < maxRetries) {
        console.log(`⏳ Retrying ${context} in ${delayMs}ms...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
        delayMs *= 1.5; // Exponential backoff
      }
    }
  }
  
  throw lastError || new Error(`${context} failed after ${maxRetries} attempts`);
}

// ------------------------------
// Main Agent: Generate Career Path Topics
// ------------------------------
export interface CareerPathGenerationOptions {
  roleName: string;
  currentLevel?: string;      // e.g., "Junior Developer", "SE2", "Mid-level"
  targetLevel?: string;       // e.g., "Senior Developer", "SE3", "Staff Engineer"
  preferences?: string;       // User's specific requests/preferences
}

export async function generateCareerPath(options: CareerPathGenerationOptions): Promise<CareerPathResult> {
  const { roleName, currentLevel, targetLevel, preferences } = options;
  console.log("🎯 Career Path Agent: Starting topic generation for:", roleName);
  
  // Build context for level transition
  let levelContext = '';
  if (currentLevel && targetLevel) {
    levelContext = `
    
    🎯 LEVEL TRANSITION:
    The user is currently at: "${currentLevel}"
    The user wants to reach: "${targetLevel}"
    
    Focus on the GAP between these levels:
    - What skills differentiate ${currentLevel} from ${targetLevel}?
    - What responsibilities increase at ${targetLevel}?
    - What knowledge gaps typically exist when transitioning between these levels?
    - Prioritize topics that will help them grow from their current level to the target level.
    `;
  } else if (currentLevel) {
    levelContext = `
    
    📍 CURRENT LEVEL: "${currentLevel}"
    The user is already at this level and wants to advance. Focus on skills for promotion and growth.
    `;
  } else if (targetLevel) {
    levelContext = `
    
    🎯 TARGET LEVEL: "${targetLevel}"
    Focus on skills required to achieve this specific level/seniority.
    `;
  }

  // Build preferences context with stronger emphasis
  let preferencesContext = '';
  if (preferences && preferences.trim()) {
    const lowerPrefs = preferences.toLowerCase();
    const skipBasics = lowerPrefs.includes('skip basic') || lowerPrefs.includes('skip the basic') || 
                       lowerPrefs.includes('already know') || lowerPrefs.includes('skip fundamentals');
    const focusAreas = lowerPrefs.match(/focus on ([^,\.]+)/i);
    const skipAreas = lowerPrefs.match(/skip ([^,\.]+)/i);
    
    let specificInstructions = '';
    if (skipBasics) {
      specificInstructions += `
      🚨 CRITICAL: User wants to SKIP BASICS.
      - DO NOT include introductory/fundamental topics they likely already know
      - Start from intermediate level topics
      - Focus on advanced concepts, patterns, and specialized knowledge
      `;
    }
    if (focusAreas) {
      specificInstructions += `
      🎯 FOCUS PRIORITY: "${focusAreas[1].trim()}"
      - Make this the PRIMARY focus (60-70% of topics)
      - Include deep, specialized topics in this area
      - Prioritize these topics in the learning sequence
      `;
    }
    if (skipAreas) {
      specificInstructions += `
      ⛔ EXCLUDE: "${skipAreas[1].trim()}"
      - Completely omit topics in this area
      - The user either knows this or doesn't need it
      `;
    }
    
    preferencesContext = `
    
    📝 USER PREFERENCES & INSTRUCTIONS (ABSOLUTE PRIORITY):
    "${preferences}"
    ${specificInstructions}
    
    MANDATORY - Follow user preferences strictly:
    - If they mention specific technologies → Include ONLY those and directly related topics
    - If they mention areas to focus on → Make those 60-80% of the learning path
    - If they mention areas to skip/already know → COMPLETELY EXCLUDE those topics
    - If they want advanced only → Exclude all basic/introductory topics
    - Preferences override standard curriculum - be aggressive in customization
    `;
  }

  const prompt = `
    You are an expert career advisor and curriculum designer. Generate a comprehensive learning path for someone who wants to become a "${roleName}".
    ${levelContext}
    ${preferencesContext}

    Analyze this role and provide:
    1. A clear description of what this role entails
    2. 12-20 essential topics they need to learn (mix of technical and soft skills)
    3. Organize topics by categories (e.g., "Frontend", "Backend", "DevOps", "Databases", "Soft Skills", etc.)
    4. Mark which topics are CORE (must-learn) vs OPTIONAL (nice-to-have)
    5. Specify difficulty levels (basic, intermediate, advanced)
    6. Estimate learning hours for each topic
    7. Define prerequisites between topics (which topics should be learned before others)
    8. Order topics in a logical learning sequence

    Consider:
    - Industry standards and current trends
    - Practical skills needed for real-world work
    - Balance between theoretical knowledge and hands-on skills
    - Soft skills and professional development
    - Tools and technologies commonly used in this role
    ${currentLevel && targetLevel ? `- Specific skills needed to transition from ${currentLevel} to ${targetLevel}` : ''}

    Return ONLY valid JSON in this exact format:
    {
      "roleName": "${roleName}",
      "roleDescription": "Detailed description of what this role involves (2-3 sentences)",
      "totalEstimatedHours": 500,
      "categories": ["Category1", "Category2", "Category3"],
      "topics": [
        {
          "id": "topic-1",
          "name": "Topic Name",
          "description": "What this topic covers and why it's important (1-2 sentences)",
          "category": "Category Name",
          "difficulty": "basic|intermediate|advanced",
          "estimatedHours": 20,
          "order": 1,
          "isCore": true,
          "prerequisites": []
        },
        {
          "id": "topic-2",
          "name": "Another Topic",
          "description": "Description",
          "category": "Category Name",
          "difficulty": "intermediate",
          "estimatedHours": 30,
          "order": 2,
          "isCore": true,
          "prerequisites": ["Topic Name"]
        }
      ]
    }

    Make sure:
    - Topics are ordered logically (basic → intermediate → advanced)
    - Prerequisites reference topic names, not IDs
    - Each topic has a unique, descriptive name
    - Categories are relevant to the role
    - Estimated hours are realistic
    - Mix technical and non-technical topics
    - Include 12-20 topics total
    ${preferences ? '- Incorporate user preferences where applicable' : ''}
  `;

  try {
    const text = await withRetry(
      async () => {
        return await aiService.generateContent({ prompt });
      },
      3,
      1000,
      `Career Path Generation for ${roleName}`
    );

    // Extract JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Invalid JSON response from Gemini');
    }

    const careerPath = JSON.parse(jsonMatch[0]) as CareerPathResult;

    // Validate response structure
    if (!careerPath.roleName || !careerPath.topics || careerPath.topics.length === 0) {
      throw new Error('Invalid career path structure');
    }

    console.log(`✅ Career Path Agent: Generated ${careerPath.topics.length} topics for ${roleName}`);
    console.log(`📊 Categories: ${careerPath.categories.join(', ')}`);
    console.log(`⏱️ Total estimated hours: ${careerPath.totalEstimatedHours}`);

    return careerPath;
  } catch (error) {
    console.error('❌ Career path generation error:', error);
    throw new Error(`Failed to generate career path for ${roleName}: ${error}`);
  }
}
