import React, { useState, useEffect, useCallback } from 'react';
import { View, ActivityIndicator, Alert, Pressable } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { getItem, setItem, removeItem } from '@/lib/storage';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { APIKeyRequiredDialog } from '@/components/ui/api-key-required-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Video, Trash2, RefreshCw } from '@/components/Icons';
import { Video as ExpoVideo, ResizeMode } from 'expo-av';
import { geminiService } from '@/lib/gemini';
import { heygenGenerateVideo, waitForHeygenVideoUrl } from '@/server/heygenClient';
import { HEYGEN_AVATAR_ID, HEYGEN_VOICE_ID } from '@/lib/constants';
import { router } from 'expo-router';
import {
  getExistingTopicVideo,
  isLocalVideoValid,
  downloadVideo,
  saveVideoMetadata,
  deleteTopicVideo,
} from '@/lib/videoService';
import type { TopicSubtopic } from '@/lib/gemini';

type VideoGenerationStatus =
  | 'idle'
  | 'loading-existing'
  | 'generating-script'
  | 'sending-to-heygen'
  | 'rendering'
  | 'downloading'
  | 'completed'
  | 'error';

interface TopicVideoGeneratorProps {
  topicId: string;
  topicName: string;
  userId: string;
  subtopics: TopicSubtopic[];
}

