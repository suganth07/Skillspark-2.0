import React, { useState, useCallback } from 'react';
import { View, Text, ActivityIndicator, Pressable, Alert } from 'react-native';
import { Search, ExternalLink, RefreshCw } from 'lucide-react-native';
import * as WebBrowser from 'expo-web-browser';
import { useColorScheme } from '@/lib/useColorScheme';
import {
  BottomSheetContent,
  BottomSheetHeader,
  BottomSheetView,
  BottomSheetFlatList,
} from '@/components/primitives/bottomSheet/bottom-sheet.native';

// Component to render markdown text with clickable links
function MarkdownText({ text }: { text: string }) {
  const cleanedText = text.replace(/\s*read more\s*/gi, '').trim();
  
  const parts: Array<{ text: string; url?: string }> = [];
  
  const regex = /\[([^\]]+)\]\(([^)]+)\)/g;
  let lastIndex = 0;
  let match;
  
  while ((match = regex.exec(cleanedText)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ text: cleanedText.substring(lastIndex, match.index) });
    }
    parts.push({ text: match[1], url: match[2] });
    lastIndex = regex.lastIndex;
  }
  
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

interface TopicSearchResultsModalProps {
  sheetRef: React.RefObject<any>;
  results: string[];
  isSearching: boolean;
  topicName?: string;
  onRefresh: () => Promise<void>;
  visible?: boolean;
}

