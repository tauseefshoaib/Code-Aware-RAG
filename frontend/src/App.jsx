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

  // Chat history
  const [chat, setChat] = useState([]);

  // Only index source files
  const ALLOWED = /\.(js|ts|jsx|tsx|py|java|go|json|md)$/i;

  const handleFolderPick = (e) => {
    const selected = Array.from(e.target.files || []);
    setFiles(selected);
  };

  const ingestRepo = async () => {
    setLoading(true);
    setIndexed(false);
    setChat([]); // reset chat on new ingestion

    try {
      if (repoUrl.trim()) {
        await api.post("/ingest", { repoUrl });
      } else {
        if (files.length === 0) {
          alert("Please pick a repo folder");
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

    if (!question.trim()) return;

    setLoading(true);

    try {
      const res = await api.post("/chat", { question });
      const answer = res.data.answer;

      // Append to chat history
      setChat((prev) => [...prev, { question, answer }]);
      setQuestion(""); // clear input
    } catch (err) {
      console.error(err);
      alert("❌ Question failed");
    }

    setLoading(false);
  };

  const renderAnswer = (answer) => {
    // Split by markdown code fences
    const parts = answer.split(/```(?:\w+)?\n([\s\S]*?)```/g);
    const elements = [];

    for (let i = 0; i < parts.length; i++) {
      if (i % 2 === 0 && parts[i].trim()) {
        elements.push(
          <div key={i} style={styles.botText}>
            {parts[i].trim()}
          </div>
        );
      } else if (i % 2 === 1 && parts[i].trim()) {
        elements.push(
          <pre key={i} style={styles.botCode}>
            {parts[i].trim()}
          </pre>
        );
      }
    }

    return elements;
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

      {/* Chat input */}
      <textarea
        style={styles.textarea}
        placeholder="Ask something like: where is the addition method?"
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
      />

      <br />
      <button onClick={askQuestion} disabled={loading}>
        {loading ? "Thinking..." : "Ask"}
      </button>

      {/* Chat view */}
      <div style={styles.chatContainer}>
        {chat.map((item, idx) => (
          <div key={idx} style={styles.chatItem}>
            <div style={styles.userQuestion}>❓ {item.question}</div>
            <div>{renderAnswer(item.answer)}</div>
          </div>
        ))}
      </div>
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
    height: 80,
    padding: 8,
  },
  chatContainer: {
    marginTop: 20,
    borderTop: "1px solid #ccc",
    paddingTop: 10,
    maxHeight: 400,
    overflowY: "auto",
  },
  chatItem: {
    marginBottom: 15,
  },
  userQuestion: {
    fontWeight: "bold",
  },
  botText: {
    marginTop: 5,
    lineHeight: 1.5,
  },
  botCode: {
    background: "#111",
    color: "#0f0",
    padding: 10,
    marginTop: 5,
    whiteSpace: "pre",
    borderRadius: 5,
    overflowX: "auto",
    fontFamily: "monospace",
  },
};
