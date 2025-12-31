import { embed } from "./embed.js";
import { generate } from "./llm.js";
import { qdrant, COLLECTION } from "./qdrant.js";

export async function chat(question) {
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
Do NOT include information outside this context.

Answer using ONLY the code below:
- Find the requested method
- Return the full code block
- Mention file path and line numbers

Code:
${context}

Question:
${question}
`;

  return generate(prompt);
}
