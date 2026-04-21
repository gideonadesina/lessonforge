import { useEffect, useRef, useState } from "react";
import { createBrowserSupabase } from "@/lib/supabase/browser";

type CacheEntry = {
  data: any;
  timestamp: number;
};

type PendingRequest = Promise<any>;

// In-memory cache with TTL support
const lessonCache = new Map<string, CacheEntry>();
const pendingRequests = new Map<string, PendingRequest>();
const CACHE_TTL_MS = 1000 * 60 * 60; // 1 hour

/**
 * Hook for fetching lesson content with built-in caching and deduplication.
 * 
 * Features:
 * - In-memory caching of lesson content
 * - Request deduplication (concurrent requests for same ID share one fetch)
 * - Instant return for cached content
 * - No redundant Supabase calls
 */
export function useLessonCache(lessonId: string | null) {
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const supabaseRef = useRef<any>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!lessonId) {
      setData(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    // Initialize Supabase client once
    if (!supabaseRef.current) {
      supabaseRef.current = createBrowserSupabase();
    }

    const fetchLessonContent = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // 1. Check cache first
        const cached = lessonCache.get(lessonId);
        if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
          console.log(`[LessonCache] ✓ Cache hit for lesson ${lessonId}`);
          setData(cached.data);
          setIsLoading(false);
          return;
        }

        // 2. Check if request is already in flight for this lesson
        if (pendingRequests.has(lessonId)) {
          console.log(`[LessonCache] ⚡ Deduplicating request for lesson ${lessonId}`);
          const pendingData = await pendingRequests.get(lessonId)!;
          setData(pendingData);
          setIsLoading(false);
          return;
        }

        // 3. Create new abort controller for this fetch
        abortControllerRef.current = new AbortController();

        // 4. Create the fetch promise
        const fetchPromise = (async () => {
          console.log(`[LessonCache] 🔄 Fetching lesson content for ${lessonId}`);

          const { data: fullLesson, error } = await supabaseRef.current
            .from("lessons")
            .select("id, subject, topic, grade, curriculum, result_json, content, created_at")
            .eq("id", lessonId)
            .single();

          if (error) {
            throw new Error(`Failed to fetch lesson: ${error.message}`);
          }

          if (!fullLesson) {
            throw new Error("Lesson not found");
          }

          // Cache the result
          lessonCache.set(lessonId, {
            data: fullLesson,
            timestamp: Date.now(),
          });

          console.log(`[LessonCache] ✓ Cached lesson ${lessonId}`);
          return fullLesson;
        })();

        // 5. Add to pending requests
        pendingRequests.set(lessonId, fetchPromise);

        // 6. Await the fetch
        const result = await fetchPromise;
        setData(result);
      } catch (err: any) {
        if (err.name === "AbortError") {
          console.log(`[LessonCache] ⏸  Fetch aborted for lesson ${lessonId}`);
          return;
        }
        console.error(`[LessonCache] ✗ Error loading lesson ${lessonId}:`, err);
        setError(err instanceof Error ? err : new Error(String(err)));
      } finally {
        // Remove from pending requests
        pendingRequests.delete(lessonId);
        setIsLoading(false);
      }
    };

    fetchLessonContent();

    return () => {
      // Cleanup: abort the fetch if component unmounts
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [lessonId]);

  return { data, isLoading, error };
}

/**
 * Preload a lesson into cache without rendering.
 * Useful for preloading common lessons on app startup.
 */
export async function preloadLesson(lessonId: string) {
  if (lessonCache.has(lessonId)) {
    return lessonCache.get(lessonId)!.data;
  }

  const supabase = createBrowserSupabase();
  const { data: fullLesson, error } = await supabase
    .from("lessons")
    .select("id, subject, topic, grade, curriculum, result_json, content, created_at")
    .eq("id", lessonId)
    .single();

  if (error) {
    throw new Error(`Failed to preload lesson: ${error.message}`);
  }

  lessonCache.set(lessonId, {
    data: fullLesson,
    timestamp: Date.now(),
  });

  return fullLesson;
}

/**
 * Clear the entire lesson cache (e.g., on logout).
 */
export function clearLessonCache() {
  lessonCache.clear();
  pendingRequests.clear();
  console.log("[LessonCache] Cache cleared");
}

/**
 * Get cache statistics for debugging.
 */
export function getLessonCacheStats() {
  return {
    cachedLessons: lessonCache.size,
    pendingRequests: pendingRequests.size,
  };
}
