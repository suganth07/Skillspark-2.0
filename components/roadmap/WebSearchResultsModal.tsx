import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ActivityIndicator, Pressable, Alert } from 'react-native';
import { Search, ExternalLink, RefreshCw } from 'lucide-react-native';
import * as WebBrowser from 'expo-web-browser';
import { getItem, setItem } from '@/lib/storage';
import {
  BottomSheetContent,
  BottomSheetHeader,
  BottomSheetView,
  BottomSheetFlatList,
} from '@/components/primitives/bottomSheet/bottom-sheet.native';

// Component to render markdown text with clickable links
function MarkdownText({ text }: { text: string }) {
  // Filter out "read more" text (case insensitive)
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

interface WebSearchResultsModalProps {
  sheetRef: React.RefObject<any>;
  results: string[];
  isSearching: boolean;
  roadmapTitle?: string;
  roadmapId: string;
  onRefresh: () => Promise<void>;
}

const STORAGE_KEY_PREFIX = 'web_search_results_';

export function WebSearchResultsModal({ 
  sheetRef,
  results,
  isSearching,
  roadmapTitle,
  roadmapId,
  onRefresh
}: WebSearchResultsModalProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [cachedResults, setCachedResults] = useState<string[]>([]);
  const [hasAutoRefreshed, setHasAutoRefreshed] = useState(false);
  const storageKey = `${STORAGE_KEY_PREFIX}${roadmapId}`;

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

  // Load cached results when modal opens
  useEffect(() => {
    const cached = getItem<string[]>(storageKey);
    if (cached && cached.length > 0) {
      console.log('📦 Loaded cached web search results:', cached.length);
      setCachedResults(cached);
    } else {
      console.log('📦 No cached web search results found');
      if (!hasAutoRefreshed && !isSearching) {
        console.log('🔄 Auto-refreshing web search on first open...');
        setHasAutoRefreshed(true);
        handleRefresh();
      }
    }
  }, [storageKey, roadmapId, hasAutoRefreshed, isSearching, handleRefresh]);

  // Save results to cache when they change
  useEffect(() => {
    if (results.length > 0 && !isRefreshing) {
      console.log('💾 Saving web search results to cache:', results.length);
      setItem(storageKey, results);
      setCachedResults(results);
    }
  }, [results, storageKey, isRefreshing]);

  const displayResults = results.length > 0 ? results : cachedResults;

  const renderResultItem = ({ item, index }: { item: string; index: number }) => {
    // Extract URL if it exists in the markdown
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
      <View className="mb-3 bg-card rounded-lg overflow-hidden border border-border shadow-sm">
        <View className="p-3">
          <MarkdownText text={item} />
        </View>
        {url && (
          <>
            <View className="h-px bg-border" />
            <Pressable
              onPress={handleReadMore}
              className="py-2.5 px-3 items-center active:opacity-70 bg-secondary/30"
            >
              <Text className="text-xs font-semibold text-primary">View Source</Text>
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
            <View className="bg-secondary p-2 rounded-md">
              <Search size={20} className="text-foreground" />
            </View>
            <Text className="text-lg font-bold text-foreground">
              Web Search Results
            </Text>
          </View>
          {roadmapTitle && (
            <Text className="text-xs text-muted-foreground ml-11">
              {roadmapTitle}
            </Text>
          )}
        </View>
      </BottomSheetHeader>

      {isSearching && displayResults.length === 0 ? (
        <BottomSheetView hadHeader={true}>
          <View className="px-4">
            {[1, 2, 3].map((i) => (
              <View key={i} className="mb-3 bg-secondary/50 rounded-lg p-3 border border-border">
                <View className="h-4 bg-muted rounded mb-2 w-3/4" />
                <View className="h-4 bg-muted rounded mb-2 w-full" />
                <View className="h-4 bg-muted rounded w-1/2" />
              </View>
            ))}
          </View>
        </BottomSheetView>
      ) : displayResults.length === 0 ? (
        <BottomSheetView hadHeader={true}>
          <View className="items-center py-16 px-8">
            <Search size={48} className="text-blue-600 mb-4" />
            <Text className="text-xl font-bold text-foreground text-center mb-2">
              No Results Found
            </Text>
            <Text className="text-sm text-muted-foreground text-center">
              No updates were found for this roadmap
            </Text>
          </View>
        </BottomSheetView>
      ) : (
        <BottomSheetFlatList
          data={displayResults}
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
                className={`flex-row items-center justify-center gap-2 py-3 px-4 rounded-lg mb-4 ${
                  isRefreshing || isSearching 
                    ? 'bg-secondary/50' 
                    : 'bg-primary active:opacity-90'
                }`}
              >
                <RefreshCw 
                  key={isRefreshing ? 'spinning' : 'static'}
                  size={16} 
                  className={`${isRefreshing ? 'animate-spin' : ''} text-primary-foreground`}
                />
                <Text className="text-sm font-bold text-primary-foreground">
                  {isRefreshing ? 'Searching...' : 'Search Again'}
                </Text>
              </Pressable>
              <View className="flex-row items-center gap-2 mb-4 px-1">
                <ExternalLink size={14} className="text-muted-foreground" />
                <Text className="text-sm font-semibold text-foreground">
                  Found {displayResults.length} {displayResults.length === 1 ? 'Update' : 'Updates'}
                </Text>
              </View>
            </View>
          }
        />
      )}
    </BottomSheetContent>
  );
}
