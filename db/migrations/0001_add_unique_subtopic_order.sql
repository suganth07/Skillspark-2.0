-- Migration: Add unique constraint on (parentTopicId, order) to prevent race conditions
-- Created: 2026-01-25
-- Description: Ensures atomic order assignment for subtopics and prevents duplicate orders
--              when concurrent transactions insert subtopics for the same parent topic.

-- Step 1: First, clean up any existing duplicate orders (if any)
-- This finds duplicates and keeps the one with the earliest createdAt
WITH ranked_subtopics AS (
  SELECT 
    id,
    parentTopicId,
    "order",
    ROW_NUMBER() OVER (PARTITION BY parentTopicId, "order" ORDER BY createdAt ASC) as rn
  FROM subtopics
)
UPDATE subtopics
SET "order" = (
  SELECT MAX("order") + 1
  FROM subtopics s2
  WHERE s2.parentTopicId = subtopics.parentTopicId
)
WHERE id IN (
  SELECT id FROM ranked_subtopics WHERE rn > 1
);

-- Step 2: Create the unique index on (parentTopicId, order)
-- Note: SQLite uses CREATE UNIQUE INDEX instead of ALTER TABLE ADD CONSTRAINT
CREATE UNIQUE INDEX IF NOT EXISTS "subtopics_parent_order_idx" 
ON "subtopics" ("parent_topic_id", "order");

-- Verification: Check that no duplicates exist
-- Run this after migration to verify:
-- SELECT parentTopicId, "order", COUNT(*) as cnt 
-- FROM subtopics 
-- GROUP BY parentTopicId, "order" 
-- HAVING COUNT(*) > 1;
