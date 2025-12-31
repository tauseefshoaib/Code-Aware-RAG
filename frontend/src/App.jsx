import { useState } from "react";
import axios from "axios";

const API = "http://localhost:3000";

const api = axios.create({
  baseURL: API,
});

export default function App() {
  const [repoUrl, setRepoUrl] = useState("");
  const [files, setFiles] = useState([]);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const [indexed, setIndexed] = useState(false);

  // Only index source files
  const ALLOWED = /\.(js|ts|jsx|tsx|py|java|go|json|md)$/i;

  const handleFolderPick = (e) => {
    const selected = Array.from(e.target.files || []);
    setFiles(selected);
    console.log("Selected files:", selected.length);
  };

  const ingestRepo = async () => {
    setLoading(true);
    setIndexed(false);

    try {
      // ===== GitHub Repo =====
      if (repoUrl.trim()) {
        await api.post("/ingest", { repoUrl });
      }

      // ===== Local Repo =====
      else {
        if (files.length === 0) {
          alert("Please pick a repo folder");
          setLoading(false);
          return;
        }

        const formData = new FormData();

        let added = 0;

        for (const file of files) {
          // Skip heavy folders
          if (
            file.webkitRelativePath.includes("node_modules") ||
            file.webkitRelativePath.includes(".git")
          ) {
            continue;
          }

          if (ALLOWED.test(file.name)) {
            formData.append("files", file, file.webkitRelativePath);
            added++;
          }
        }

        if (added === 0) {
          alert("No valid source files found");
          setLoading(false);
          return;
        }

        await api.post("/ingest-local", formData, {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        });
      }

      setIndexed(true);
      alert("✅ Repo indexed successfully");
    } catch (err) {
      console.error(err);
      alert("❌ Indexing failed");
    }

    setLoading(false);
  };

  const askQuestion = async () => {
    if (!indexed) {
      alert("Index a repo first");
      return;
    }

    setLoading(true);
    setAnswer("");

    try {
      const res = await api.post("/chat", { question });
      setAnswer(res.data.answer);
    } catch (err) {
      console.error(err);
      alert("❌ Question failed");
    }

    setLoading(false);
  };

  return (
    <div style={styles.container}>
      <h1>🧠 CodeHelper</h1>

      {/* GitHub URL */}
      <input
        style={styles.input}
        placeholder="GitHub public repo URL (optional)"
        value={repoUrl}
        onChange={(e) => setRepoUrl(e.target.value)}
      />

      <p>— OR —</p>

      {/* Folder Picker */}
      <input
        type="file"
        webkitdirectory="true"
        directory="true"
        multiple
        onChange={handleFolderPick}
      />

      <br />
      <br />

      <button onClick={ingestRepo} disabled={loading}>
        {loading ? "Indexing..." : "Ingest Repo"}
      </button>

      <hr />

      {/* Chat */}
      <textarea
        style={styles.textarea}
        placeholder="Ask something like: where is the addition method?"
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
      />

      <br />

      <button onClick={askQuestion} disabled={loading}>
        Ask
      </button>

      {/* Answer */}
      {answer && <pre style={styles.answer}>{answer}</pre>}
    </div>
  );
}

const styles = {
  container: {
    maxWidth: 800,
    margin: "40px auto",
    fontFamily: "sans-serif",
  },
  input: {
    width: "100%",
    padding: 8,
    marginBottom: 10,
  },
  textarea: {
    width: "100%",
    height: 100,
    padding: 8,
  },
  answer: {
    marginTop: 20,
    background: "#111",
    color: "#0f0",
    padding: 15,
    whiteSpace: "pre-wrap",
  },
};
