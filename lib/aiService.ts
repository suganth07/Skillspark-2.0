// aiService.ts - Unified AI service abstraction layer
import { GoogleGenerativeAI } from '@google/generative-ai';
import Groq from 'groq-sdk';
import { useAIProviderStore } from '@/hooks/stores/useAIProviderStore';

// Helper function to add proper delay between retries
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Retry with exponential backoff and proper delays
async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  initialDelayMs: number = 2000,
  context: string = 'operation'
): Promise<T> {
  let lastError: Error | null = null;
  let delayMs = initialDelayMs;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.warn(`⚠️ ${context} - Attempt ${attempt}/${maxRetries} failed:`, lastError.message);
      
      if (attempt < maxRetries) {
        console.log(`⏳ Waiting ${delayMs}ms before retry ${attempt + 1}...`);
        await sleep(delayMs);
        delayMs = Math.floor(delayMs * 1.5); // Exponential backoff: 2s, 3s, 4.5s
      }
    }
  }
  
  throw lastError || new Error(`${context} failed after ${maxRetries} attempts`);
}

// Initialize AI clients
const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
const GROQ_API_KEY = process.env.EXPO_PUBLIC_GROQ_API_KEY;

if (!GEMINI_API_KEY && !GROQ_API_KEY) {
  console.error('⚠️ No AI API keys configured. Set EXPO_PUBLIC_GEMINI_API_KEY or EXPO_PUBLIC_GROQ_API_KEY');
}

const geminiClient = GEMINI_API_KEY ? new GoogleGenerativeAI(GEMINI_API_KEY) : null;
const groqClient = GROQ_API_KEY ? new Groq({ apiKey: GROQ_API_KEY, dangerouslyAllowBrowser: true }) : null;

// Unified AI Service Interface
export interface AIGenerateOptions {
  prompt: string;
  temperature?: number;
  maxTokens?: number;
}

class AIService {
  private getProvider() {
    return useAIProviderStore.getState().provider;
  }

  async generateContent(options: AIGenerateOptions): Promise<string> {
    const provider = this.getProvider();
    
    return await withRetry(
      async () => {
        if (provider === 'gemini') {
          return await this.generateWithGemini(options);
        } else if (provider === 'groq') {
          return await this.generateWithGroq(options);
        }
        throw new Error(`Unknown AI provider: ${provider}`);
      },
      3,
      2000,
      `AI generation (${provider})`
    );
  }

  private async generateWithGemini(options: AIGenerateOptions): Promise<string> {
    if (!geminiClient) {
      throw new Error('Gemini API key not configured');
    }

    const model = geminiClient.getGenerativeModel({ 
      model: 'gemini-1.5-flash',
      generationConfig: {
        temperature: options.temperature ?? 0.7,
        maxOutputTokens: options.maxTokens ?? 8192,
      }
    });

    const result = await model.generateContent(options.prompt);
    const response = await result.response;
    return response.text();
  }

  private async generateWithGroq(options: AIGenerateOptions): Promise<string> {
    if (!groqClient) {
      throw new Error('Groq API key not configured');
    }

    const completion = await groqClient.chat.completions.create({
      messages: [
        { role: 'user', content: options.prompt }
      ],
      model: 'llama-3.3-70b-versatile', // Fast and capable model
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 8192,
    });

    return completion.choices[0]?.message?.content || '';
  }

  // Check if current provider is available
  isAvailable(): boolean {
    const provider = this.getProvider();
    if (provider === 'gemini') return !!geminiClient;
    if (provider === 'groq') return !!groqClient;
    return false;
  }

  // Get available providers
  getAvailableProviders(): Array<'gemini' | 'groq'> {
    const available: Array<'gemini' | 'groq'> = [];
    if (geminiClient) available.push('gemini');
    if (groqClient) available.push('groq');
    return available;
  }
}

export const aiService = new AIService();
