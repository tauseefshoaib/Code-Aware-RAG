// llm.js
import { ollama } from "./http.js";

export async function* generateStream(prompt) {
  const response = await ollama.post(
    "/api/generate",
    {
      model: "llama3.2",
      prompt,
      stream: true,
    },
    { responseType: "stream" }
  );

  for await (const chunk of response.data) {
    const lines = chunk.toString().split("\n").filter(Boolean);

    for (const line of lines) {
      const json = JSON.parse(line);
      if (json.response) {
        yield json.response;
      }
    }
  }
}
