import { LANG_SEARCH_API_KEY } from '@/lib/constants';

const LANG_SEARCH_WEB_SEARCH_URL = 'https://api.langsearch.com/v1/web-search';
const LANG_SEARCH_RERANK_URL = 'https://api.langsearch.com/v1/rerank';

/* =======================
   Types
======================= */

export interface LangSearchResult {
  title: string;
  snippet: string;
  url?: string;
  relevance_score: number;
}

export interface TopicUpdate {
  topicId?: string;
  topicName: string;
  newSubtopics: string[];
  sources: LangSearchResult[];
  hasUpdates: boolean;
}

/* =======================
   Single Topic Search
======================= */

export async function searchTopicUpdates(
  topicName: string,
  completedDate?: Date,
  topicId?: string
): Promise<TopicUpdate> {
  if (!LANG_SEARCH_API_KEY) {
    throw new Error('Lang Search API key is not configured');
  }

  console.log(`🔍 Searching updates for: ${topicName}`);

  try {
    const formattedDate = completedDate ? completedDate.toISOString().split('T')[0] : '2024';
    const query = `${topicName} latest updates new features changes breaking changes since ${formattedDate}`;
    
    console.log(`📡 Calling LangSearch Web Search API for: "${query}"`);

    // Step 1: Perform web search to get real documents with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

    try {
      const searchResponse = await fetch(LANG_SEARCH_WEB_SEARCH_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${LANG_SEARCH_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: query,
          freshness: 'onLimit', // Prioritize recent content
          summary: true, // Get full summaries
          count: 10, // Get top 10 results
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!searchResponse.ok) {
        const errorText = await searchResponse.text();
        console.error(`❌ Web Search API Error: ${errorText}`);
        
        // Handle specific HTTP errors
        if (searchResponse.status === 429) {
          const error = new Error('Rate limit exceeded. Please try again later.');
          error.name = 'RateLimitError';
          throw error;
        }
        
        if (searchResponse.status === 504) {
          throw new Error('Search request timed out. The API is taking too long to respond. Please try again in a moment.');
        }
        
        throw new Error(`LangSearch Web Search API error: ${searchResponse.status} - ${errorText}`);
      }

      const searchData = await searchResponse.json();
      console.log(`✅ Web search complete for ${topicName}, found ${searchData.data?.webPages?.value?.length || 0} results`);

      if (searchData.code !== 200) {
        if (searchData.code === '429' || searchData.code === 429) {
          const error = new Error('Rate limit exceeded. Please try again later.');
          error.name = 'RateLimitError';
          throw error;
        }
        throw new Error(`LangSearch error: ${searchData.message || searchData.msg || 'Unknown error'}`);
      }

      // Extract web pages from response
      const webPages = searchData.data?.webPages?.value || [];
      
      if (webPages.length === 0) {
        console.log(`⚠️ No web results found for ${topicName}`);
        return {
          topicId,
          topicName,
          newSubtopics: [],
          sources: [],
          hasUpdates: false,
        };
      }

      // Convert web pages to our format with URLs
      const results: LangSearchResult[] = webPages.map((page: any) => ({
        title: page.name || `Update: ${topicName}`,
        snippet: page.summary || page.snippet || '',
        url: page.url || page.displayUrl,
        relevance_score: 1.0, // Web search results are already relevant
      }));

      console.log(`✅ Processed ${results.length} web search results for ${topicName}`);

      // Extract actual specific updates as subtopics from web results
      const newSubtopics = extractActualUpdatesFromResults(topicName, results);

      return {
        topicId,
        topicName,
        newSubtopics,
        sources: results.slice(0, 5), // Return top 5 sources
        hasUpdates: newSubtopics.length > 0,
      };
    } catch (error) {
      clearTimeout(timeoutId);
      console.error('❌ Failed to search topic updates:', error);
      
      // Handle abort/timeout error
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Search request timed out after 30 seconds. Please try again.');
      }
      
      throw error;
    }
  } catch (error) {
    console.error('❌ Failed to search topic updates:', error);
    throw error;
  }
}
function extractActualUpdatesFromResults(
  topicName: string,
  results: LangSearchResult[]
): string[] {
  const updates: string[] = [];

  if (results.length === 0) {
    return [];
  }

  // Extract actual specific content from top results
  for (let i = 0; i < Math.min(results.length, 5); i++) {
    const result = results[i];
    const title = result.title;
    const snippet = result.snippet;
    const url = result.url;
    
    // Extract the most relevant sentence or key update from the snippet
    const sentences = snippet.split(/[.!?]\s+/).filter(s => s.trim().length > 20);
    
    // Find sentences that mention updates, changes, features, etc.
    const relevantSentences = sentences.filter(sentence => {
      const lower = sentence.toLowerCase();
      return (
        lower.includes('new') ||
        lower.includes('update') ||
        lower.includes('feature') ||
        lower.includes('release') ||
        lower.includes('version') ||
        lower.includes('change') ||
        lower.includes('improve') ||
        lower.includes('add') ||
        lower.includes('introduce') ||
        lower.includes('announce') ||
        lower.includes('launch')
      );
    });

    if (relevantSentences.length > 0) {
      // Take the first relevant sentence and clean it up
      let update = relevantSentences[0].trim();
      
      // Limit length to keep it concise
      if (update.length > 100) {
        update = update.substring(0, 100).trim() + '...';
      }
      
      // Format as Markdown with clickable link
      if (url) {
        try {
          const domain = new URL(url).hostname.replace('www.', '');
          // Markdown format: text [link text](url)
          updates.push(`${update} [Read more](${url})`);
        } catch {
          updates.push(update);
        }
      } else {
        updates.push(update);
      }
    } else if (title && title.toLowerCase() !== topicName.toLowerCase()) {
      // If no relevant sentences, use the title if it's informative
      let update = title;
      if (update.length > 100) {
        update = update.substring(0, 100).trim() + '...';
      }
      
      if (url) {
        try {
          const domain = new URL(url).hostname.replace('www.', '');
          updates.push(`${update} [Read more](${url})`);
        } catch {
          updates.push(update);
        }
      } else {
        updates.push(update);
      }
    }
  }

  // If we couldn't extract specific updates, provide at least the titles with sources
  if (updates.length === 0 && results.length > 0) {
    for (let i = 0; i < Math.min(results.length, 4); i++) {
      const result = results[i];
      let update = result.title;
      
      if (result.url) {
        try {
          updates.push(`${update} [Read more](${result.url})`);
        } catch {
          updates.push(update);
        }
      } else {
        updates.push(update);
      }
    }
  }

  return updates;
}

