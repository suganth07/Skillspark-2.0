import * as SecureStore from 'expo-secure-store';

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
  // Fetch API key from SecureStore
  const LANG_SEARCH_API_KEY = await SecureStore.getItemAsync('api_key_langsearch');
  
  if (!LANG_SEARCH_API_KEY || !LANG_SEARCH_API_KEY.trim()) {
    throw new Error('Lang Search API key is not configured');
  }

  console.log(`🔍 Searching updates for: ${topicName}`);

  try {
    // Build a focused query for latest research, updates, and findings
    const currentYear = new Date().getFullYear();
    const lastYear = currentYear - 1;
    
    // More targeted query focusing on recent developments, research, and news
    const query = `${topicName} latest research findings updates news ${currentYear} ${lastYear} recent developments breakthrough`;
    
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
          freshness: 'month', // Prioritize content from last month
          summary: true, // Get full summaries
          count: 10, // Get top 10 results
          language: 'en', // Force English results
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

  // Extract actual specific content from top results - focus on research and updates
  for (let i = 0; i < Math.min(results.length, 6); i++) {
    const result = results[i];
    const title = result.title;
    const snippet = result.snippet;
    const url = result.url;
    
    // Split into sentences and filter out very short ones
    const sentences = snippet.split(/[.!?]\s+/).filter(s => s.trim().length > 30);
    
    // Find sentences that mention research, findings, updates, breakthroughs
    const researchKeywords = [
      'research', 'study', 'findings', 'discovered', 'breakthrough', 'innovation',
      'published', 'scientists', 'researchers', 'experts', 'analysis', 'data shows'
    ];
    
    const updateKeywords = [
      'new', 'latest', 'recent', 'update', 'announced', 'released', 'launched',
      'introduced', 'unveiled', 'breakthrough', 'advancement', 'development'
    ];

    // Prioritize research-focused sentences
    let relevantSentences = sentences.filter(sentence => {
      const lower = sentence.toLowerCase();
      return researchKeywords.some(keyword => lower.includes(keyword));
    });

    // If no research sentences, look for update-related content
    if (relevantSentences.length === 0) {
      relevantSentences = sentences.filter(sentence => {
        const lower = sentence.toLowerCase();
        return updateKeywords.some(keyword => lower.includes(keyword));
      });
    }

    // Use the best sentence we found
    if (relevantSentences.length > 0) {
      let update = relevantSentences[0].trim();
      
      // Clean up and ensure proper English
      update = update.replace(/\s+/g, ' '); // Remove extra whitespace
      
      // Ensure it ends with punctuation
      if (!update.endsWith('.') && !update.endsWith('!') && !update.endsWith('?')) {
        update += '.';
      }
      
      // Limit length to keep it readable
      if (update.length > 150) {
        update = update.substring(0, 147).trim() + '...';
      }
      
      // Format as Markdown with clickable link
      if (url) {
        updates.push(`${update} [Read more](${url})`);
      } else {
        updates.push(update);
      }
    } else if (title && title.length > 10) {
      // Fallback to title if it's informative
      let update = title;
      
      // Clean up title
      update = update.replace(/\s+/g, ' ').trim();
      
      if (update.length > 120) {
        update = update.substring(0, 117).trim() + '...';
      }
      
      if (url) {
        updates.push(`${update} [Read more](${url})`);
      } else {
        updates.push(update);
      }
    }
  }

  // Deduplicate very similar updates
  const uniqueUpdates = updates.filter((update, index) => {
    const updateLower = update.toLowerCase().replace(/\[read more\].*$/i, '').trim();
    return !updates.slice(0, index).some(prev => {
      const prevLower = prev.toLowerCase().replace(/\[read more\].*$/i, '').trim();
      // Check if updates are very similar (>70% overlap)
      const prefixLen = Math.min(50, updateLower.length, prevLower.length);
      if (prefixLen < 10) return false; // Too short to compare meaningfully
      const similarity = updateLower.includes(prevLower.substring(0, prefixLen)) || 
                         prevLower.includes(updateLower.substring(0, prefixLen));
      return similarity;
    });
  });

  return uniqueUpdates.slice(0, 5); // Return top 5 unique updates
}

/* =======================
   Batch Topic Search
======================= */

export interface CompletedTopic {
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
