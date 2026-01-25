# Subtopic Ordering Race Condition Fix

## Problem
The original implementation had a race condition in `createSubtopics()` where concurrent transactions could read the same `max(order)` value and then both insert subtopics with duplicate order values. This occurred because:

1. Transaction A reads `max(order) = 5`
2. Transaction B reads `max(order) = 5` (before A commits)
3. Both try to insert with order values starting from 6
4. Result: duplicate orders (6, 7, 8...) from both transactions

## Solution
Implemented a three-part fix:

### 1. Database Schema Change
Added a unique constraint on `(parentTopicId, order)` in the subtopics table:
```typescript
uniqueIndex("subtopics_parent_order_idx").on(t.parentTopicId, t.order)
```

### 2. Atomic Order Assignment with Retry
Modified `createSubtopics()` to:
- Query `max(order)` atomically within each insert attempt
- Catch unique constraint violations on order conflicts
- Retry with exponential backoff (10ms, 20ms, 40ms, 80ms, 160ms)
- Maximum 5 retry attempts per subtopic

### 3. Migration
Created migration `0001_add_unique_subtopic_order.sql` that:
- Cleans up any existing duplicate orders
- Adds the unique index to the database

## How It Works

```typescript
// Helper function with retry logic
const insertSubtopicWithRetry = async (subtopic, maxRetries = 5) => {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      // Query max order atomically
      const maxOrder = await tx.select({ maxOrder: max(subtopics.order) })
        .from(subtopics)
        .where(eq(subtopics.parentTopicId, parentTopicId));
      
      const nextOrder = (maxOrder[0]?.maxOrder ?? -1) + 1;
      
      // Attempt insert
      await tx.insert(subtopics).values({
        ...subtopicData,
        order: nextOrder
      });
      
      return; // Success!
    } catch (error) {
      if (isOrderConflict(error) && attempt < maxRetries - 1) {
        // Retry with exponential backoff
        await delay(Math.pow(2, attempt) * 10);
        continue;
      }
      throw error;
    }
  }
};
```

## Benefits
- ✅ Prevents duplicate order values
- ✅ Handles concurrent insertions gracefully
- ✅ Maintains order consistency
- ✅ Automatic retry with backoff reduces conflicts
- ✅ Database constraint ensures data integrity

## Running the Migration

To apply the migration to your database:

```bash
# If using Drizzle Kit
npm run db:push

# Or manually run the SQL
sqlite3 your-database.db < db/migrations/0001_add_unique_subtopic_order.sql
```

## Testing

To test concurrent behavior:
```typescript
// Run multiple createSubtopics calls concurrently
await Promise.all([
  createSubtopics(topicId, subtopics1, 'original'),
  createSubtopics(topicId, subtopics2, 'original'),
  createSubtopics(topicId, subtopics3, 'original'),
]);

// Verify no duplicates
const result = await db
  .select({ parentTopicId: subtopics.parentTopicId, order: subtopics.order })
  .from(subtopics)
  .groupBy(subtopics.parentTopicId, subtopics.order)
  .having(sql`COUNT(*) > 1`);

console.log('Duplicates:', result); // Should be empty
```