/* =======================
   Batch Topic Search
======================= */

interface CompletedTopic {
  id: string;
  name: string;
  completedAt: Date;
}

export async function checkTopicsForUpdates(
  topics: CompletedTopic[]
): Promise<TopicUpdate[]> {
  console.log(`🔍 Checking ${topics.length} topics for updates...`);
  
  const updates: TopicUpdate[] = [];
  
  for (let i = 0; i < topics.length; i++) {
    const topic = topics[i];
    console.log(`\n📚 [${i + 1}/${topics.length}] Checking: ${topic.name}`);
    
    try {
      const result = await searchTopicUpdates(topic.name, topic.completedAt, topic.id);
      
      if (result.hasUpdates) {
        console.log(`✨ Found ${result.newSubtopics.length} new updates for ${topic.name}`);
        updates.push(result);
      } else {
        console.log(`✅ No significant updates for ${topic.name}`);
      }
      
      // Add 5 second delay between requests (except for the last one)
      if (i < topics.length - 1) {
        console.log(`⏸️  Waiting 5 seconds before next request...`);
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    } catch (error) {
      console.error(`❌ Topic check failed for ${topic.name}:`, error);
      
      // If it's a timeout, log a helpful message
      if (error instanceof Error && 
          (error.message.includes('timed out') || error.message.includes('504'))) {
        console.log(`⏱️  API timeout for ${topic.name}. Continuing with next topic...`);
      }
    }
  }

  return updates.filter(update => update.hasUpdates);
}

export async function checkMultipleTopicsForUpdates(
  topics: Array<{ name: string; completedDate?: Date }>
): Promise<TopicUpdate[]> {
  console.log(`🔍 Checking ${topics.length} topics for updates...`);

  const updates: TopicUpdate[] = [];

  // Process topics sequentially with 5 second delay to respect rate limits
  // LangSearch API allows 1 request per second, so 5 seconds is safe
  for (let i = 0; i < topics.length; i++) {
    const topic = topics[i];
    
    try {
      console.log(`⏳ Processing topic ${i + 1}/${topics.length}: ${topic.name}`);
      const result = await searchTopicUpdates(topic.name, topic.completedDate);
      updates.push(result);
      
      // Add 5 second delay between requests (except for the last one)
      if (i < topics.length - 1) {
        console.log(`⏸️  Waiting 5 seconds before next request...`);
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    } catch (error) {
      console.error(`❌ Topic check failed for ${topic.name}:`, error);
      
      // If it's a timeout, log a helpful message
      if (error instanceof Error && 
          (error.message.includes('timed out') || error.message.includes('504'))) {
        console.log(`⏱️  API timeout for ${topic.name}. Continuing with next topic...`);
      }
    }
  }

  return updates.filter(update => update.hasUpdates);
}
