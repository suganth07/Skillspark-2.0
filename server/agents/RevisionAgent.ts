/**
 * Revision Agent
 * Generates quick summaries and revision quizzes for completed topics
 */

import { aiService } from '@/lib/aiService';
import { geminiService, type QuizQuestion } from '@/lib/gemini';
import { getSubtopics } from '@/server/queries/topics';

// Utility function to sanitize JSON strings by removing control characters
function sanitizeJsonString(jsonStr: string): string {
  // Remove ALL control characters (U+0000 through U+001F)
  return jsonStr.replace(/[\x00-\x1F]/g, '');
}

export interface RevisionSummary {
  topicName: string;
  keyPoints: string[];
  importantConcepts: string[];
  practicalApplications: string[];
  reviewTips: string[];
}

/**
 * Generate a quick revision summary for a topic
 * Provides concise key points for quick review
 */
export async function generateRevisionSummary(
  topicName: string,
  context: string,
  subtopics: Array<{ id: string; name: string; description: string }>
): Promise<RevisionSummary> {
  const subtopicsList = subtopics.map(st => `- ${st.name}`).join('\n');
  
  const prompt = `
    Create a QUICK REVISION SUMMARY for the topic "${topicName}" in the context of learning "${context}".
    
    The topic covers these subtopics:
    ${subtopicsList}
    
    Provide a concise revision summary that helps someone quickly review the topic.
    
    Return ONLY valid JSON in this exact format:
    {
      "topicName": "${topicName}",
      "keyPoints": [
        "Key point 1 - most important concept",
        "Key point 2 - essential knowledge",
        "Key point 3 - critical understanding"
      ],
      "importantConcepts": [
        "Concept 1 explained briefly",
        "Concept 2 explained briefly",
        "Concept 3 explained briefly"
      ],
      "practicalApplications": [
        "How to apply this knowledge - example 1",
        "How to apply this knowledge - example 2"
      ],
      "reviewTips": [
        "Tip for remembering/practicing this topic",
        "Common mistake to avoid"
      ]
    }
    
    REQUIREMENTS:
    - Keep each point concise (1-2 sentences max)
    - Focus on the most important information
    - Make it practical and actionable
    - Total summary should be readable in 2-3 minutes
  `;

  try {
    const text = await aiService.generateContent({ prompt });
    
    // Parse JSON response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Invalid JSON response from AI');
    }
    
    const sanitizedJson = sanitizeJsonString(jsonMatch[0]);
    const summary = JSON.parse(sanitizedJson) as RevisionSummary;
    
    // Validate response structure
    if (!summary.topicName || !summary.keyPoints || !summary.importantConcepts) {
      throw new Error('Invalid revision summary structure');
    }
    
    console.log(`✅ Generated revision summary for "${topicName}"`);
    return summary;
  } catch (error) {
    console.error('Error generating revision summary:', error);
    throw new Error(`Failed to generate revision summary: ${error}`);
  }
}

/**
 * Generate a revision quiz with exactly 5 questions
 * Focused on testing retention of key concepts
 */
