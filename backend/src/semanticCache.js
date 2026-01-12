// semanticCache.js
import { qdrant } from "./qdrant.js";
import { randomUUID } from "crypto";

export const SEMANTIC_CACHE = "semantic_cache";

/**
 * Initialize the semantic cache collection
 */
export async function initSemanticCache(vectorSize = 768) {
  const collections = await qdrant.getCollections();
  const exists = collections.collections.some((c) => c.name === SEMANTIC_CACHE);

  if (!exists) {
    await qdrant.createCollection(SEMANTIC_CACHE, {
      vectors: {
        size: vectorSize,
        distance: "Cosine",
      },
    });
    console.log("✅ Semantic cache collection created");
  } else {
    console.log("ℹ️ Semantic cache collection exists");
  }
}

/**
 * Check if a cached answer exists for the given query vector
 * Returns the cached answer if similarity >= threshold
 */
export async function getCachedAnswer(queryVector, threshold = 0.6) {
  const results = await qdrant.search(SEMANTIC_CACHE, {
    vector: queryVector,
    limit: 1,
    score_threshold: threshold,
  });

  if (results.length === 0) {
    console.log("🔹 Semantic cache miss");
    return null;
  }

  console.log("🔹 Cache search score:", results[0].score);
  
  console.log("✅ Semantic cache hit");
  return results[0].payload.answer;
}

/**
 * Store a new answer in the semantic cache
 */
export async function storeCachedAnswer(queryVector, question, answer) {
  await qdrant.upsert(SEMANTIC_CACHE, {
    points: [
      {
        id: randomUUID(),
        vector: queryVector,
        payload: {
          question,
          answer,
          createdAt: Date.now(),
        },
      },
    ],
  });

  console.log("💾 Stored answer in semantic cache");
}
