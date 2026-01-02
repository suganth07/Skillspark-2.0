import * as FileSystem from 'expo-file-system/src/legacy/FileSystem';
import { db } from '@/db/drizzle';
import { topicVideos } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';

// Directory for storing downloaded videos
const VIDEO_DIRECTORY = `${FileSystem.documentDirectory}videos/`;

/**
 * Ensure the video directory exists
 */
async function ensureVideoDirectory(): Promise<void> {
  const dirInfo = await FileSystem.getInfoAsync(VIDEO_DIRECTORY);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(VIDEO_DIRECTORY, { intermediates: true });
    console.log('📁 Created video directory:', VIDEO_DIRECTORY);
  }
}

/**
 * Get existing video for a topic and user
 */
export async function getExistingTopicVideo(topicId: string, userId: string) {
  const result = await db
    .select()
    .from(topicVideos)
    .where(and(eq(topicVideos.topicId, topicId), eq(topicVideos.userId, userId)))
    .limit(1);

  return result[0] || null;
}

/**
 * Check if a local video file exists and is valid
 */
export async function isLocalVideoValid(localFilePath: string | null): Promise<boolean> {
  if (!localFilePath) return false;
  
  try {
    const fileInfo = await FileSystem.getInfoAsync(localFilePath);
    return fileInfo.exists && (fileInfo.size || 0) > 0;
  } catch (error) {
    console.error('Error checking local video:', error);
    return false;
  }
}

/**
 * Download video from remote URL and save locally
 */
export async function downloadVideo(
  remoteUrl: string,
  topicId: string,
  userId: string,
  heygenVideoId: string,
  onProgress?: (progress: number) => void
): Promise<{ localFilePath: string; fileSizeBytes: number }> {
  await ensureVideoDirectory();

  const fileName = `${topicId}_${createId()}.mp4`;
  const localFilePath = `${VIDEO_DIRECTORY}${fileName}`;

  console.log('📥 Downloading video to:', localFilePath);

  // Create or update the video record with downloading status
  const existing = await getExistingTopicVideo(topicId, userId);
  
  if (existing) {
    await db
      .update(topicVideos)
      .set({
        status: 'downloading',
        remoteUrl,
        heygenVideoId,
      })
      .where(eq(topicVideos.id, existing.id));
  } else {
    await db.insert(topicVideos).values({
      id: createId(),
      topicId,
      userId,
      heygenVideoId,
      remoteUrl,
      status: 'downloading',
    });
  }

  try {
    // Download with progress tracking
    const downloadResumable = FileSystem.createDownloadResumable(
      remoteUrl,
      localFilePath,
      {},
      (downloadProgress) => {
        const progress = downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToWrite;
        onProgress?.(progress);
      }
    );

    const result = await downloadResumable.downloadAsync();
    
    if (!result || !result.uri) {
      throw new Error('Download failed - no result');
    }

    // Get file size
    const fileInfo = await FileSystem.getInfoAsync(result.uri);
    const fileSizeBytes = fileInfo.exists ? (fileInfo.size || 0) : 0;

    console.log('✅ Video downloaded successfully:', result.uri, 'Size:', fileSizeBytes);

    // Update record with success
    await db
      .update(topicVideos)
      .set({
        localFilePath: result.uri,
        fileSizeBytes,
        status: 'ready',
        downloadedAt: new Date(),
      })
      .where(and(eq(topicVideos.topicId, topicId), eq(topicVideos.userId, userId)));

    return { localFilePath: result.uri, fileSizeBytes };
  } catch (error) {
    console.error('❌ Video download failed:', error);

    // Update record with error
    await db
      .update(topicVideos)
      .set({ status: 'error' })
      .where(and(eq(topicVideos.topicId, topicId), eq(topicVideos.userId, userId)));

    throw error;
  }
}

/**
 * Save video metadata after generation (before download)
 */
export async function saveVideoMetadata(
  topicId: string,
  userId: string,
  heygenVideoId: string,
  remoteUrl: string
): Promise<string> {
  const existing = await getExistingTopicVideo(topicId, userId);

  if (existing) {
    // Delete old local file if it exists
    if (existing.localFilePath) {
      try {
        await FileSystem.deleteAsync(existing.localFilePath, { idempotent: true });
        console.log('🗑️ Deleted old video file:', existing.localFilePath);
      } catch (e) {
        console.warn('Could not delete old video file:', e);
      }
    }

    // Update existing record
    await db
      .update(topicVideos)
      .set({
        heygenVideoId,
        remoteUrl,
        status: 'pending',
        localFilePath: null,
        fileSizeBytes: null,
        downloadedAt: null,
      })
      .where(eq(topicVideos.id, existing.id));

    return existing.id;
  } else {
    // Create new record
    const id = createId();
    await db.insert(topicVideos).values({
      id,
      topicId,
      userId,
      heygenVideoId,
      remoteUrl,
      status: 'pending',
    });

    return id;
  }
}

/**
 * Delete a topic video (both file and metadata)
 */
export async function deleteTopicVideo(topicId: string, userId: string): Promise<void> {
  const existing = await getExistingTopicVideo(topicId, userId);
  
  if (existing) {
    // Delete local file
    if (existing.localFilePath) {
      try {
        await FileSystem.deleteAsync(existing.localFilePath, { idempotent: true });
        console.log('🗑️ Deleted video file:', existing.localFilePath);
      } catch (e) {
        console.warn('Could not delete video file:', e);
      }
    }

    // Delete database record
    await db.delete(topicVideos).where(eq(topicVideos.id, existing.id));
    console.log('🗑️ Deleted video metadata');
  }
}

/**
 * Get total size of all downloaded videos
 */
export async function getTotalVideoStorageSize(): Promise<number> {
  const videos = await db.select({ size: topicVideos.fileSizeBytes }).from(topicVideos);
  return videos.reduce((total, v) => total + (v.size || 0), 0);
}

/**
 * Clear all downloaded videos
 */
export async function clearAllVideos(): Promise<void> {
  try {
    // Delete all files in video directory
    const dirInfo = await FileSystem.getInfoAsync(VIDEO_DIRECTORY);
    if (dirInfo.exists) {
      await FileSystem.deleteAsync(VIDEO_DIRECTORY, { idempotent: true });
      console.log('🗑️ Cleared video directory');
    }

    // Reset all video records
    await db.update(topicVideos).set({
      localFilePath: null,
      fileSizeBytes: null,
      status: 'pending',
      downloadedAt: null,
    });
  } catch (error) {
    console.error('Error clearing videos:', error);
    throw error;
  }
}
