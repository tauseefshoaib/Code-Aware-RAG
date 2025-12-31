// chat.js
import { embed } from "./embed.js";
import { generateStream } from "./llm.js";
import { qdrant, COLLECTION } from "./qdrant.js";

export async function streamChat(question, res) {
  const queryVector = await embed(question);

  const results = await qdrant.search(COLLECTION, {
    vector: queryVector,
    limit: 5,
  });

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

  for await (const token of generateStream(prompt)) {
    res.write(token);
  }

  res.end();
}
