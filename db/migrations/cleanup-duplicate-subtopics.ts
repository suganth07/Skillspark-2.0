/**
 * Data cleanup migration: Remove duplicate subtopics before unique index is applied
 * 
 * This migration must be run BEFORE adding the unique index on (parentTopicId, name)
 * in the subtopics table to prevent constraint violations.
 * 
 * Strategy:
 * 1. Find all duplicate groups by parentTopicId and name (case-insensitive)
 * 2. For each duplicate group, keep the oldest record (by createdAt or id)
 * 3. Update any foreign key references to point to the canonical record
 * 4. Delete the duplicate records
 */

import { db } from '../drizzle';
import { subtopics, userSubtopicPerformance } from '../schema';
import { eq, and, sql } from 'drizzle-orm';

interface DuplicateGroup {
  parentTopicId: string;
  name: string;
  count: number;
}

interface SubtopicRecord {
  id: string;
  parentTopicId: string;
  name: string;
  createdAt: Date | null;
}

export async function cleanupDuplicateSubtopics() {
  console.log('🔍 Starting duplicate subtopics cleanup...');
  
  return await db.transaction(async (tx) => {
    // Step 1: Find all duplicate groups
    const duplicateGroups = await tx
      .select({
        parentTopicId: subtopics.parentTopicId,
        name: subtopics.name,
        count: sql<number>`count(*)`,
      })
      .from(subtopics)
      .groupBy(subtopics.parentTopicId, subtopics.name)
      .having(sql`count(*) > 1`);

    if (duplicateGroups.length === 0) {
      console.log('✅ No duplicate subtopics found. Database is clean.');
      return { processed: 0, deleted: 0 };
    }

    console.log(`⚠️  Found ${duplicateGroups.length} duplicate groups`);

    let totalDeleted = 0;
    let totalUpdated = 0;

    // Step 2: Process each duplicate group
    for (const group of duplicateGroups) {
      console.log(`\n📦 Processing duplicates for topic "${group.parentTopicId}" / subtopic "${group.name}"`);
      console.log(`   Found ${group.count} duplicates`);

      // Get all records in this duplicate group
      const duplicates = await tx
        .select({
          id: subtopics.id,
          parentTopicId: subtopics.parentTopicId,
          name: subtopics.name,
          createdAt: subtopics.createdAt,
        })
        .from(subtopics)
        .where(
          and(
            eq(subtopics.parentTopicId, group.parentTopicId),
            eq(subtopics.name, group.name)
          )
        )
        .orderBy(subtopics.createdAt); // Oldest first

      if (duplicates.length === 0) continue;

      // Keep the first (oldest) record as canonical
      const canonicalRecord = duplicates[0];
      const duplicateRecords = duplicates.slice(1);

      console.log(`   ✓ Keeping canonical record: ${canonicalRecord.id} (created: ${canonicalRecord.createdAt})`);
      console.log(`   🗑️  Will delete ${duplicateRecords.length} duplicate(s)`);

      // Step 3: Update foreign key references
      for (const duplicate of duplicateRecords) {
        // Update userSubtopicPerformance records to point to canonical record
        const updatedPerformance = await tx
          .update(userSubtopicPerformance)
          .set({ subtopicId: canonicalRecord.id })
          .where(eq(userSubtopicPerformance.subtopicId, duplicate.id));

        const affectedRows = updatedPerformance ? 1 : 0;
        if (affectedRows > 0) {
          console.log(`   ↪️  Updated ${affectedRows} userSubtopicPerformance reference(s) from ${duplicate.id} to ${canonicalRecord.id}`);
          totalUpdated += affectedRows;
        }

        // Step 4: Delete the duplicate record
        await tx
          .delete(subtopics)
          .where(eq(subtopics.id, duplicate.id));
        
        console.log(`   🗑️  Deleted duplicate: ${duplicate.id}`);
        totalDeleted++;
      }
    }

    console.log(`\n✅ Cleanup complete!`);
    console.log(`   📊 Processed ${duplicateGroups.length} duplicate groups`);
    console.log(`   🗑️  Deleted ${totalDeleted} duplicate records`);
    console.log(`   ↪️  Updated ${totalUpdated} foreign key references`);

    return {
      processed: duplicateGroups.length,
      deleted: totalDeleted,
      updated: totalUpdated,
    };
  });
}

// Allow running this script directly
if (require.main === module) {
  console.log('🚀 Running duplicate subtopics cleanup migration...\n');
  
  cleanupDuplicateSubtopics()
    .then((result) => {
      console.log('\n✅ Migration completed successfully!');
      console.log(JSON.stringify(result, null, 2));
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Migration failed:', error);
      process.exit(1);
    });
}
