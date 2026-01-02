// VideoGen.ts - Agent for video generation
import { geminiService } from "@/lib/gemini";
import { heygenGenerateVideo, waitForHeygenVideoUrl } from "@/server/heygenClient";
import type { TopicSubtopic } from "@/lib/gemini";

// ------------------------------
// Video Generation Types
// ------------------------------
export interface VideoGenerationResult {
  script: string;
  videoId: string;
  remoteUrl: string;
}

// ------------------------------
// Agent State Type
// ------------------------------
interface VideoAgentState {
  topicName: string;
  context: string;
  subtopics: TopicSubtopic[];
  apiKey: string;
  avatarId: string;
  voiceId: string;
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
// Script Generation Node
// ------------------------------
async function generateScriptNode(state: VideoAgentState): Promise<string> {
  console.log("🎬 Agent Node: Generating video script...");
  
  const script = await withRetry(
    async () => {
      return await geminiService.generateVideoScript(
        state.topicName,
        state.context,
        state.subtopics
      );
    },
    3,
    1000,
    'Script Generation'
  );
  
  console.log("✅ Agent Node: Script generated");
  return script;
}

// ------------------------------
// HeyGen Video Generation Node
// ------------------------------
async function generateHeygenVideoNode(
  script: string,
  state: VideoAgentState
): Promise<{ videoId: string; remoteUrl: string }> {
  console.log(`🎥 Generating HeyGen video...`);
  
  // Step 1: Create video with retry (cheap operation)
  const videoId = await withRetry(
    async () => {
      // Build HeyGen payload
      const payload = {
        video_inputs: [
          {
            character: {
              type: 'avatar',
              avatar_id: state.avatarId,
            },
            voice: {
              type: 'text',
              voice_id: state.voiceId,
              input_text: script,
            },
          },
        ],
        dimension: {
          width: 1280,
          height: 720,
        },
      };

      // Send to HeyGen
      const generateResponse = await heygenGenerateVideo(state.apiKey, payload);
      const videoId = generateResponse?.data?.video_id || generateResponse?.video_id;

      if (!videoId) {
        throw new Error('No video ID returned from HeyGen');
      }

      console.log(`📹 HeyGen video ID:`, videoId);
      return videoId;
    },
    2, // Only retry twice for video creation
    2000,
    'HeyGen Video Creation'
  );

  // Step 2: Poll for completion WITHOUT retry to avoid duplicate videos
  // If polling times out, the videoId is already created and won't be duplicated
  console.log(`📹 Polling for video completion...`);
  const remoteUrl = await waitForHeygenVideoUrl(state.apiKey, videoId, {
    intervalMs: 3000,
    timeoutMs: 10 * 60 * 1000, // 10 minutes timeout
  });

  console.log(`📹 Video URL:`, remoteUrl);
  
  return { videoId, remoteUrl };
}

// ------------------------------
// Main Agent: Orchestrates video generation
// ------------------------------
export async function generateTopicVideo(
  topicName: string,
  context: string,
  subtopics: TopicSubtopic[],
  apiKey: string,
  avatarId: string,
  voiceId: string
): Promise<VideoGenerationResult> {
  console.log("🎬 Video Agent: Starting video generation for:", topicName);
  
  // Validate inputs
  if (!apiKey || !avatarId || !voiceId) {
    const error = 'Missing required HeyGen configuration (API key, avatar ID, or voice ID)';
    console.error('❌', error);
    throw new Error(error);
  }
  
  // Initialize agent state
  const state: VideoAgentState = {
    topicName,
    context,
    subtopics,
    apiKey,
    avatarId,
    voiceId,
  };

  // Step 1: Generate script
  const script = await generateScriptNode(state);

  // Step 2: Generate video with HeyGen
  const videoResult = await generateHeygenVideoNode(script, state);

  console.log(`✅ Video generation completed successfully!`);
  
  return {
    script,
    videoId: videoResult.videoId,
    remoteUrl: videoResult.remoteUrl,
  };
}
