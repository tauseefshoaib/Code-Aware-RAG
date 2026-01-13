// chat.js
import { embed } from "./embed.js";
import { generateStream } from "./llm.js";
import { qdrant, COLLECTION } from "./qdrant.js";
import { getCachedAnswer, storeCachedAnswer } from "./semanticCache.js";

export async function streamChat(question, res) {
  console.log("🟢 Received question:", question);
  const queryVector = await embed(question);
  console.log("🔹 Generated embedding for question");

  // 🔹 1. Check semantic cache
  const cached = await getCachedAnswer(queryVector);
  if (cached) {
    console.log("🟡 Streaming answer from semantic cache");
    res.write(cached);
    res.end();
    return;
  }

  console.log("🟠 No cached answer found, fetching from RAG + LLM");

  // 2️⃣ Normal RAG retrieval
  const results = await qdrant.search(COLLECTION, {
    vector: queryVector,
    limit: 5,
  });
  console.log(`🔹 Retrieved ${results.length} chunks from collection`);

  const context = results
    .map((r) => {
      const p = r.payload;
      return `
File: ${p.filePath}
Lines: ${p.startLine}-${p.endLine}

${p.code}
`;
    })
    .join("\n---\n");

  const prompt = `
You are a senior software engineer.

Answer the question using ONLY the following context.
Return FULL code blocks.
Mention file path and line numbers.

Code:
${context}

Question:
${question}
`;

  let fullAnswer = "";

  console.log("🟣 Streaming answer from LLM...");

  for await (const token of generateStream(prompt)) {
    fullAnswer += token;
    res.write(token);
  }

  res.end();

  // 🔹 4. Store in semantic cache
  console.log("💜 LLM streaming complete, storing in cache");
  await storeCachedAnswer(queryVector, question, fullAnswer);
}
