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
  const [loading, setLoading] = useState(false);
  const [indexed, setIndexed] = useState(false);
  const [chat, setChat] = useState([]);

  const ALLOWED = /\.(js|ts|jsx|tsx|py|java|go|json|md)$/i;

  const handleFolderPick = (e) => {
    setFiles(Array.from(e.target.files || []));
  };

  const ingestRepo = async () => {
    setLoading(true);
    setIndexed(false);
    setChat([]);

    try {
      if (repoUrl.trim()) {
        await api.post("/ingest", { repoUrl });
      } else {
        if (!files.length) {
          alert("Pick a repo folder");
          setLoading(false);
          return;
        }

        const formData = new FormData();
        let added = 0;

        for (const file of files) {
          if (
            file.webkitRelativePath.includes("node_modules") ||
            file.webkitRelativePath.includes(".git") ||
            file.name === ".env"
          ) {
            continue;
          }

          if (ALLOWED.test(file.name)) {
            formData.append("files", file, file.webkitRelativePath);
            added++;
          }
        }

        if (!added) {
          alert("No valid source files found");
          setLoading(false);
          return;
        }

        await api.post("/ingest-local", formData);
      }

      setIndexed(true);
      alert("✅ Repo indexed");
    } catch (err) {
      console.error(err);
      alert("❌ Indexing failed");
    }

    setLoading(false);
  };

  const askQuestion = async () => {
    if (!indexed || !question.trim()) return;

    setLoading(true);

    try {
      const res = await api.post("/chat", { question });
      setChat((c) => [...c, { question, answer: res.data.answer }]);
      setQuestion("");
    } catch (err) {
      console.error(err);
      alert("❌ Question failed");
    }

    setLoading(false);
  };

  const renderAnswer = (answer) => {
    const parts = answer.split(/```(?:\w+)?\n([\s\S]*?)```/g);

    return parts.map((part, i) =>
      i % 2 === 0 ? (
        part.trim() && (
          <div key={i} style={styles.botText}>
            {part.trim()}
          </div>
        )
      ) : (
        <pre key={i} style={styles.botCode}>
          {part.trim()}
        </pre>
      )
    );
  };

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <h1 style={styles.title}>Code Helper</h1>

        {/* Inline Pickers */}
        <div style={styles.pickerRow}>
          <input
            style={styles.input}
            placeholder="GitHub repo URL"
            value={repoUrl}
            onChange={(e) => setRepoUrl(e.target.value)}
          />

          <label style={styles.filePicker}>
            Local Repo
            <input
              type="file"
              webkitdirectory="true"
              directory="true"
              multiple
              hidden
              onChange={handleFolderPick}
            />
          </label>
        </div>

        <button
          style={styles.primaryBtn}
          onClick={ingestRepo}
          disabled={loading}
        >
          {loading ? "Indexing…" : "Ingest Repo"}
        </button>

        <div style={styles.divider} />

        {/* Chat */}
        <textarea
          style={styles.textarea}
          placeholder="Ask about the codebase…"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
        />

        <button
          style={styles.secondaryBtn}
          onClick={askQuestion}
          disabled={loading}
        >
          Ask
        </button>

        <div style={styles.chatContainer}>
          {chat.map((c, i) => (
            <div key={i} style={styles.chatItem}>
              <div style={styles.userQuestion}>❯ {c.question}</div>
              {renderAnswer(c.answer)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ================= STYLES ================= */

const styles = {
  page: {
    background: "#0f0f0f",
    minHeight: "100vh",
    padding: "40px 20px",
    color: "#eaeaea",
  },
  container: {
    maxWidth: 900,
    margin: "0 auto",
    fontFamily: "Inter, system-ui, sans-serif",
  },
  title: {
    marginBottom: 30,
    fontWeight: 600,
    letterSpacing: "-0.5px",
  },
  pickerRow: {
    display: "flex",
    gap: 12,
    marginBottom: 15,
  },
  input: {
    flex: 1,
    padding: 10,
    background: "#161616",
    border: "1px solid #2a2a2a",
    color: "#eaeaea",
    borderRadius: 6,
  },
  filePicker: {
    padding: "10px 14px",
    background: "#161616",
    border: "1px dashed #444",
    borderRadius: 6,
    cursor: "pointer",
    fontSize: 14,
  },
  primaryBtn: {
    padding: "10px 16px",
    background: "#eaeaea",
    color: "#000",
    border: "none",
    borderRadius: 6,
    fontWeight: 500,
    cursor: "pointer",
  },
  secondaryBtn: {
    marginTop: 10,
    padding: "8px 14px",
    background: "#1f1f1f",
    color: "#eaeaea",
    border: "1px solid #333",
    borderRadius: 6,
    cursor: "pointer",
  },
  divider: {
    margin: "30px 0",
  },
  textarea: {
    width: "100%",
    height: 80,
    padding: 10,
    background: "#161616",
    color: "#eaeaea",
    border: "1px solid #2a2a2a",
    borderRadius: 6,
  },
  chatContainer: {
    marginTop: 30,
  },
  chatItem: {
    marginBottom: 24,
  },
  userQuestion: {
    fontWeight: 500,
    marginBottom: 6,
  },
  botText: {
    lineHeight: 1.6,
    color: "#d0d0d0",
  },
  botCode: {
    background: "#050505",
    border: "1px solid #222",
    padding: 12,
    marginTop: 6,
    borderRadius: 6,
    whiteSpace: "pre",
    overflowX: "auto",
    fontFamily: "JetBrains Mono, monospace",
    fontSize: 13,
  },
};
