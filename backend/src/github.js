// github.js
import axios from "axios";

export async function getPRBaseBranch(owner, repo, prNumber) {
  const res = await axios.get(
    `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}`,
    {
      headers: {
        Accept: "application/vnd.github+json",
      },
    }
  );

  return res.data.base.ref;
}