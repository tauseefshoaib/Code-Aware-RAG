import { ollama } from "./http.js";

export async function generate(prompt) {
  const { data } = await ollama.post("/api/generate", {
    model: "llama3.2",
    prompt,
    stream: false,
  });

  return data.response;
}
