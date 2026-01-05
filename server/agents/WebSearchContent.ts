// WebSearchContent.ts - Generate content from web search results
import { geminiService } from "@/lib/gemini";
import type { TopicExplanation, RawTopicExplanation } from "@/lib/gemini";

// ------------------------------
// Helper: Retry with exponential backoff
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
        delayMs = Math.floor(delayMs * 1.5); // Exponential backoff
      }
    }
  }
  
  console.error(`❌ ${context} failed after ${maxRetries} attempts:`, lastError?.message);
  return null;
}

// ------------------------------
// Content Merger for web search results
// ------------------------------
function mergeWebSearchContentVersions(
  defaultExplanation: RawTopicExplanation | null,
  simplifiedExplanation: RawTopicExplanation | null,
  storyExplanation: RawTopicExplanation | null
): TopicExplanation | null {
  if (!defaultExplanation && !simplifiedExplanation && !storyExplanation) {
    console.error('❌ All web search content generation failed!');
    return null;
  }

  const baseExplanation = defaultExplanation || simplifiedExplanation || storyExplanation;
  if (!baseExplanation) return null;

  const normalizeTitle = (title: string): string => {
    return title
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, ' ');
  };

  const findMatchingSubtopic = (
    subtopics: any[] | undefined,
    title: string,
    fallbackIndex: number
  ): any | undefined => {
    if (!subtopics || subtopics.length === 0) return undefined;
    
    const normalizedTitle = normalizeTitle(title);
    const exactMatch = subtopics.find(
      st => normalizeTitle(st.title) === normalizedTitle
    );
    if (exactMatch) return exactMatch;
    
    if (fallbackIndex < subtopics.length) {
      return subtopics[fallbackIndex];
    }
    
    return undefined;
  };

  const mergedSubtopics = baseExplanation.subtopics.map((baseSt: any, index: number) => {
    const defaultSt = defaultExplanation ? findMatchingSubtopic(defaultExplanation.subtopics, baseSt.title, index) : undefined;
    const simplifiedSt = simplifiedExplanation ? findMatchingSubtopic(simplifiedExplanation.subtopics, baseSt.title, index) : undefined;
    const storySt = storyExplanation ? findMatchingSubtopic(storyExplanation.subtopics, baseSt.title, index) : undefined;
    
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
    failedTones: {
      default: !defaultExplanation,
      simplified: !simplifiedExplanation,
      story: !storyExplanation,
    }
  };
}

// ------------------------------
// Generate content from web search results
// ------------------------------
export async function generateContentFromWebSearch(
  topicName: string,
  webSearchResults: string[],
  context: string = 'Latest Updates'
): Promise<TopicExplanation | null> {
  console.log("🌐 Web Search Content Agent: Starting content generation for:", topicName);
  console.log(`📊 Using ${webSearchResults.length} web search results`);
  
  // Combine web search results into a context string
  const webContext = `Based on these recent web search findings:\n\n${webSearchResults.join('\n\n')}`;
  
  // Generate default content first to establish structure
  console.log("📝 Step 1/3: Generating DEFAULT content from web search...");
  const defaultContent = await withRetry(
    async () => {
      return await geminiService.generateDefaultContent(
        topicName,
        webContext,
        undefined,
        `Generate educational content based on the latest web search findings. Focus on new updates, changes, and current best practices.`
      );
    },
    3,
    2000,
    'Web Search Default Content'
  );
  
  if (!defaultContent) {
    console.error('❌ Web search default content generation failed');
    return null;
  }
  
  const canonicalTitles = defaultContent.subtopics.map(st => st.title);
  console.log(`✅ Default content generated with ${canonicalTitles.length} subtopics`);

  // Generate simplified and story versions in parallel
  console.log("📝 Step 2-3: Generating SIMPLIFIED and STORY content from web search...");
  const [simplifiedContent, storyContent] = await Promise.all([
    withRetry(
      async () => {
        return await geminiService.generateSimplifiedContent(
          topicName,
          webContext,
          undefined,
          canonicalTitles,
          `Generate simplified educational content based on the latest web search findings.`
        );
      },
      3,
      2000,
      'Web Search Simplified Content'
    ),
    withRetry(
      async () => {
        return await geminiService.generateStoryContent(
          topicName,
          webContext,
          undefined,
          canonicalTitles,
          `Generate story-based educational content based on the latest web search findings.`
        );
      },
      3,
      2000,
      'Web Search Story Content'
    ),
  ]);

  console.log(`📊 Results: Default=success, Simplified=${simplifiedContent ? 'success' : 'failed'}, Story=${storyContent ? 'success' : 'failed'}`);

  const mergedExplanation = mergeWebSearchContentVersions(
    defaultContent,
    simplifiedContent,
    storyContent
  );

  if (!mergedExplanation) {
    console.error('❌ Web Search Content Agent: All content generation failed!');
    return null;
  }

  console.log(`✅ Web Search Content Agent: Content generation complete for "${topicName}"`);
  return mergedExplanation;
}
