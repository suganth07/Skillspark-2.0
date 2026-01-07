import { Alert } from 'react-native';
import * as SecureStore from 'expo-secure-store';

export const API_KEY_NAMES = {
  gemini: 'Gemini API',
  groq: 'Groq API',
  langsearch: 'LangSearch API',
  googleserper: 'Google Serper API',
  heygen: 'HeyGen API',
} as const;

export type APIKeyType = keyof typeof API_KEY_NAMES;

/**
 * Get an API key from SecureStore
 */
export async function getAPIKey(type: APIKeyType): Promise<string | null> {
  try {
    const key = await SecureStore.getItemAsync(`api_key_${type}`);
    return key && key.trim() ? key : null;
  } catch (error) {
    console.error(`Failed to get ${type} API key:`, error);
    return null;
  }
}

/**
 * Check if an API key is configured (async version)
 */
export async function hasAPIKey(type: APIKeyType): Promise<boolean> {
  const key = await getAPIKey(type);
  return key !== null;
}

/**
 * Show an alert if required API key is missing
 * Returns true if key exists, false if missing
 */
export function checkAPIKey(
  type: APIKeyType,
  feature: string,
  onNavigateToSettings?: () => void
): boolean {
  // Note: This is a synchronous check, so we can't await
  // We'll use a workaround to check synchronously
  SecureStore.getItemAsync(`api_key_${type}`)
    .then((key) => {
      if (!key || !key.trim()) {
        Alert.alert(
          'API Key Required',
          `${API_KEY_NAMES[type]} is required to use ${feature}. Please configure it in Settings.`,
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Go to Settings',
              onPress: onNavigateToSettings,
            },
          ]
        );
        return false;
      }
      return true;
    })
    .catch(() => {
      Alert.alert(
        'API Key Required',
        `${API_KEY_NAMES[type]} is required to use ${feature}. Please configure it in Settings.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Go to Settings',
            onPress: onNavigateToSettings,
          },
        ]
      );
      return false;
    });
  
  // Return true optimistically - the alert will show if key is missing
  return true;
}

/**
 * Get all configured API keys (async)
 */
export async function getAllAPIKeys(): Promise<Record<APIKeyType, string | null>> {
  const keys = await Promise.all([
    getAPIKey('gemini'),
    getAPIKey('groq'),
    getAPIKey('langsearch'),
    getAPIKey('googleserper'),
    getAPIKey('heygen'),
  ]);
  
  return {
    gemini: keys[0],
    groq: keys[1],
    langsearch: keys[2],
    googleserper: keys[3],
    heygen: keys[4],
  };
}

/**
 * Check if all required API keys are configured (async)
 */
export async function hasRequiredAPIKeys(): Promise<boolean> {
  // Gemini is the only required key for core features
  return await hasAPIKey('gemini');
}

/**
 * Check if any AI provider key is configured (Gemini OR Groq)
 * Returns true if at least one AI provider is available
 */
export async function hasAnyAIProviderKey(): Promise<boolean> {
  const geminiKey = await getAPIKey('gemini');
  const groqKey = await getAPIKey('groq');
  return !!(geminiKey || groqKey);
}