export function TopicSearchResultsModal({ 
  sheetRef,
  results,
  isSearching,
  topicName,
  onRefresh,
  visible = true
}: TopicSearchResultsModalProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { isDarkColorScheme } = useColorScheme();

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await onRefresh();
    } catch (error) {
      console.error('Failed to refresh web search:', error);
      Alert.alert(
        'Refresh Failed',
        'Unable to fetch latest results. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsRefreshing(false);
    }
  }, [onRefresh]);

  const renderResultItem = ({ item, index }: { item: string; index: number }) => {
    const urlMatch = item.match(/\[([^\]]+)\]\(([^)]+)\)/);
    const url = urlMatch ? urlMatch[2] : null;

    const handleReadMore = async () => {
      if (url) {
        try {
          await WebBrowser.openBrowserAsync(url);
        } catch (error) {
          console.error('Error opening URL:', error);
          Alert.alert('Error', 'Could not open link');
        }
      }
    };

    return (
      <View 
        className="mb-3 rounded-lg overflow-hidden border shadow-sm"
        style={{
          backgroundColor: isDarkColorScheme ? '#27272a' : '#ffffff',
          borderColor: isDarkColorScheme ? '#3f3f46' : '#e4e4e7',
        }}
      >
        <View className="p-3">
          <MarkdownText text={item} />
        </View>
        {url && (
          <>
            <View style={{ height: 1, backgroundColor: isDarkColorScheme ? '#3f3f46' : '#e4e4e7' }} />
            <Pressable
              onPress={handleReadMore}
              className="py-2.5 px-3 items-center active:opacity-70"
              style={{ backgroundColor: isDarkColorScheme ? 'rgba(63, 63, 70, 0.3)' : 'rgba(244, 244, 245, 0.5)' }}
            >
              <Text style={{ fontSize: 12, fontWeight: '600', color: isDarkColorScheme ? '#818cf8' : '#4f46e5' }}>
                View Source
              </Text>
            </Pressable>
          </>
        )}
      </View>
    );
  };

  return (
    <BottomSheetContent
      ref={sheetRef}
      snapPoints={['85%']}
      enableDynamicSizing={false}
    >
      <BottomSheetHeader>
        <View className="py-3">
          <View className="flex-row items-center gap-2 mb-1">
            <View 
              className="p-2 rounded-md"
              style={{ backgroundColor: isDarkColorScheme ? '#27272a' : '#f4f4f5' }}
            >
              <Search size={20} color={isDarkColorScheme ? '#a1a1aa' : '#52525b'} />
            </View>
            <Text style={{ fontSize: 18, fontWeight: '700', color: isDarkColorScheme ? '#fafafa' : '#18181b' }}>
              Web Search Results
            </Text>
          </View>
          {topicName && (
            <Text style={{ fontSize: 12, color: isDarkColorScheme ? '#71717a' : '#a1a1aa', marginLeft: 44 }}>
              {topicName}
            </Text>
          )}
        </View>
      </BottomSheetHeader>

      {isSearching && results.length === 0 ? (
        <BottomSheetView hadHeader={true}>
          <View className="px-4">
            {[1, 2, 3].map((i) => (
              <View 
                key={i} 
                className="mb-3 rounded-lg p-3 border"
                style={{
                  backgroundColor: isDarkColorScheme ? 'rgba(63, 63, 70, 0.5)' : 'rgba(244, 244, 245, 0.5)',
                  borderColor: isDarkColorScheme ? '#3f3f46' : '#e4e4e7',
                }}
              >
                <View 
                  className="h-4 rounded mb-2" 
                  style={{ 
                    width: '75%', 
                    backgroundColor: isDarkColorScheme ? '#3f3f46' : '#e4e4e7' 
                  }} 
                />
                <View 
                  className="h-4 rounded mb-2" 
                  style={{ 
                    width: '100%', 
                    backgroundColor: isDarkColorScheme ? '#3f3f46' : '#e4e4e7' 
                  }} 
                />
                <View 
                  className="h-4 rounded" 
                  style={{ 
                    width: '50%', 
                    backgroundColor: isDarkColorScheme ? '#3f3f46' : '#e4e4e7' 
                  }} 
                />
              </View>
            ))}
          </View>
        </BottomSheetView>
      ) : results.length === 0 ? (
        <BottomSheetView hadHeader={true}>
          <View className="items-center py-16 px-8">
            <Search size={48} color={isDarkColorScheme ? '#6366f1' : '#4f46e5'} />
            <Text style={{ fontSize: 20, fontWeight: '700', color: isDarkColorScheme ? '#fafafa' : '#18181b', textAlign: 'center', marginTop: 16, marginBottom: 8 }}>
              No Results Found
            </Text>
            <Text style={{ fontSize: 14, color: isDarkColorScheme ? '#71717a' : '#a1a1aa', textAlign: 'center' }}>
              No updates were found for this topic
            </Text>
          </View>
        </BottomSheetView>
      ) : (
        <BottomSheetFlatList
          data={results}
          renderItem={renderResultItem}
          keyExtractor={(_item: string, index: number) => index.toString()}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingBottom: 20
          }}
          ListHeaderComponent={
            <View>
              <Pressable
                onPress={handleRefresh}
                disabled={isRefreshing || isSearching}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  paddingVertical: 12,
                  paddingHorizontal: 16,
                  borderRadius: 8,
                  marginBottom: 16,
                  backgroundColor: isRefreshing || isSearching 
                    ? (isDarkColorScheme ? '#27272a' : '#f4f4f5')
                    : (isDarkColorScheme ? '#6366f1' : '#4f46e5'),
                  opacity: isRefreshing || isSearching ? 0.6 : 1,
                }}
              >
                {isRefreshing ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <RefreshCw size={16} color="#ffffff" />
                )}
                <Text style={{ fontSize: 14, fontWeight: '600', color: '#ffffff' }}>
                  {isRefreshing ? 'Searching...' : 'Search Again'}
                </Text>
              </Pressable>
              <View className="flex-row items-center gap-2 mb-4 px-1">
                <ExternalLink size={14} color={isDarkColorScheme ? '#71717a' : '#a1a1aa'} />
                <Text style={{ fontSize: 14, fontWeight: '600', color: isDarkColorScheme ? '#fafafa' : '#18181b' }}>
                  Found {results.length} {results.length === 1 ? 'Update' : 'Updates'}
                </Text>
              </View>
            </View>
          }
        />
      )}
    </BottomSheetContent>
  );
}
