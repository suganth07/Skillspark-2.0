import * as SecureStore from 'expo-secure-store';

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
  topicId?: string;
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
  completedDate?: Date,
  topicId?: string
): Promise<TopicUpdate> {
  // Fetch API key from SecureStore
  const SERPER_API_KEY = await SecureStore.getItemAsync('api_key_googleserper');
  
  if (!SERPER_API_KEY || !SERPER_API_KEY.trim()) {
    throw new Error('Serper API key is not configured');
  }

  console.log(`🔍 [Serper] Searching updates for: ${topicName}`);

  try {
    // Build a focused query for latest research, updates, and findings
    const currentYear = new Date().getFullYear();
    const lastYear = currentYear - 1;
    
    // More targeted query focusing on recent developments, research, and news in English
    const query = `${topicName} latest research findings updates news ${currentYear} ${lastYear} recent developments breakthrough`;
    
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
          gl: 'us', // Focus on US results (primarily English)
          hl: 'en', // Force English language
          num: 10, // Get top 10 results
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
          topicId,
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
  results: SerperResult[]
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
      const similarity = updateLower.includes(prevLower.slice(0, prefixLen)) || 
                         prevLower.includes(updateLower.slice(0, prefixLen));
      return similarity;
    });
  });

  return uniqueUpdates.slice(0, 5); // Return top 5 unique updates
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
  console.log(`🔍 [Serper] Checking ${topics.length} topics for updates...`);
  
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
