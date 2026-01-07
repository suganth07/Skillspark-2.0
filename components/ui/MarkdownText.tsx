import React from 'react';
import { View, Text, Pressable, Alert } from 'react-native';
import * as WebBrowser from 'expo-web-browser';

/**
 * Component to render markdown text with clickable links
 * Supports markdown link syntax: [text](url)
 * Automatically filters out "read more" text (case insensitive)
 */
export default function MarkdownText({ text }: { text: string }) {
  // Filter out "read more" text (case insensitive)
  const cleanedText = text.replace(/\s*read more\s*/gi, '').trim();
  
  const parts: Array<{ text: string; url?: string }> = [];
  
  // Parse markdown links: [text](url)
  const regex = /\[([^\]]+)\]\(([^)]+)\)/g;
  let lastIndex = 0;
  let match;
  
  while ((match = regex.exec(cleanedText)) !== null) {
    // Add text before the link
    if (match.index > lastIndex) {
      parts.push({ text: cleanedText.substring(lastIndex, match.index) });
    }
    // Add the link
    parts.push({ text: match[1], url: match[2] });
    lastIndex = regex.lastIndex;
  }
  
  // Add remaining text
  if (lastIndex < cleanedText.length) {
    parts.push({ text: cleanedText.substring(lastIndex) });
  }
  
  if (parts.length === 0) {
    parts.push({ text: cleanedText });
  }

  return (
    <View className="flex-row flex-wrap ml-2">
      <Text className="text-sm text-foreground">• </Text>
      {parts.map((part, index) => (
        part.url ? (
          <Pressable
            key={index}
            onPress={async () => {
              try {
                await WebBrowser.openBrowserAsync(part.url!);
              } catch (error) {
                console.error('Error opening URL:', error);
                Alert.alert('Error', 'Could not open link');
              }
            }}
            className="active:opacity-70"
          >
            <Text className="text-sm text-blue-500 underline">
              {part.text}
            </Text>
          </Pressable>
        ) : (
          <Text key={index} className="text-sm text-foreground">
            {part.text}
          </Text>
        )
      ))}
    </View>
  );
}