export function TopicVideoGenerator({
  topicId,
  topicName,
  userId,
  subtopics,
}: TopicVideoGeneratorProps) {
  const [videoStatus, setVideoStatus] = useState<VideoGenerationStatus>('idle');
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<number>(0);
  const [isLocalVideo, setIsLocalVideo] = useState<boolean>(false);
  const [showApiKeyDialog, setShowApiKeyDialog] = useState(false);
  const [showLengthDialog, setShowLengthDialog] = useState(false);
  const [selectedLength, setSelectedLength] = useState<number>(60); // Default 1 minute

  const loadExistingVideo = useCallback(async () => {
    try {
      setVideoStatus('loading-existing');
      
      // Check if there's an ongoing generation
      const storageKey = `video_generation_${topicId}`;
      const savedState = getItem<{ status: VideoGenerationStatus; error?: string }>(storageKey);
      
      if (savedState && savedState.status !== 'idle' && savedState.status !== 'completed' && savedState.status !== 'error') {
        console.log('📹 Restoring video generation state:', savedState.status);
        setVideoStatus(savedState.status);
        if (savedState.error) {
          setVideoError(savedState.error);
        }
        return;
      }
      
      const existingVideo = await getExistingTopicVideo(topicId, userId);

      if (existingVideo) {
        // Check if local file exists and is valid
        if (existingVideo.localFilePath && (await isLocalVideoValid(existingVideo.localFilePath))) {
          console.log('📹 Loading existing local video:', existingVideo.localFilePath);
          setVideoUrl(existingVideo.localFilePath);
          setIsLocalVideo(true);
          setVideoStatus('completed');
          // Clear any saved generation state
          removeItem(storageKey);
          return;
        }

        // If we have a remote URL but no local file, just show idle state
        console.log('📹 Existing video found but local file missing');
      }

      setVideoStatus('idle');
      // Clear any saved generation state
      removeItem(storageKey);
    } catch (err) {
      console.error('Error loading existing video:', err);
      setVideoStatus('idle');
    }
  }, [topicId, userId]);

  // Load existing video on mount
  useEffect(() => {
    if (topicId && userId) {
      loadExistingVideo();
    }
  }, [topicId, userId, loadExistingVideo]);

  // Save video generation state to storage when status changes
  useEffect(() => {
    const storageKey = `video_generation_${topicId}`;
    if (videoStatus !== 'idle' && videoStatus !== 'completed' && videoStatus !== 'loading-existing') {
      setItem(storageKey, { status: videoStatus, error: videoError });
    } else if (videoStatus === 'completed' || videoStatus === 'idle') {
      removeItem(storageKey);
    }
  }, [videoStatus, videoError, topicId]);

  const handleGenerateVideo = useCallback(async (lengthInSeconds: number) => {
    try {
      // Fetch HeyGen API key from SecureStore
      const HEYGEN_API_KEY = await SecureStore.getItemAsync('api_key_heygen');
      
      if (!HEYGEN_API_KEY || !HEYGEN_API_KEY.trim()) {
        setShowApiKeyDialog(true);
        return;
      }
      setVideoStatus('generating-script');
      setVideoError(null);
      setIsLocalVideo(false);

      console.log('📹 Starting video generation for topic:', topicName);
      console.log('📹 Video length:', lengthInSeconds, 'seconds');
      console.log('📹 Using Avatar ID:', HEYGEN_AVATAR_ID);
      console.log('📹 Using Voice ID:', HEYGEN_VOICE_ID);

      // Generate video script using Gemini with specified length
      const script = await geminiService.generateVideoScript(topicName, topicName, subtopics, 'default', lengthInSeconds);

      console.log('📹 Generated video script:', script);
      console.log('📹 Script length:', script.length, 'characters');

      setVideoStatus('sending-to-heygen');

      // Build HeyGen payload
      const payload = {
        video_inputs: [
          {
            character: {
              type: 'avatar',
              avatar_id: HEYGEN_AVATAR_ID,
            },
            voice: {
              type: 'text',
              voice_id: HEYGEN_VOICE_ID,
              input_text: script,
            },
          },
        ],
        dimension: {
          width: 1280,
          height: 720,
        },
      };

      // Send to HeyGen
      const generateResponse = await heygenGenerateVideo(HEYGEN_API_KEY, payload);
      const videoId = generateResponse?.data?.video_id || generateResponse?.video_id;

      if (!videoId) {
        throw new Error('No video ID returned from HeyGen');
      }

      console.log('📹 HeyGen video ID:', videoId);

      setVideoStatus('rendering');

      // Poll for completion
      const remoteUrl = await waitForHeygenVideoUrl(HEYGEN_API_KEY, videoId, {
        intervalMs: 3000,
        timeoutMs: 10 * 60 * 1000, // 10 minutes timeout
      });

      console.log('📹 Video URL:', remoteUrl);

      // Save metadata to database
      await saveVideoMetadata(topicId, userId, videoId, remoteUrl);

      // Download video to local storage
      setVideoStatus('downloading');
      setDownloadProgress(0);

      const { localFilePath } = await downloadVideo(
        remoteUrl,
        topicId,
        userId,
        videoId,
        (progress) => setDownloadProgress(progress)
      );

      console.log('📹 Video downloaded to:', localFilePath);
      setVideoUrl(localFilePath);
      setIsLocalVideo(true);
      setVideoStatus('completed');
      // Clear storage state on success
      removeItem(`video_generation_${topicId}`);
    } catch (err) {
      console.error('📹 Video generation error:', err);
      const errorMsg = err instanceof Error ? err.message : String(err);
      setVideoError(errorMsg);
      setVideoStatus('error');
      // Save error state to storage
      setItem(`video_generation_${topicId}`, { status: 'error', error: errorMsg });
    }
  }, [topicId, userId, topicName, subtopics]);

  const handleShowLengthDialog = useCallback(() => {
    setShowLengthDialog(true);
  }, []);

  const handleConfirmGenerate = useCallback(() => {
    setShowLengthDialog(false);
    handleGenerateVideo(selectedLength);
  }, [selectedLength, handleGenerateVideo]);

  const handleDeleteVideo = useCallback(async () => {
    try {
      await deleteTopicVideo(topicId, userId);
      setVideoUrl(null);
      setVideoStatus('idle');
      setIsLocalVideo(false);
      // Clear storage state
      removeItem(`video_generation_${topicId}`);
      console.log('🗑️ Video deleted successfully');
    } catch (err) {
      console.error('Error deleting video:', err);
    }
  }, [topicId, userId]);

  const getVideoStatusMessage = useCallback(() => {
    switch (videoStatus) {
      case 'loading-existing':
        return 'Checking for existing video...';
      case 'generating-script':
        return 'Generating 2-second script...';
      case 'sending-to-heygen':
        return 'Sending to HeyGen...';
      case 'rendering':
        return 'Rendering video (typically 30-60 seconds)...';
      case 'downloading':
        return `Downloading video... ${Math.round(downloadProgress * 100)}%`;
      case 'completed':
        return isLocalVideo ? 'Video ready (saved locally)' : 'Video ready!';
      case 'error':
        return videoError || 'An error occurred';
      default:
        return '';
    }
  }, [videoStatus, downloadProgress, isLocalVideo, videoError]);

  return (
    <>
    <Card className="mb-4">
      <CardHeader>
        <View className="flex-row items-center gap-2 space-x-2 mb-2">
          <Video className="h-5 w-5 text-primary" />
          <CardTitle>AI Video Explanation</CardTitle>
        </View>
        <Text className="text-sm text-muted-foreground">
          Generate a short AI video explaining this topic
        </Text>
      </CardHeader>
      <CardContent>
        {videoStatus === 'loading-existing' && (
          <View className="items-center py-4">
            <ActivityIndicator size="small" className="mb-2" />
            <Text className="text-sm text-muted-foreground text-center">
              Checking for existing video...
            </Text>
          </View>
        )}

        {videoStatus === 'idle' && !videoUrl && (
          <Button
            onPress={handleShowLengthDialog}
            className="w-full"
          >
            <Text className="text-primary-foreground font-medium">Generate Video</Text>
          </Button>
        )}

        {(videoStatus === 'generating-script' ||
          videoStatus === 'sending-to-heygen' ||
          videoStatus === 'rendering') && (
          <View className="items-center py-4">
            <ActivityIndicator size="large" className="mb-3" />
            <Text className="text-sm text-muted-foreground text-center">
              {getVideoStatusMessage()}
            </Text>
            {videoStatus === 'rendering' && (
              <Text className="text-xs text-muted-foreground text-center mt-2">
                Short videos render quickly
              </Text>
            )}
          </View>
        )}

        {videoStatus === 'downloading' && (
          <View className="items-center py-4">
            <ActivityIndicator size="large" className="mb-3" />
            <Text className="text-sm text-muted-foreground text-center">
              {getVideoStatusMessage()}
            </Text>
            <View className="w-full h-2 bg-gray-200 rounded-full mt-3 overflow-hidden">
              <View
                className="h-full bg-blue-500 rounded-full"
                style={{ width: `${downloadProgress * 100}%` }}
              />
            </View>
          </View>
        )}

        {videoStatus === 'error' && (
          <View className="items-center py-4">
            <View className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg mb-3">
              <Text className="text-sm font-semibold text-red-700 dark:text-red-400 mb-2">
                Video Generation Error
              </Text>
              <Text className="text-xs text-red-600 dark:text-red-300">
                {videoError || 'Failed to generate video'}
              </Text>
            </View>
            <Button
              onPress={handleShowLengthDialog}
              variant="outline"
              className="flex-row items-center space-x-2"
            >
              <Text>Try Again</Text>
            </Button>
          </View>
        )}

        {videoStatus === 'completed' && videoUrl && (
          <View className="space-y-3">
            {isLocalVideo && (
              <Badge className="bg-green-100 self-start mb-2">
                <Text className="text-xs text-green-700">Saved locally</Text>
              </Badge>
            )}
            <View className="rounded-lg overflow-hidden bg-black">
              <ExpoVideo
                source={{ uri: videoUrl }}
                style={{ width: '100%', aspectRatio: 16 / 9 }}
                useNativeControls
                resizeMode={ResizeMode.CONTAIN}
                isLooping={false}
              />
            </View>
            <View className="flex-row justify-end gap-3 mt-3">
              <Pressable
                onPress={handleDeleteVideo}
                className="p-2 rounded-lg border border-destructive/30 bg-destructive/10 active:bg-destructive/20"
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Pressable>
              <Pressable
                onPress={handleShowLengthDialog}
                className="p-2 rounded-lg border border-border bg-secondary active:bg-secondary/70"
              >
                <RefreshCw className="h-4 w-4 text-foreground" />
              </Pressable>
            </View>
          </View>
        )}
      </CardContent>
    </Card>

    {/* Video Length Selection Dialog */}
    <Dialog open={showLengthDialog} onOpenChange={setShowLengthDialog}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Choose Video Length</DialogTitle>
        </DialogHeader>
        <View className="gap-3 py-4">
          <Text className="text-sm text-muted-foreground mb-1">
            Select your preferred video duration:
          </Text>
          
          <View className="flex-row gap-3">
            <Pressable
              onPress={() => setSelectedLength(10)}
              className={`flex-1 p-3 rounded-lg border-2 ${selectedLength === 10 ? 'border-primary bg-primary/10' : 'border-border bg-card'}`}
            >
              <Text className={`font-semibold text-center ${selectedLength === 10 ? 'text-primary' : 'text-foreground'}`}>10s</Text>
              <Text className="text-xs text-muted-foreground text-center mt-0.5">Ultra short</Text>
            </Pressable>

            <Pressable
              onPress={() => setSelectedLength(30)}
              className={`flex-1 p-3 rounded-lg border-2 ${selectedLength === 30 ? 'border-primary bg-primary/10' : 'border-border bg-card'}`}
            >
              <Text className={`font-semibold text-center ${selectedLength === 30 ? 'text-primary' : 'text-foreground'}`}>30s</Text>
              <Text className="text-xs text-muted-foreground text-center mt-0.5">Quick</Text>
            </Pressable>

            <Pressable
              onPress={() => setSelectedLength(45)}
              className={`flex-1 p-3 rounded-lg border-2 ${selectedLength === 45 ? 'border-primary bg-primary/10' : 'border-border bg-card'}`}
            >
              <Text className={`font-semibold text-center ${selectedLength === 45 ? 'text-primary' : 'text-foreground'}`}>45s</Text>
              <Text className="text-xs text-muted-foreground text-center mt-0.5">Brief</Text>
            </Pressable>
          </View>

          <View className="flex-row gap-3">
            <Pressable
              onPress={() => setSelectedLength(60)}
              className={`flex-1 p-3 rounded-lg border-2 ${selectedLength === 60 ? 'border-primary bg-primary/10' : 'border-border bg-card'}`}
            >
              <Text className={`font-semibold text-center ${selectedLength === 60 ? 'text-primary' : 'text-foreground'}`}>1m</Text>
              <Text className="text-xs text-muted-foreground text-center mt-0.5">Short</Text>
            </Pressable>

            <Pressable
              onPress={() => setSelectedLength(90)}
              className={`flex-1 p-3 rounded-lg border-2 ${selectedLength === 90 ? 'border-primary bg-primary/10' : 'border-border bg-card'}`}
            >
              <Text className={`font-semibold text-center ${selectedLength === 90 ? 'text-primary' : 'text-foreground'}`}>1.5m</Text>
              <Text className="text-xs text-muted-foreground text-center mt-0.5">Concise</Text>
            </Pressable>

            <Pressable
              onPress={() => setSelectedLength(120)}
              className={`flex-1 p-3 rounded-lg border-2 ${selectedLength === 120 ? 'border-primary bg-primary/10' : 'border-border bg-card'}`}
            >
              <Text className={`font-semibold text-center ${selectedLength === 120 ? 'text-primary' : 'text-foreground'}`}>2m</Text>
              <Text className="text-xs text-muted-foreground text-center mt-0.5">Medium</Text>
            </Pressable>
          </View>

          <View className="flex-row gap-3">
            <Pressable
              onPress={() => setSelectedLength(180)}
              className={`flex-1 p-3 rounded-lg border-2 ${selectedLength === 180 ? 'border-primary bg-primary/10' : 'border-border bg-card'}`}
            >
              <Text className={`font-semibold text-center ${selectedLength === 180 ? 'text-primary' : 'text-foreground'}`}>3m</Text>
              <Text className="text-xs text-muted-foreground text-center mt-0.5">Long</Text>
            </Pressable>

            <Pressable
              onPress={() => setSelectedLength(240)}
              className={`flex-1 p-3 rounded-lg border-2 ${selectedLength === 240 ? 'border-primary bg-primary/10' : 'border-border bg-card'}`}
            >
              <Text className={`font-semibold text-center ${selectedLength === 240 ? 'text-primary' : 'text-foreground'}`}>4m</Text>
              <Text className="text-xs text-muted-foreground text-center mt-0.5">Extended</Text>
            </Pressable>

            <Pressable
              onPress={() => setSelectedLength(300)}
              className={`flex-1 p-3 rounded-lg border-2 ${selectedLength === 300 ? 'border-primary bg-primary/10' : 'border-border bg-card'}`}
            >
              <Text className={`font-semibold text-center ${selectedLength === 300 ? 'text-primary' : 'text-foreground'}`}>5m</Text>
              <Text className="text-xs text-muted-foreground text-center mt-0.5">Full</Text>
            </Pressable>
          </View>
        </View>
        <View className="pt-4 border-t border-border">
          <View className="flex-row gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onPress={() => setShowLengthDialog(false)}
            >
              <Text>Cancel</Text>
            </Button>
            <Button
              className="flex-1"
              onPress={handleConfirmGenerate}
            >
              <Text>Generate</Text>
            </Button>
          </View>
        </View>
      </DialogContent>
    </Dialog>

    <APIKeyRequiredDialog
      open={showApiKeyDialog}
      onOpenChange={setShowApiKeyDialog}
      title="API Key Required"
      description="HeyGen API key is required to generate videos. Please configure it in Settings."
      onGoToSettings={() => router.push('/(tabs)/settings')}
    />
  </>
  );
}
