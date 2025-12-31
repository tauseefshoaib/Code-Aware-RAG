import { QdrantClient } from "@qdrant/js-client-rest";

export const COLLECTION = "codebase";

export const qdrant = new QdrantClient({
  url: "http://localhost:6333",
});

export async function initCollection() {
  const collections = await qdrant.getCollections();
  const exists = collections.collections.find((c) => c.name === COLLECTION);

  if (!exists) {
    await qdrant.createCollection(COLLECTION, {
      vectors: {
        size: 768, // nomic-embed-text
        distance: "Cosine",
      },
    });
    console.log("✅ Qdrant collection created");
  } else {
    console.log("ℹ️ Qdrant collection exists");
  }
}
