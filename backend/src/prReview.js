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
You are a senior software engineer reviewing a Pull Request.

You MUST base your review ONLY on the provided git diff.
Do NOT make assumptions about code outside the diff.

STRICT RULES:
- Do NOT speculate or guess
- Do NOT invent bugs, security issues, or performance problems
- Do NOT suggest architectural changes, refactors, or new technologies
- Do NOT comment on coding style or naming unless it causes a real bug
- Do NOT mention best practices unless the diff clearly violates them
- If something is unclear or not visible in the diff, DO NOT mention it

ALLOWED ISSUE TYPES (ONLY if clearly visible in the diff):
- Bug (incorrect logic, runtime error, broken behavior)
- Missing or incorrect error handling
- Incorrect API or library usage
- Clear performance issue directly caused by the change

SECURITY RULE:
Only report a security issue if there is a clear, concrete exploit path visible in the diff.
Do NOT report hypothetical or generic security risks.

RESPONSE FORMAT (MANDATORY):
For each issue, use EXACTLY this structure:

Category: Bug | Security | Performance | Suggestion
File: <file path>
Lines: <start>-<end>
Problem: <concise, concrete explanation>
Fix: <specific and minimal fix>

IMPORTANT:
- Every issue MUST include a file path and line numbers
- Do NOT repeat the diff verbatim
- Keep explanations short and technical

If NO real issues are found, respond with EXACTLY:
"✅ No issues found in this pull request."

Here is the git diff to review:
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