export async function generateRevisionQuiz(
  topicName: string,
  context: string,
  subtopics: Array<{ id: string; name: string; description: string }>,
  difficulty: 'basic' | 'intermediate' | 'advanced'
): Promise<QuizQuestion[]> {
  const subtopicsList = subtopics.map(st => `- ${st.name}: ${st.description}`).join('\n');
  
  const prompt = `
    Create a REVISION QUIZ with EXACTLY 5 questions for the topic "${topicName}" in the context of learning "${context}".
    
    The topic covers these subtopics:
    ${subtopicsList}
    
    QUIZ PURPOSE: Test if the user remembers key concepts after completing this topic.
    
    Requirements:
    - Create EXACTLY 5 multiple choice questions (no more, no less)
    - Questions should cover the MOST IMPORTANT concepts across different subtopics
    - Each question should test understanding, not just memorization
    - Make questions practical and relevant
    - Difficulty level: ${difficulty}
    - Each question MUST specify which subtopic it tests
    
    Return ONLY valid JSON array (no markdown, no code blocks, no extra text):
    [
      {
        "id": "unique-question-id",
        "content": "Question text here",
        "type": "multiple_choice",
        "difficulty": "${difficulty}",
        "subtopicName": "exact subtopic name from the list above",
        "data": {
          "options": ["Option A", "Option B", "Option C", "Option D", "Not sure"],
          "correct": 0,
          "explanation": "Why this answer is correct and how it relates to the concept"
        }
      }
    ]
    
    IMPORTANT:
    - Return ONLY 5 questions
    - Always include "Not sure" as the last option (5th option)
    - Focus on the most critical knowledge for revision
    - Make questions test comprehension, not trivial details
  `;

  try {
    const text = await aiService.generateContent({ prompt });
    
    // Log raw response for debugging
    console.log('📝 Revision quiz AI response length:', text.length);
    
    // Check if response is empty or starts with error indicators
    if (!text || text.trim().length === 0) {
      throw new Error('Empty response from AI');
    }
    
    // Try to extract JSON - handle markdown code blocks too
    let jsonText = text;
    
    // Remove markdown code blocks if present
    const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlockMatch) {
      jsonText = codeBlockMatch[1];
    }
    
    // Parse JSON response
    const jsonMatch = jsonText.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      console.error('📛 Failed to find JSON array in response');
      throw new Error('Invalid JSON response from AI - no array found');
    }
    
    let questions: QuizQuestion[];
    try {
      const sanitizedJson = sanitizeJsonString(jsonMatch[0]);
      questions = JSON.parse(sanitizedJson) as QuizQuestion[];
    } catch (parseError) {
      console.error('📛 JSON parse error:', parseError);
      throw new Error(`Failed to parse revision quiz JSON: ${parseError}`);
    }
    
    // Validate questions structure
    if (!Array.isArray(questions) || questions.length === 0) {
      throw new Error('Invalid questions structure - empty array');
    }
    
    // Ensure exactly 5 questions
    if (questions.length !== 5) {
      console.warn(`⚠️ Expected 5 questions, got ${questions.length}. Adjusting...`);
      if (questions.length > 5) {
        questions = questions.slice(0, 5);
      } else {
        throw new Error(`Too few questions generated: ${questions.length}. Expected 5.`);
      }
    }
    
    // Map subtopic names to IDs
    questions.forEach(q => {
      const matchingSubtopic = subtopics.find(
        st => st.name.toLowerCase() === q.subtopicName?.toLowerCase()
      );
      if (matchingSubtopic) {
        q.subtopicId = matchingSubtopic.id;
      }
    });
    
    console.log(`✅ Generated revision quiz with ${questions.length} questions`);
    return questions;
  } catch (error) {
    console.error('Error generating revision quiz:', error);
    throw new Error(`Failed to generate revision quiz: ${error}`);
  }
}

/**
 * Generate complete revision content (summary + quiz) in one call
 * This is the main entry point for the revision agent
 */
export async function generateRevisionContent(
  topicId: string,
  topicName: string,
  context: string,
  difficulty: 'basic' | 'intermediate' | 'advanced' = 'intermediate'
): Promise<{
  summary: RevisionSummary;
  quiz: QuizQuestion[];
}> {
  console.log(`🔄 [Revision Agent] Starting revision content generation for "${topicName}"`);
  
  try {
    // Get subtopics for the topic
    const subtopicsData = await getSubtopics(topicId);
    
    if (subtopicsData.length === 0) {
      throw new Error(`No subtopics found for topic: ${topicName}`);
    }
    
    const subtopics = subtopicsData.map((st: any) => ({
      id: st.id,
      name: st.name,
      description: st.description || st.contentDefault || ''
    }));
    
    console.log(`📊 [Revision Agent] Found ${subtopics.length} subtopics`);
    
    // Generate summary and quiz in parallel for speed
    console.log('🔄 [Revision Agent] Generating summary and quiz...');
    const [summary, quiz] = await Promise.all([
      generateRevisionSummary(topicName, context, subtopics),
      generateRevisionQuiz(topicName, context, subtopics, difficulty)
    ]);
    
    console.log(`✅ [Revision Agent] Revision content generated successfully`);
    return { summary, quiz };
  } catch (error) {
    console.error('❌ [Revision Agent] Failed to generate revision content:', error);
    throw error;
  }
}
