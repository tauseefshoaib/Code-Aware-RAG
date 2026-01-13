// prReview.js
import simpleGit from "simple-git";
import path from "path";
import fs from "fs";
import { chunkContent } from "./chunker.js";
import { generateStream } from "./llm.js";
import { getPRBaseBranch } from "./github.js";

export async function streamPRReview(prUrl, res) {
  console.log("🟢 Received PR URL:", prUrl);

  // 1️⃣ Parse PR URL
  const match = prUrl.match(/https:\/\/github\.com\/(.+)\/pull\/(\d+)/);
  if (!match) {
    res.status(400).send("Invalid PR URL");
    return;
  }

  const [_, repoPath, prNumber] = match;
  const [owner, repo] = repoPath.split("/");
  const repoUrl = `https://github.com/${repoPath}.git`;
  const localPath = path.join("repos", repoPath.replace("/", "_"));

  // 2️⃣ Clone repo if needed
  const git = simpleGit();
  if (!fs.existsSync(localPath)) {
    await git.clone(repoUrl, localPath);
  }

  // 3️⃣ Get PR base branch from GitHub
  const baseBranch = await getPRBaseBranch(owner, repo, prNumber);
  console.log("🔵 PR base branch:", baseBranch);

   // 4️⃣ Fetch PR head safely (NO checkout)
  const prRemoteRef = `refs/pull/${prNumber}/head`;
  const prLocalRef = `refs/remotes/origin/pr/${prNumber}`;
  await git.cwd(localPath).fetch("origin", `${prRemoteRef}:${prLocalRef}`);

  // 5️⃣ Fetch base branch explicitly
  await git.cwd(localPath).fetch("origin", baseBranch);

  // 6️⃣ Correct diff: base → PR
  const diff = await git.diff([
    `origin/${baseBranch}..origin/pr/${prNumber}`,
  ]);

   if (!diff) {
    res.end("No changes found in PR");
    return;
  }

  // 7️⃣ Chunk diff by file
  const fileDiffs = diff.split("diff --git").slice(1);
  let context = "";

  for (const fd of fileDiffs) {
    const lines = fd.split("\n").slice(4);
    const filePathMatch = fd.match(/b\/(.+)/);
    if (!filePathMatch) continue;

    const filePath = filePathMatch[1];
    const codeChunk = lines.join("\n");
    const chunks = chunkContent(codeChunk, filePath);

    context += chunks
      .map(
        (c) => `
File: ${c.filePath}
Lines: ${c.startLine}-${c.endLine}

${c.code}`
      )
      .join("\n---\n");
  }

  // 6️⃣ LLM prompt
  const prompt = `
You are a senior software engineer.
Review the following Pull Request changes.
Provide these along with the relevant code block diff:
- Bugs
- Security issues
- Performance issues
- Suggestions
Mention file path and line numbers.

Code Changes:
${context}
`;

  console.log("🟣 Streaming PR review...");
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Transfer-Encoding", "chunked");

  for await (const token of generateStream(prompt)) {
    res.write(token);
  }

  res.end();
  console.log("💜 PR review complete");
}
