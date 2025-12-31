import fs from "fs";

const CHUNK_SIZE = 40;

// Chunk using file path (for repo files)
export function chunkFile(filePath) {
  const content = fs.readFileSync(filePath, "utf8");
  return chunkContent(content, filePath);
}

// New: chunk from content directly (for uploaded local files)
export function chunkContent(content, filePath) {
  const lines = content.split("\n");
  const chunks = [];

  for (let i = 0; i < lines.length; i += CHUNK_SIZE) {
    chunks.push({
      filePath,
      startLine: i + 1,
      endLine: Math.min(i + CHUNK_SIZE, lines.length),
      code: lines.slice(i, i + CHUNK_SIZE).join("\n"),
    });
  }

  return chunks;
}
