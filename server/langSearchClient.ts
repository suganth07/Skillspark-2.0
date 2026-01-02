import { LANG_SEARCH_API_KEY } from '@/lib/constants';

const LANG_SEARCH_API_URL = 'https://api.langsearch.com/v1/rerank';

/* =======================
   Types
======================= */

export interface LangSearchResult {
  title: string;
  snippet: string;
  relevance_score: number;
}

export interface TopicUpdate {
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
  completedDate?: Date
): Promise<TopicUpdate> {
  if (!LANG_SEARCH_API_KEY) {
    throw new Error('Lang Search API key is not configured');
  }

  console.log(`🔍 Searching updates for: ${topicName}`);

  try {
    const query = `What are the latest updates, new features, and changes in ${topicName} since ${completedDate?.toLocaleDateString() || '2024'}?`;
    
    // Candidate documents to rerank (in production, these would come from a web search API)
    const candidateDocuments = [
      `${topicName} has received major updates in 2025-2026 including new features, performance improvements, and breaking changes that developers should be aware of.`,
      `Latest ${topicName} release notes show significant enhancements to core functionality, new APIs, and deprecation of older features.`,
      `${topicName} ecosystem updates: new libraries, tools, and best practices have emerged in the past year.`,
      `Breaking changes in ${topicName}: migration guide for latest version with new syntax and updated patterns.`,
      `${topicName} performance improvements and optimization techniques introduced in recent releases.`,
      `Security updates and patches for ${topicName} addressing critical vulnerabilities.`,
      `New ${topicName} features announced at conferences and in official documentation.`,
      `${topicName} community adoption of modern patterns and architectural changes.`,
      `${topicName} integration improvements with popular frameworks and tools.`,
      `${topicName} developer experience enhancements and tooling updates.`,
    ];

    console.log(`📡 Calling LangSearch Rerank API for ${topicName}...`);

    const response = await fetch(LANG_SEARCH_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LANG_SEARCH_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'langsearch-reranker-v1',
        query: query,
        documents: candidateDocuments,
        top_n: 5,
        return_documents: true,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ API Error Response: ${errorText}`);
      
      // Handle rate limit specifically
      if (response.status === 429) {
        throw new Error('RATE_LIMIT_EXCEEDED');
      }
      
      throw new Error(`LangSearch API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log(`✅ LangSearch rerank complete for ${topicName}`);

    if (data.code !== 200) {
      // Handle rate limit from response body
      if (data.code === '429' || data.code === 429) {
        throw new Error('RATE_LIMIT_EXCEEDED');
      }
      throw new Error(`LangSearch error: ${data.message || data.msg || 'Unknown error'}`);
    }

    const results: LangSearchResult[] = data.results.map((result: any) => ({
      title: `Update: ${topicName}`,
      snippet: result.document.text,
      relevance_score: result.relevance_score,
    }));

    // Extract subtopics from high-relevance results
    const newSubtopics = extractSubtopicsFromRerankedResults(topicName, results);

    return {
      topicName,
      newSubtopics,
      sources: results,
      hasUpdates: newSubtopics.length > 0,
    };
  } catch (error) {
    console.error('❌ Failed to search topic updates:', error);
    throw error;
  }
}

function extractSubtopicsFromRerankedResults(
  topicName: string,
  results: LangSearchResult[]
): string[] {
  const subtopics = new Set<string>();

  // Only use highly relevant results (score > 0.5)
  const relevantResults = results.filter(r => r.relevance_score > 0.5);

  if (relevantResults.length === 0) {
    return [];
  }

  // Extract key phrases from relevant results
  for (const result of relevantResults) {
    const text = result.snippet.toLowerCase();

    // Look for update indicators
    if (text.includes('new features') || text.includes('updates')) {
      subtopics.add(`New Features in ${topicName}`);
    }
    if (text.includes('breaking changes') || text.includes('migration')) {
      subtopics.add(`Breaking Changes & Migration`);
    }
    if (text.includes('performance') || text.includes('optimization')) {
      subtopics.add(`Performance Improvements`);
    }
    if (text.includes('security') || text.includes('vulnerabilities')) {
      subtopics.add(`Security Updates`);
    }
    if (text.includes('best practices') || text.includes('patterns')) {
      subtopics.add(`Modern Best Practices`);
    }
    if (text.includes('tools') || text.includes('ecosystem')) {
      subtopics.add(`Ecosystem & Tooling`);
    }
  }

  return Array.from(subtopics);
}

/* =======================
   Batch Topic Search
======================= */

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
    }
  }

  return updates.filter(update => update.hasUpdates);
}
