import { useWebSearchProviderStore } from '@/hooks/stores/useWebSearchProviderStore';
import * as LangSearchClient from '@/server/langSearchClient';
import * as SerperClient from '@/server/serperClient';

/* =======================
   Unified Types
======================= */

export interface SearchResult {
  title: string;
  snippet: string;
  url?: string;
  relevance_score: number;
}

export interface TopicUpdate {
  topicName: string;
  newSubtopics: string[];
  sources: SearchResult[];
  hasUpdates: boolean;
}

interface CompletedTopic {
  id: number;
  name: string;
  completedAt: Date;
}

/* =======================
   Web Search Service
   Routes to the selected provider
======================= */

/**
 * Search for topic updates using the selected web search provider
 */
export async function searchTopicUpdates(
  topicName: string,
  completedDate?: Date
): Promise<TopicUpdate> {
  // Get the selected provider from storage
  const provider = useWebSearchProviderStore.getState().provider;
  
  console.log(`🌐 Using ${provider} for web search`);
  
  if (provider === 'serper') {
    return await SerperClient.searchTopicUpdates(topicName, completedDate);
  } else {
    // Default to langsearch
    return await LangSearchClient.searchTopicUpdates(topicName, completedDate);
  }
}

/**
 * Check multiple topics for updates using the selected web search provider
 */
export async function checkTopicsForUpdates(
  topics: CompletedTopic[]
): Promise<TopicUpdate[]> {
  // Get the selected provider from storage
  const provider = useWebSearchProviderStore.getState().provider;
  
  console.log(`🌐 Checking topics for updates using ${provider}`);
  
  if (provider === 'serper') {
    return await SerperClient.checkTopicsForUpdates(topics);
  } else {
    // Default to langsearch - convert to old format
    return await LangSearchClient.checkTopicsForUpdates(topics);
  }
}
