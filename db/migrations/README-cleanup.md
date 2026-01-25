# Data Cleanup Migration Guide

## Overview
Before applying the unique index on `(parentTopicId, name)` in the subtopics table, you **MUST** run the data cleanup migration to remove any duplicate records.

## Running the Migration

### Option 1: Direct Execution (Recommended for Testing)
```bash
# Navigate to project directory
cd c:\Codes-here\SkillSpark

# Run the migration script directly
npx tsx db/migrations/cleanup-duplicate-subtopics.ts
```

### Option 2: Import and Call from Code
```typescript
import { cleanupDuplicateSubtopics } from '@/db/migrations/cleanup-duplicate-subtopics';

// In your migration or setup code
await cleanupDuplicateSubtopics();
```

## What the Migration Does

1. **Identifies Duplicates**: Finds all subtopics with the same `parentTopicId` and `name` (case-sensitive)

2. **Selects Canonical Record**: For each duplicate group, keeps the oldest record (by `createdAt`)

3. **Updates Foreign Keys**: Updates all `userSubtopicPerformance` records to reference the canonical record

4. **Removes Duplicates**: Deletes all non-canonical duplicate records

## Expected Output

```
🚀 Running duplicate subtopics cleanup migration...

🔍 Starting duplicate subtopics cleanup...
⚠️  Found 3 duplicate groups

📦 Processing duplicates for topic "xyz" / subtopic "Introduction"
   Found 2 duplicates
   ✓ Keeping canonical record: abc123 (created: 2026-01-20)
   🗑️  Will delete 1 duplicate(s)
   ↪️  Updated 5 userSubtopicPerformance reference(s) from def456 to abc123
   🗑️  Deleted duplicate: def456

✅ Cleanup complete!
   📊 Processed 3 duplicate groups
   🗑️  Deleted 5 duplicate records
   ↪️  Updated 15 foreign key references

✅ Migration completed successfully!
```

## Safety Features

- **Transaction-based**: All changes are wrapped in a database transaction
- **No data loss**: Foreign key references are updated before deletion
- **Logging**: Detailed console output tracks every operation
- **Idempotent**: Safe to run multiple times

## After Running the Migration

Once the migration completes successfully, the unique index in `db/schema.ts` will be able to apply without constraint violations:

```typescript
uniqueIndex("subtopics_parent_name_idx").on(t.parentTopicId, t.name)
```

## Troubleshooting

If the migration fails:
1. Check the error message for specific issues
2. Verify database connection is working
3. Ensure you have write permissions to the database
4. Review the duplicate groups manually if needed

## Manual Verification (Optional)

To check for duplicates before running the migration:

```sql
SELECT parentTopicId, name, COUNT(*) as count
FROM subtopics
GROUP BY parentTopicId, name
HAVING COUNT(*) > 1;
```
