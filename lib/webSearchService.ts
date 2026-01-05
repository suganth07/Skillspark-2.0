import type { WebSearchProvider } from '@/hooks/stores/useWebSearchProviderStore';
import * as LangSearchClient from '@/server/langSearchClient';
import * as SerperClient from '@/server/serperClient';

/* =======================
   Unified Types
======================= */

// Re-export types from client modules for external use
export type { SerperResult } from '@/server/serperClient';
export type { LangSearchResult } from '@/server/langSearchClient';

// Union type for search results from either provider
export type SearchResult = SerperClient.SerperResult | LangSearchClient.LangSearchResult;

// Union type for topic updates from either provider
export type TopicUpdate = SerperClient.TopicUpdate | LangSearchClient.TopicUpdate;

export interface CompletedTopic {
  id: string;
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
  provider: WebSearchProvider | undefined,
  completedDate?: Date,
  topicId?: string
): Promise<SerperClient.TopicUpdate | LangSearchClient.TopicUpdate> {
  // Server-safe fallback if provider is undefined
  const selectedProvider = provider || 'langsearch';
  
  console.log(`🌐 Using ${selectedProvider} for web search`);
  
  if (selectedProvider === 'serper') {
    return await SerperClient.searchTopicUpdates(topicName, completedDate, topicId);
  } else {
    // Default to langsearch
    return await LangSearchClient.searchTopicUpdates(topicName, completedDate, topicId);
  }
}

/**
 * Check multiple topics for updates using the selected web search provider
 */
export async function checkTopicsForUpdates(
  topics: CompletedTopic[],
  provider: WebSearchProvider | undefined
): Promise<Array<SerperClient.TopicUpdate | LangSearchClient.TopicUpdate>> {
  // Server-safe fallback if provider is undefined
  const selectedProvider = provider || 'langsearch';
  
  console.log(`🌐 Checking topics for updates using ${selectedProvider}`);
  
  if (selectedProvider === 'serper') {
    return await SerperClient.checkTopicsForUpdates(topics);
  } else {
    // Default to langsearch - convert to old format
    return await LangSearchClient.checkTopicsForUpdates(topics);
  }
}
