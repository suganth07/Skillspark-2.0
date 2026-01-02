import * as FileSystem from 'expo-file-system/src/legacy/FileSystem';
import { db } from '@/db/drizzle';
import { topicVideos } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';

/**
 * Get the video directory path (resolved at runtime)
 */
function getVideoDirectory(): string {
  if (!FileSystem.documentDirectory) {
    throw new Error('FileSystem.documentDirectory is not available');
  }
  return `${FileSystem.documentDirectory}videos/`;
}

/**
 * Ensure the video directory exists
 */
async function ensureVideoDirectory(): Promise<void> {
  const videoDir = getVideoDirectory();
  const dirInfo = await FileSystem.getInfoAsync(videoDir);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(videoDir, { intermediates: true });
    console.log('📁 Created video directory:', videoDir);
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

  // Use deterministic filename to avoid orphaned files on retry
  const fileName = `${topicId}_${userId}.mp4`;
  const localFilePath = `${getVideoDirectory()}${fileName}`;

  console.log('📥 Downloading video to:', localFilePath);

  // Delete any existing partial file from previous failed attempts
  try {
    await FileSystem.deleteAsync(localFilePath, { idempotent: true });
  } catch (e) {
    // Ignore if file doesn't exist
  }

  // Upsert the video record with downloading status (atomic to handle concurrent calls)
  await db
    .insert(topicVideos)
    .values({
      id: createId(),
      topicId,
      userId,
      heygenVideoId,
      remoteUrl,
      status: 'downloading',
      localFilePath: null,
      fileSizeBytes: null,
      downloadedAt: null,
    })
    .onConflictDoUpdate({
      target: [topicVideos.topicId, topicVideos.userId],
      set: {
        status: 'downloading',
        remoteUrl,
        heygenVideoId,
        localFilePath: null,
        fileSizeBytes: null,
        downloadedAt: null,
      },
    });

  try {
    // Download with progress tracking
    const downloadResumable = FileSystem.createDownloadResumable(
      remoteUrl,
      localFilePath,
      {},
      (downloadProgress) => {
        const progress = downloadProgress.totalBytesExpectedToWrite > 0
          ? downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToWrite
          : 0;
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

    // Delete partial file if it exists
    try {
      await FileSystem.deleteAsync(localFilePath, { idempotent: true });
    } catch (e) {
      // Ignore cleanup errors
    }

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
  // const existing = await getExistingTopicVideo(topicId, userId);

  // if (existing) {
  //   // Delete old local file if it exists
  //   if (existing.localFilePath) {
  const existing = await getExistingTopicVideo(topicId, userId);
  if (existing?.localFilePath) {
      try {
        await FileSystem.deleteAsync(existing.localFilePath, { idempotent: true });
        console.log('🗑️ Deleted old video file:', existing.localFilePath);
      } catch (e) {
        console.warn('Could not delete old video file:', e);
      }
    }

  const id = existing?.id ?? createId();
  
  await db
    .insert(topicVideos)
    .values({
      id,
      topicId,
      userId,
      heygenVideoId,
      remoteUrl,
      status: 'pending',
      localFilePath: null,
      fileSizeBytes: null,
      downloadedAt: null,
    })
    .onConflictDoUpdate({
      target: [topicVideos.topicId, topicVideos.userId],
      set: {
        heygenVideoId,
        remoteUrl,
        status: 'pending',
        localFilePath: null,
        fileSizeBytes: null,
        downloadedAt: null,
      },
    });
  return id;
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
    const videoDir = getVideoDirectory();
    const dirInfo = await FileSystem.getInfoAsync(videoDir);
    if (dirInfo.exists) {
      await FileSystem.deleteAsync(videoDir, { idempotent: true });
      console.log('🗑️ Cleared video directory');
    }

    // Recreate the directory to keep service in usable state
    await ensureVideoDirectory();
    console.log('📁 Recreated video directory');

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
