// DynamicContent.ts - Agent for parallel content generation (React Native compatible)
import { geminiService } from "../lib/gemini";
import type { TopicExplanation, RawTopicExplanation, RawSubtopic } from "../lib/gemini";

// ------------------------------
// Agent State Type
// ------------------------------
interface ContentAgentState {
  topic: string;
  context: string;
  subtopicPerformance?: Array<{ subtopicName: string; status: string; accuracy: number }>;
  defaultContent: RawTopicExplanation | null;
  simplifiedContent: RawTopicExplanation | null;
  storyContent: RawTopicExplanation | null;
}

// ------------------------------
// Agent Nodes (Content Generators)
// ------------------------------
async function generateDefaultNode(state: ContentAgentState): Promise<RawTopicExplanation> {
  console.log("🔄 Agent Node: Generating DEFAULT content...");
  
  const content = await geminiService.generateDefaultContent(
    state.topic,
    state.context,
    state.subtopicPerformance
  );
  
  console.log("✅ Agent Node: DEFAULT content generated");
  return content;
}

async function generateSimplifiedNode(state: ContentAgentState): Promise<RawTopicExplanation> {
  console.log("🔄 Agent Node: Generating SIMPLIFIED content...");
  
  const content = await geminiService.generateSimplifiedContent(
    state.topic,
    state.context,
    state.subtopicPerformance
  );
  
  console.log("✅ Agent Node: SIMPLIFIED content generated");
  return content;
}

async function generateStoryNode(state: ContentAgentState): Promise<RawTopicExplanation> {
  console.log("🔄 Agent Node: Generating STORY content...");
  
  const content = await geminiService.generateStoryContent(
    state.topic,
    state.context,
    state.subtopicPerformance
  );
  
  console.log("✅ Agent Node: STORY content generated");
  return content;
}

// ------------------------------
// Content Merger (Combines all three versions)
// ------------------------------
function mergeContentVersions(
  defaultExplanation: RawTopicExplanation,
  simplifiedExplanation: RawTopicExplanation,
  storyExplanation: RawTopicExplanation
): TopicExplanation {
  // Helper to find matching subtopic by title (case-insensitive)
  const findMatchingSubtopic = (
    subtopics: RawSubtopic[],
    title: string
  ): RawSubtopic | undefined => {
    return subtopics.find(
      st => st.title.toLowerCase().trim() === title.toLowerCase().trim()
    );
  };

  // Use default as the base, then match simplified and story by title
  const mergedSubtopics = defaultExplanation.subtopics.map((defaultSt) => {
    const simplifiedSt = findMatchingSubtopic(simplifiedExplanation.subtopics, defaultSt.title);
    const storySt = findMatchingSubtopic(storyExplanation.subtopics, defaultSt.title);
    
    // Log mismatches for debugging
    if (!simplifiedSt) {
      console.warn(`⚠️ No simplified match for subtopic: "${defaultSt.title}"`);
    }
    if (!storySt) {
      console.warn(`⚠️ No story match for subtopic: "${defaultSt.title}"`);
    }
    
    return {
      id: defaultSt.id,
      title: defaultSt.title,
      explanationDefault: defaultSt.explanation,
      explanationSimplified: simplifiedSt?.explanation || defaultSt.explanation,
      explanationStory: storySt?.explanation || defaultSt.explanation,
      example: defaultSt.example,
      exampleExplanation: defaultSt.exampleExplanation,
      exampleSimplified: simplifiedSt?.example,
      exampleStory: storySt?.example,
      keyPoints: defaultSt.keyPoints
    };
  });

  return {
    topicName: defaultExplanation.topicName,
    overview: defaultExplanation.overview,
    difficulty: defaultExplanation.difficulty,
    whyLearn: defaultExplanation.whyLearn,
    bestPractices: defaultExplanation.bestPractices,
    commonPitfalls: defaultExplanation.commonPitfalls,
    resources: defaultExplanation.resources,
    subtopics: mergedSubtopics
  };
}

// ------------------------------
// Main Agent: Orchestrates parallel content generation
// ------------------------------
export async function generateContentBundle(
  topicName: string,
  context: string,
  subtopicPerformance?: Array<{ subtopicName: string; status: string; accuracy: number }>
): Promise<TopicExplanation> {
  console.log("🚀 Content Agent: Starting parallel content generation for:", topicName);
  
  // Initialize agent state
  const state: ContentAgentState = {
    topic: topicName,
    context,
    subtopicPerformance,
    defaultContent: null,
    simplifiedContent: null,
    storyContent: null,
  };

  // Execute all three content generators in parallel (fan-out pattern)
  const [defaultContent, simplifiedContent, storyContent] = await Promise.all([
    generateDefaultNode(state),
    generateSimplifiedNode(state),
    generateStoryNode(state),
  ]);

  console.log("🎉 Content Agent: All content versions generated successfully!");

  // Merge the three versions into a single TopicExplanation structure
  const mergedExplanation = mergeContentVersions(
    defaultContent,
    simplifiedContent,
    storyContent
  );

  console.log(`✅ Content Agent: Multi-version content generation complete for "${topicName}"`);
  return mergedExplanation;
}
