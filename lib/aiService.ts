// aiService.ts - Unified AI service abstraction layer
// 
// ⚠️ SECURITY WARNING: This file currently uses EXPO_PUBLIC_ environment variables
// which are bundled into the client. For production deployments:
// 1. Create server-side API endpoints that handle AI requests
// 2. Move API keys to server-only environment variables (without EXPO_PUBLIC_ prefix)
// 3. Have this client call those endpoints instead of AI providers directly
// 4. Rotate or revoke any exposed API keys before going to production
//
import { GoogleGenerativeAI } from '@google/generative-ai';
import Groq from 'groq-sdk';
import * as SecureStore from 'expo-secure-store';
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

// Helper to get API key from SecureStore
async function getAPIKey(provider: 'gemini' | 'groq'): Promise<string | null> {
  try {
    const key = await SecureStore.getItemAsync(`api_key_${provider}`);
    return key && key.trim() ? key : null;
  } catch (error) {
    console.error(`Failed to retrieve ${provider} API key:`, error);
    return null;
  }
}

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
    const apiKey = await getAPIKey('gemini');
    if (!apiKey) {
      throw new Error('Gemini API key not configured');
    }

    const geminiClient = new GoogleGenerativeAI(apiKey);
    const modelName = 'gemini-2.5-flash-lite';
    const model = geminiClient.getGenerativeModel({ 
      model: modelName,
      generationConfig: {
        temperature: options.temperature ?? 0.7,
        maxOutputTokens: options.maxTokens ?? 8192,
      }
    });

    const result = await model.generateContent(options.prompt);
    const response = await result.response;
    const content = response.text();
    
    if (!content || content.trim() === '') {
      const errorDetails = {
        model: modelName,
        promptPreview: options.prompt.substring(0, 100) + (options.prompt.length > 100 ? '...' : ''),
      };
      throw new Error(
        `Gemini API returned empty content. Model: ${errorDetails.model}. ` +
        `Prompt preview: "${errorDetails.promptPreview}"`
      );
    }

    return content;
  }

  private async generateWithGroq(options: AIGenerateOptions): Promise<string> {
    const apiKey = await getAPIKey('groq');
    if (!apiKey) {
      throw new Error('Groq API key not configured');
    }

    // Note: dangerouslyAllowBrowser is required for client-side usage but exposes keys
    // For production, move to server-side endpoints
    const groqClient = new Groq({ 
      apiKey, 
      dangerouslyAllowBrowser: true
    });

    const model = 'llama-3.3-70b-versatile';
    const completion = await groqClient.chat.completions.create({
      messages: [
        { role: 'user', content: options.prompt }
      ],
      model,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 8192,
    });

    const content = completion.choices[0]?.message?.content;
    
    if (!content || content.trim() === '') {
      const errorDetails = {
        model,
        choicesCount: completion.choices?.length ?? 0,
        finishReason: completion.choices[0]?.finish_reason ?? 'unknown',
        promptPreview: options.prompt.substring(0, 100) + (options.prompt.length > 100 ? '...' : ''),
      };
      throw new Error(
        `Groq API returned empty content. Model: ${errorDetails.model}, ` +
        `Finish reason: ${errorDetails.finishReason}, Choices: ${errorDetails.choicesCount}. ` +
        `Prompt preview: "${errorDetails.promptPreview}"`
      );
    }

    return content;
  }

  // Check if current provider is available
  async isAvailable(): Promise<boolean> {
    const provider = this.getProvider();
    const key = await getAPIKey(provider);
    return !!key;
  }

  // Get available providers
  async getAvailableProviders(): Promise<Array<'gemini' | 'groq'>> {
    const available: Array<'gemini' | 'groq'> = [];
    const geminiKey = await getAPIKey('gemini');
    const groqKey = await getAPIKey('groq');
    if (geminiKey) available.push('gemini');
    if (groqKey) available.push('groq');
    return available;
  }
}

export const aiService = new AIService();
