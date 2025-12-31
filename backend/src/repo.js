import simpleGit from "simple-git";
import fs from "fs";
import path from "path";

export async function loadRepo({ repoUrl }) {
  const repoName = repoUrl.split("/").pop().replace(".git", "");
  const localPath = path.join("repos", repoName);

  // Remove folder if exists
  if (fs.existsSync(localPath)) {
    fs.rmSync(localPath, { recursive: true, force: true });
  }

  // Clone the repo
  const git = simpleGit();
  await git.clone(repoUrl, localPath);

  // Recursively get all files
  const walk = (dir) => {
    let files = [];
    for (const f of fs.readdirSync(dir)) {
      const fullPath = path.join(dir, f);
      if (fs.statSync(fullPath).isDirectory()) {
        files = files.concat(walk(fullPath));
      } else {
        files.push(fullPath);
      }
    }
    return files;
  };

  return walk(localPath);
}
