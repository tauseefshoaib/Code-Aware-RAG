import express from "express";
import cors from "cors";
import multer from "multer";

import { initCollection } from "./qdrant.js";
import { streamChat } from "./chat.js";
import { ingestFile, ingestRepo } from "./ingest.js";
import { initSemanticCache } from "./semanticCache.js";

const app = express();
const upload = multer({
  dest: "uploads/tmp",
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB per file
  },
});
app.use(cors());
app.use(express.json());

await initCollection();
await initSemanticCache();

/**
 * GitHub repo ingestion
 */
app.post("/ingest", async (req, res) => {
  try {
    console.log("ingestion started");
    await ingestRepo(req.body);
    res.json({ status: "indexed" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * Local repo ingestion (folder picker)
 */
app.post("/ingest-local", upload.array("files"), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: "No files received" });
    }

    for (const file of req.files) {
      await ingestFile(file.path, file.originalname);
    }

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Indexing failed" });
  }
});

/**
 * Chat
 */
app.post("/chat", async (req, res) => {
  try {
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Transfer-Encoding", "chunked");

    await streamChat(req.body.question, res);
  } catch (err) {
    console.error(err);
    res.end("\n❌ Error generating answer");
  }
});

app.listen(3000, () => {
  console.log("🚀 Backend running on http://localhost:3000");
});
