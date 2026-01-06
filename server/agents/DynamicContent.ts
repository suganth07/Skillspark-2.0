// DynamicContent.ts - Agent for parallel content generation (React Native compatible)
import { geminiService } from "@/lib/gemini";
import type { TopicExplanation, RawTopicExplanation, RawSubtopic } from "@/lib/gemini";

// ------------------------------
// Content Generation Types
// ------------------------------
export type ContentTone = 'default' | 'simplified' | 'story';

export interface ContentGenerationResult {
  tone: ContentTone;
  content: RawTopicExplanation | null;
  error: string | null;
  status: 'success' | 'failed';
}

// ------------------------------
// Agent State Type
// ------------------------------
interface ContentAgentState {
  topic: string;
  context: string;
  subtopicPerformance?: Array<{ subtopicName: string; status: string; accuracy: number }>;
  userPreferences?: string;
  defaultContent: RawTopicExplanation | null;
  simplifiedContent: RawTopicExplanation | null;
  storyContent: RawTopicExplanation | null;
}

// ------------------------------
// Helper: Retry with exponential backoff and proper delays
// ------------------------------
async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  initialDelayMs: number = 2000,
  context: string = 'operation'
): Promise<T | null> {
  let lastError: Error | null = null;
  let delayMs = initialDelayMs;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.warn(`⚠️ ${context} - Attempt ${attempt}/${maxRetries} failed:`, lastError.message);
      
      if (attempt < maxRetries) {
        console.log(`⏳ Waiting ${delayMs}ms before retry ${attempt + 1}/${maxRetries}...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
        delayMs = Math.floor(delayMs * 1.5); // Exponential backoff: 2s, 3s, 4.5s
      }
    }
  }
  
  console.error(`❌ ${context} failed after ${maxRetries} attempts:`, lastError?.message);
  return null; // Return null instead of throwing
}

// ------------------------------
// Agent Nodes (Content Generators with Retry)
// ------------------------------
async function generateDefaultNode(state: ContentAgentState, specificSubtopics?: string[]): Promise<RawTopicExplanation | null> {
  console.log("🔄 Agent Node: Generating DEFAULT content...");
  if (specificSubtopics && specificSubtopics.length > 0) {
    console.log(`🎯 Constraining to ${specificSubtopics.length} specific subtopic(s): ${specificSubtopics.join(', ')}`);
  }
  
  const content = await withRetry(
    async () => {
      return await geminiService.generateDefaultContent(
        state.topic,
        state.context,
        state.subtopicPerformance,
        state.userPreferences,
        specificSubtopics // Pass the constraint
      );
    },
    3,
    2000, // Start with 2 second delay
    'Default Content Generation'
  );
  
  if (content) {
    console.log("✅ Agent Node: DEFAULT content generated");
  }
  return content;
}

async function generateSimplifiedNode(state: ContentAgentState, canonicalTitles: string[], specificSubtopics?: string[]): Promise<RawTopicExplanation | null> {
  console.log("🔄 Agent Node: Generating SIMPLIFIED content...");
  if (specificSubtopics && specificSubtopics.length > 0) {
    console.log(`🎯 Constraining to ${specificSubtopics.length} specific subtopic(s)`);
  }
  
  // Use specificSubtopics as canonical titles if provided
  const titlesToUse = specificSubtopics && specificSubtopics.length > 0 ? specificSubtopics : canonicalTitles;
  
  const content = await withRetry(
    async () => {
      return await geminiService.generateSimplifiedContent(
        state.topic,
        state.context,
        state.subtopicPerformance,
        titlesToUse, // Use the appropriate titles
        state.userPreferences
      );
    },
    3,
    2000, // Start with 2 second delay
    'Simplified Content Generation'
  );
  
  if (content) {
    console.log("✅ Agent Node: SIMPLIFIED content generated");
  }
  return content;
}

async function generateStoryNode(state: ContentAgentState, canonicalTitles: string[], specificSubtopics?: string[]): Promise<RawTopicExplanation | null> {
  console.log("🔄 Agent Node: Generating STORY content...");
  if (specificSubtopics && specificSubtopics.length > 0) {
    console.log(`🎯 Constraining to ${specificSubtopics.length} specific subtopic(s)`);
  }
  
  // Use specificSubtopics as canonical titles if provided
  const titlesToUse = specificSubtopics && specificSubtopics.length > 0 ? specificSubtopics : canonicalTitles;
  
  const content = await withRetry(
    async () => {
      return await geminiService.generateStoryContent(
        state.topic,
        state.context,
        state.subtopicPerformance,
        titlesToUse, // Use the appropriate titles
        state.userPreferences
      );
    },
    3,
    2000, // Start with 2 second delay
    'Story Content Generation'
  );
  
  if (content) {
    console.log("✅ Agent Node: STORY content generated");
  }
  return content;
}

// ------------------------------
// Content Merger (Combines all three versions, handles nulls gracefully)
// ------------------------------
function mergeContentVersions(
  defaultExplanation: RawTopicExplanation | null,
  simplifiedExplanation: RawTopicExplanation | null,
  storyExplanation: RawTopicExplanation | null
): TopicExplanation | null {
  // If all three failed, return null
  if (!defaultExplanation && !simplifiedExplanation && !storyExplanation) {
    console.error('❌ All content generation failed!');
    return null;
  }

  // Use the first available explanation as base (prefer default)
  const baseExplanation = defaultExplanation || simplifiedExplanation || storyExplanation;
  
  if (!baseExplanation) {
    return null; // This shouldn't happen but TypeScript needs it
  }

  // Helper to normalize title for matching (handles minor AI variations)
  const normalizeTitle = (title: string): string => {
    return title
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s]/g, '') // Remove special characters
      .replace(/\s+/g, ' '); // Normalize whitespace
  };

  // Helper to find matching subtopic by title with fuzzy matching
  const findMatchingSubtopic = (
    subtopics: RawSubtopic[] | undefined,
    title: string,
    fallbackIndex: number
  ): RawSubtopic | undefined => {
    if (!subtopics || subtopics.length === 0) return undefined;
    
    const normalizedTitle = normalizeTitle(title);
    
    // First try exact normalized match
    const exactMatch = subtopics.find(
      st => normalizeTitle(st.title) === normalizedTitle
    );
    if (exactMatch) return exactMatch;
    
    // Then try partial match (one title contains the other)
    const partialMatch = subtopics.find(st => {
      const stNormalized = normalizeTitle(st.title);
      return stNormalized.includes(normalizedTitle) || normalizedTitle.includes(stNormalized);
    });
    if (partialMatch) return partialMatch;
    
    // Finally, fallback to index-based matching if available
    // This handles cases where AI generates subtopics in same order but with different names
    if (fallbackIndex < subtopics.length) {
      console.warn(`⚠️ Using index-based fallback for subtopic "${title}" -> "${subtopics[fallbackIndex].title}"`);
      return subtopics[fallbackIndex];
    }
    
    return undefined;
  };

  // Log subtopic counts for debugging
  console.log(`📊 Merging subtopics: Default=${defaultExplanation?.subtopics?.length || 0}, Simplified=${simplifiedExplanation?.subtopics?.length || 0}, Story=${storyExplanation?.subtopics?.length || 0}`);

  // Use base as the template, then match simplified and story by title
  const mergedSubtopics = baseExplanation.subtopics.map((baseSt, index) => {
    const defaultSt = defaultExplanation ? findMatchingSubtopic(defaultExplanation.subtopics, baseSt.title, index) : undefined;
    const simplifiedSt = simplifiedExplanation ? findMatchingSubtopic(simplifiedExplanation.subtopics, baseSt.title, index) : undefined;
    const storySt = storyExplanation ? findMatchingSubtopic(storyExplanation.subtopics, baseSt.title, index) : undefined;
    
    // Log matching results for first subtopic to debug
    if (index === 0) {
      console.log(`🔍 First subtopic match: title="${baseSt.title}"`);
      console.log(`   Default: ${defaultSt ? 'matched' : 'NOT matched'}`);
      console.log(`   Simplified: ${simplifiedSt ? 'matched' : 'NOT matched'}`);
      console.log(`   Story: ${storySt ? 'matched' : 'NOT matched'}`);
    }
    
    // Use the base subtopic values as fallback
    const fallbackExplanation = baseSt.explanation;
    const fallbackExample = baseSt.example;
    
    return {
      id: baseSt.id,
      title: baseSt.title,
      explanationDefault: defaultSt?.explanation || fallbackExplanation,
      explanationSimplified: simplifiedSt?.explanation || fallbackExplanation,
      explanationStory: storySt?.explanation || fallbackExplanation,
      example: defaultSt?.example || fallbackExample,
      exampleExplanation: defaultSt?.exampleExplanation || baseSt.exampleExplanation,
      exampleSimplified: simplifiedSt?.example || fallbackExample,
      exampleStory: storySt?.example || fallbackExample,
      keyPoints: defaultSt?.keyPoints || baseSt.keyPoints
    };
  });

  return {
    topicName: baseExplanation.topicName,
    overview: baseExplanation.overview,
    difficulty: baseExplanation.difficulty,
    whyLearn: baseExplanation.whyLearn,
    bestPractices: baseExplanation.bestPractices,
    commonPitfalls: baseExplanation.commonPitfalls,
    resources: baseExplanation.resources,
    subtopics: mergedSubtopics,
    // Track which tones failed for UI
    failedTones: {
      default: !defaultExplanation,
      simplified: !simplifiedExplanation,
      story: !storyExplanation,
    }
  };
}

// ------------------------------
// Main Agent: Orchestrates SEQUENTIAL content generation for title consistency
// ------------------------------
export async function generateContentBundle(
  topicName: string,
  context: string,
  subtopicPerformance?: Array<{ subtopicName: string; status: string; accuracy: number }>,
  userPreferences?: string
): Promise<TopicExplanation | null> {
  console.log("🚀 Content Agent: Starting content generation for:", topicName);
  if (userPreferences) {
    console.log("📝 User preferences:", userPreferences);
  }
  
  // Initialize agent state
  const state: ContentAgentState = {
    topic: topicName,
    context,
    subtopicPerformance,
    userPreferences,
    defaultContent: null,
    simplifiedContent: null,
    storyContent: null,
  };

  // STEP 1: Generate default content FIRST to establish canonical subtopic titles
  console.log("📝 Step 1/3: Generating DEFAULT content (establishes subtopic structure)...");
  const defaultContent = await generateDefaultNode(state);
  
  if (!defaultContent) {
    console.error('❌ Default content generation failed - cannot proceed');
    return null;
  }
  
  // Extract the canonical subtopic titles and count
  const canonicalTitles = defaultContent.subtopics.map(st => st.title);
  const subtopicCount = canonicalTitles.length;
  console.log(`✅ Default content generated with ${subtopicCount} subtopics:`, canonicalTitles);

  // STEP 2 & 3: Generate simplified and story in parallel, using canonical titles
  console.log("📝 Step 2-3: Generating SIMPLIFIED and STORY content (using canonical titles)...");
  const [simplifiedContent, storyContent] = await Promise.all([
    generateSimplifiedNode(state, canonicalTitles),
    generateStoryNode(state, canonicalTitles),
  ]);

  console.log("🎉 Content Agent: All content generation attempts completed!");
  console.log(`📊 Results: Default=success, Simplified=${simplifiedContent ? 'success' : 'failed'}, Story=${storyContent ? 'success' : 'failed'}`);

  // Merge the three versions into a single TopicExplanation structure
  // This handles null values gracefully
  const mergedExplanation = mergeContentVersions(
    defaultContent,
    simplifiedContent,
    storyContent
  );

  if (!mergedExplanation) {
    console.error('❌ Content Agent: All content generation failed!');
    throw new Error('Failed to generate any content after retries');
  }

  console.log(`✅ Content Agent: Multi-version content generation complete for "${topicName}"`);
  return mergedExplanation;
}

// ------------------------------
// Single Content Regeneration (for retry from UI)
// ------------------------------
export async function regenerateSingleContent(
  tone: ContentTone,
  topicName: string,
  context: string,
  canonicalTitles?: string[],
  subtopicPerformance?: Array<{ subtopicName: string; status: string; accuracy: number }>,
  userPreferences?: string
): Promise<RawTopicExplanation | null> {
  console.log(`🔄 Regenerating ${tone.toUpperCase()} content only...`);
  
  const state: ContentAgentState = {
    topic: topicName,
    context,
    subtopicPerformance,
    userPreferences,
    defaultContent: null,
    simplifiedContent: null,
    storyContent: null,
  };

  if (tone === 'default') {
    return await generateDefaultNode(state);
  } else if (tone === 'simplified') {
    return await generateSimplifiedNode(state, canonicalTitles || []);
  } else {
    return await generateStoryNode(state, canonicalTitles || []);
  }
}

// ------------------------------
// Regenerate Selected Subtopics with User Instructions
// ------------------------------
export async function regenerateSelectedSubtopicsContent(
  topicName: string,
  context: string,
  selectedSubtopicTitles: string[],
  userInstructions: string
): Promise<TopicExplanation | null> {
  console.log(`🔄 [Selected Subtopics] Regenerating ${selectedSubtopicTitles.length} subtopics with user instructions`);
  console.log(`📝 Subtopics: ${selectedSubtopicTitles.join(', ')}`);
  console.log(`📝 Instructions: ${userInstructions}`);

  // Generate all 3 tones with the user's instructions
  // IMPORTANT: Format user preferences so AI actually uses them
  const formattedPreferences = `
🎯 CRITICAL USER REQUEST - MUST ADDRESS:
${userInstructions}

📌 FOCUS ONLY ON THESE SUBTOPICS:
${selectedSubtopicTitles.map((title, i) => `${i + 1}. ${title}`).join('\n')}

✅ REQUIREMENTS:
- Answer the user's specific question/doubt above
- Provide BETTER EXAMPLES that directly address their concern
- Create NEW, DIFFERENT content (not the same as before)
- Make explanations CLEARER and more focused on their question
- Each subtopic MUST relate to answering their question
  `;

  console.log('📝 Formatted preferences for AI:', formattedPreferences);

  const state: ContentAgentState = {
    topic: topicName,
    context,
    userPreferences: formattedPreferences,
    defaultContent: null,
    simplifiedContent: null,
    storyContent: null,
  };

  console.log('⚙️ [Selected Subtopics] Generating all 3 content tones in parallel...');

  // Generate all 3 tones in parallel - CONSTRAINED to only selected subtopics
  const [defaultContent, simplifiedContent, storyContent] = await Promise.all([
    generateDefaultNode(state, selectedSubtopicTitles), // Pass specific subtopics
    generateSimplifiedNode(state, selectedSubtopicTitles, selectedSubtopicTitles), // Pass as both canonical and specific
    generateStoryNode(state, selectedSubtopicTitles, selectedSubtopicTitles), // Pass as both canonical and specific
  ]);

  console.log(`✅ [Selected Subtopics] Generation complete:
    - Default: ${defaultContent ? 'Success' : 'Failed'}
    - Simplified: ${simplifiedContent ? 'Success' : 'Failed'}
    - Story: ${storyContent ? 'Success' : 'Failed'}
  `);

  // Merge the three versions
  const mergedExplanation = mergeContentVersions(
    defaultContent,
    simplifiedContent,
    storyContent
  );

  if (!mergedExplanation) {
    console.error('❌ [Selected Subtopics] All content generation failed!');
    return null;
  }

  console.log(`✅ [Selected Subtopics] Successfully regenerated with ${mergedExplanation.subtopics.length} subtopics`);
  return mergedExplanation;
}
