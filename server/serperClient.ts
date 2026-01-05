import { SERPER_API_KEY } from '@/lib/constants';

const SERPER_SEARCH_URL = 'https://google.serper.dev/search';

/* =======================
   Types
======================= */

export interface SerperResult {
  title: string;
  snippet: string;
  url?: string;
  relevance_score: number;
}

export interface TopicUpdate {
  topicName: string;
  newSubtopics: string[];
  sources: SerperResult[];
  hasUpdates: boolean;
}

/* =======================
   Single Topic Search
======================= */

export async function searchTopicUpdates(
  topicName: string,
  completedDate?: Date
): Promise<TopicUpdate> {
  if (!SERPER_API_KEY) {
    throw new Error('Serper API key is not configured');
  }

  console.log(`🔍 [Serper] Searching updates for: ${topicName}`);

  try {
    const formattedDate = completedDate ? completedDate.toISOString().split('T')[0] : '2024';
    const query = `${topicName} latest updates new features changes breaking changes since ${formattedDate}`;
    
    console.log(`📡 Calling Serper Search API for: "${query}"`);

    // Perform web search with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

    try {
      const searchResponse = await fetch(SERPER_SEARCH_URL, {
        method: 'POST',
        headers: {
          'X-API-KEY': SERPER_API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          q: query,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!searchResponse.ok) {
        const errorText = await searchResponse.text();
        console.error(`❌ Serper Search API Error: ${errorText}`);
        
        // Handle specific HTTP errors
        if (searchResponse.status === 429) {
          const error = new Error('Rate limit exceeded. Please try again later.');
          error.name = 'RateLimitError';
          throw error;
        }
        
        if (searchResponse.status === 504) {
          throw new Error('Search request timed out. The API is taking too long to respond. Please try again in a moment.');
        }
        
        throw new Error(`Serper Search API error: ${searchResponse.status} - ${errorText}`);
      }

      const searchData = await searchResponse.json();
      console.log(`✅ Serper search complete for ${topicName}, found ${searchData.organic?.length || 0} results`);

      // Extract organic results from response
      const organicResults = searchData.organic || [];
      
      if (organicResults.length === 0) {
        console.log(`⚠️ No web results found for ${topicName}`);
        return {
          topicName,
          newSubtopics: [],
          sources: [],
          hasUpdates: false,
        };
      }

      // Convert organic results to our format with URLs
      const results: SerperResult[] = organicResults.map((result: any) => ({
        title: result.title || `Update: ${topicName}`,
        snippet: result.snippet || '',
        url: result.link,
        relevance_score: 1.0, // Serper results are already relevant
      }));

      console.log(`✅ Processed ${results.length} Serper search results for ${topicName}`);

      // Extract actual specific updates as subtopics from web results
      const newSubtopics = extractActualUpdatesFromResults(topicName, results);

      return {
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
  results: SerperResult[]
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
      const lowerSentence = sentence.toLowerCase();
      return (
        lowerSentence.includes('update') ||
        lowerSentence.includes('new') ||
        lowerSentence.includes('feature') ||
        lowerSentence.includes('change') ||
        lowerSentence.includes('release') ||
        lowerSentence.includes('version') ||
        lowerSentence.includes('latest') ||
        lowerSentence.includes('improve') ||
        lowerSentence.includes('add')
      );
    });

    // Use the most relevant sentence, or fall back to title
    let updateText = relevantSentences[0] || title;
    
    // Clean up the text
    updateText = updateText.trim();
    if (!updateText.endsWith('.')) {
      updateText += '.';
    }
    
    // Add markdown link to the source
    if (url) {
      updateText += ` [Read more](${url})`;
    }
    
    updates.push(updateText);
  }

  return updates;
}

/* =======================
   Batch Topic Search
======================= */

interface CompletedTopic {
  id: number;
  name: string;
  completedAt: Date;
}

export async function checkTopicsForUpdates(
  topics: CompletedTopic[]
): Promise<TopicUpdate[]> {
  console.log(`🔍 [Serper] Checking ${topics.length} topics for updates...`);
  
  const updates: TopicUpdate[] = [];
  
  for (let i = 0; i < topics.length; i++) {
    const topic = topics[i];
    console.log(`\n📚 [${i + 1}/${topics.length}] Checking: ${topic.name}`);
    
    try {
      const result = await searchTopicUpdates(topic.name, topic.completedAt);
      
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
