import { v4 as uuid } from "uuid";
import fs from "fs";
import crypto from "crypto";
import { loadRepo } from "./repo.js";
import { chunkFile, chunkContent } from "./chunker.js";
import { embed } from "./embed.js";
import { qdrant, COLLECTION } from "./qdrant.js";

const ALLOWED_EXTENSIONS = /\.(js|ts|jsx|tsx|py|java|go|md|css|html)$/i;

export async function ingestRepo(input) {
  let files = await loadRepo(input);
  files = files.filter(
    (f) => ALLOWED_EXTENSIONS.test(f) && !f.includes("/.git/")
  );

  for (const file of files) {
    const chunks = chunkFile(file);

    for (const chunk of chunks) {
      const vector = await embed(chunk.code);
      await qdrant.upsert(COLLECTION, {
        points: [{ id: uuid(), vector, payload: chunk }],
      });
    }
  }

  console.log("✅ Repo indexed");
}

// For local uploaded files
export async function ingestFile(filePath, repoPath) {
  const content = fs.readFileSync(filePath, "utf8");

  if (!content.trim()) return; // skip empty files

  const chunks = chunkContent(content, repoPath);
  const points = [];

  for (const chunk of chunks) {
    const code = chunk.code.trim();
    if (!code) continue;

    const vector = await embed(code);

    if (!vector || vector.length !== 768) {
      console.warn(
        `⚠️ Wrong embedding for ${chunk.filePath} ${chunk.startLine}-${chunk.endLine}:`,
        vector?.length
      );
      continue;
    }

    points.push({
      id: crypto.randomUUID(),
      vector,
      payload: chunk,
    });
  }

  if (points.length) {
    await qdrant.upsert(COLLECTION, { points });
    console.log(`✅ Ingested ${points.length} points from ${filePath}`);
  }
}
