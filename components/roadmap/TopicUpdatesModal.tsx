import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, Pressable, ActivityIndicator, Alert } from 'react-native';
import { Sparkles, RefreshCw, ExternalLink } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { getItem, setItem } from '@/lib/storage';
import * as WebBrowser from 'expo-web-browser';
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

interface TopicUpdate {
  topicId: string;
  topicName: string;
  newSubtopics: string[];
  lastChecked?: string;
}

interface TopicUpdatesModalProps {
  visible: boolean;
  updates: TopicUpdate[];
  isLoading: boolean;
  onClose: () => void;
  onRefresh: () => Promise<void>;
  roadmapId: string;
  sheetRef: React.RefObject<any>;
}

const STORAGE_KEY_PREFIX = 'topic_updates_';

export function TopicUpdatesModal({ 
  visible, 
  updates, 
  isLoading, 
  onClose, 
  onRefresh,
  roadmapId,
  sheetRef
}: TopicUpdatesModalProps) {
  const router = useRouter();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [cachedUpdates, setCachedUpdates] = useState<TopicUpdate[]>([]);
  const [hasAutoRefreshed, setHasAutoRefreshed] = useState(false);
  const storageKey = `${STORAGE_KEY_PREFIX}${roadmapId}`;

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await onRefresh();
    } catch (error) {
      console.error('Failed to refresh updates:', error);
      Alert.alert(
        'Refresh Failed',
        'Unable to fetch latest updates. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsRefreshing(false);
    }
  }, [onRefresh]);

  // Load cached updates when modal opens
  useEffect(() => {
    if (visible) {
      const cached = getItem<TopicUpdate[]>(storageKey);
      if (cached && cached.length > 0) {
        console.log('📦 Loaded cached updates:', cached.length, 'topics');
        setCachedUpdates(cached);
      } else {
        console.log('📦 No cached updates found');
        if (!hasAutoRefreshed && !isLoading) {
          console.log('🔄 Auto-refreshing on first open...');
          setHasAutoRefreshed(true);
          handleRefresh();
        }
      }
    }
  }, [storageKey, visible, roadmapId, hasAutoRefreshed, isLoading, handleRefresh]);

  // Save updates to cache when they change
  useEffect(() => {
    if (updates.length > 0 && isRefreshing === false) {
      const timestampedUpdates = updates.map(update => ({
        ...update,
        lastChecked: new Date().toISOString()
      }));
      console.log('💾 Saving updates to cache:', timestampedUpdates.length, 'topics');
      setItem(storageKey, timestampedUpdates);
      setCachedUpdates(timestampedUpdates);
    }
  }, [updates, storageKey, isRefreshing]);

  const displayUpdates = updates.length > 0 ? updates : cachedUpdates;

  const renderSubtopicItem = ({ item }: { item: { subtopic: string; topicUpdate: TopicUpdate } }) => {
    // Extract URL if it exists in the markdown
    const urlMatch = item.subtopic.match(/\[([^\]]+)\]\(([^)]+)\)/);
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
          <MarkdownText text={item.subtopic} />
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

  // Flatten the data structure for FlatList
  const flattenedData = displayUpdates.flatMap(topic => 
    topic.newSubtopics.map(subtopic => ({
      subtopic,
      topicUpdate: topic,
      key: `${topic.topicId}-${subtopic}`
    }))
  );

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
              <Sparkles size={20} className="text-foreground" />
            </View>
            <Text className="text-lg font-bold text-foreground">
              Topic Updates
            </Text>
          </View>
          <Text className="text-xs text-muted-foreground ml-11">
            {displayUpdates.length} {displayUpdates.length === 1 ? 'topic' : 'topics'}
          </Text>
        </View>
      </BottomSheetHeader>

      {/* Content */}
      {isLoading && displayUpdates.length === 0 ? (
        <BottomSheetView hadHeader={true}>
          <View className="px-4">
            {[1, 2, 3].map((i) => (
              <View key={i} className="mb-4 bg-secondary/50 rounded-lg p-4 border border-border">
                <View className="flex-row items-center justify-between mb-2">
                  <View className="h-5 bg-muted rounded w-1/2" />
                  <View className="h-6 bg-primary/40 rounded-full w-16" />
                </View>
              </View>
            ))}
          </View>
        </BottomSheetView>
      ) : displayUpdates.length === 0 ? (
        <BottomSheetView hadHeader={true}>
          <View className="items-center py-16 px-8">
            <Sparkles size={48} className="text-blue-600 mb-4" />
            <Text className="text-xl font-bold text-foreground text-center mb-2">
              No Updates Yet
            </Text>
            <Text className="text-sm text-muted-foreground text-center">
              Check for updates on your completed topics
            </Text>
          </View>
        </BottomSheetView>
      ) : (
        <BottomSheetFlatList
          data={flattenedData}
          renderItem={renderSubtopicItem}
          keyExtractor={(item: { subtopic: string; topicUpdate: TopicUpdate; key: string }) => item.key}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingBottom: 20
          }}
          ListHeaderComponent={
            <View>
              <Pressable
                onPress={handleRefresh}
                disabled={isRefreshing || isLoading}
                className={`flex-row items-center justify-center gap-2 py-3 px-4 rounded-lg mb-4 ${
                  isRefreshing || isLoading 
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
                  {isRefreshing ? 'Checking...' : 'Check for Updates'}
                </Text>
              </Pressable>
              <View className="flex-row items-center gap-2 mb-4 px-1">
                <ExternalLink size={14} className="text-muted-foreground" />
                <Text className="text-sm font-semibold text-foreground">
                  Found {flattenedData.length} {flattenedData.length === 1 ? 'Update' : 'Updates'}
                </Text>
              </View>
            </View>
          }
        />
      )}
    </BottomSheetContent>
  );
}
