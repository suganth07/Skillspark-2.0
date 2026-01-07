import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, Pressable, ActivityIndicator, Alert } from 'react-native';
import { Sparkles, RefreshCw, ExternalLink } from 'lucide-react-native';
import { getItem, setItem } from '@/lib/storage';
import { useColorScheme } from '@/lib/useColorScheme';
import * as WebBrowser from 'expo-web-browser';
import MarkdownText from '@/components/ui/MarkdownText';
import {
  BottomSheetContent,
  BottomSheetHeader,
  BottomSheetView,
  BottomSheetFlatList,
} from '@/components/primitives/bottomSheet/bottom-sheet.native';

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
  const { isDarkColorScheme } = useColorScheme();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [cachedUpdates, setCachedUpdates] = useState<TopicUpdate[]>([]);
  const [hasAutoRefreshed, setHasAutoRefreshed] = useState(false);
  const hasLoadedCache = useRef(false);
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

  // Load cached updates when modal opens (only once)
  useEffect(() => {
    if (visible && !hasLoadedCache.current) {
      hasLoadedCache.current = true;
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
    // Reset the flag when modal closes
    if (!visible) {
      hasLoadedCache.current = false;
    }
  }, [visible, handleRefresh, hasAutoRefreshed, isLoading, storageKey]);

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
      <View 
        className="mb-3 rounded-lg overflow-hidden border shadow-sm"
        style={{
          backgroundColor: isDarkColorScheme ? '#27272a' : '#ffffff',
          borderColor: isDarkColorScheme ? '#3f3f46' : '#e4e4e7',
        }}
      >
        <View className="p-3">
          <MarkdownText text={item.subtopic} />
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
            <View 
              className="p-2 rounded-md"
              style={{ backgroundColor: isDarkColorScheme ? '#27272a' : '#f4f4f5' }}
            >
              <Sparkles size={20} color={isDarkColorScheme ? '#818cf8' : '#6366f1'} />
            </View>
            <Text style={{ fontSize: 18, fontWeight: '700', color: isDarkColorScheme ? '#fafafa' : '#18181b' }}>
              Topic Updates
            </Text>
          </View>
          <Text style={{ fontSize: 12, color: isDarkColorScheme ? '#71717a' : '#a1a1aa', marginLeft: 44 }}>
            {displayUpdates.length} {displayUpdates.length === 1 ? 'topic' : 'topics'}
          </Text>
        </View>
      </BottomSheetHeader>

      {/* Content */}
      {isLoading && displayUpdates.length === 0 ? (
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
                  style={{ width: '75%', backgroundColor: isDarkColorScheme ? '#3f3f46' : '#e4e4e7' }} 
                />
                <View 
                  className="h-4 rounded mb-2" 
                  style={{ width: '100%', backgroundColor: isDarkColorScheme ? '#3f3f46' : '#e4e4e7' }} 
                />
                <View 
                  className="h-4 rounded" 
                  style={{ width: '50%', backgroundColor: isDarkColorScheme ? '#3f3f46' : '#e4e4e7' }} 
                />
              </View>
            ))}
          </View>
        </BottomSheetView>
      ) : displayUpdates.length === 0 ? (
        <BottomSheetView hadHeader={true}>
          <View className="items-center py-16 px-8">
            <Sparkles size={48} color={isDarkColorScheme ? '#6366f1' : '#4f46e5'} />
            <Text style={{ fontSize: 20, fontWeight: '700', color: isDarkColorScheme ? '#fafafa' : '#18181b', textAlign: 'center', marginTop: 16, marginBottom: 8 }}>
              No Updates Yet
            </Text>
            <Text style={{ fontSize: 14, color: isDarkColorScheme ? '#71717a' : '#a1a1aa', textAlign: 'center' }}>
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
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  paddingVertical: 12,
                  paddingHorizontal: 16,
                  borderRadius: 8,
                  marginBottom: 16,
                  backgroundColor: isRefreshing || isLoading 
                    ? (isDarkColorScheme ? '#27272a' : '#f4f4f5')
                    : (isDarkColorScheme ? '#6366f1' : '#4f46e5'),
                  opacity: isRefreshing || isLoading ? 0.6 : 1,
                }}
              >
                {isRefreshing ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <RefreshCw size={16} color="#ffffff" />
                )}
                <Text style={{ fontSize: 14, fontWeight: '600', color: '#ffffff' }}>
                  {isRefreshing ? 'Checking...' : 'Check for Updates'}
                </Text>
              </Pressable>
              <View className="flex-row items-center gap-2 mb-4 px-1">
                <ExternalLink size={14} color={isDarkColorScheme ? '#71717a' : '#a1a1aa'} />
                <Text style={{ fontSize: 14, fontWeight: '600', color: isDarkColorScheme ? '#fafafa' : '#18181b' }}>
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
