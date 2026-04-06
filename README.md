# 🤖 Gemma AI — Local Gemini-Style Chat

A fully local, privacy-first AI chat application inspired by Google Gemini. Runs entirely on your Mac using [Ollama](https://ollama.com) — no cloud, no data leaving your machine.

---

## ✨ Features

- **3 Model Tiers** — Switch between Fast, Chat, and Code modes from the header
- **Agentic Tools** — AI can autonomously call tools (math calculator, local date fetch, knowledge base search)
- **Multi-Session Sidebar** — Manage multiple chat threads, auto-titled from your first message
- **Per-Chat Context Files** — Attach a custom knowledge/rules file to any chat session
- **Bhashini Translation** — Post-generate translation to Marathi, Hindi, Tamil, or Telugu via the Bhashini Government API
- **Thinking Process UI** — DeepSeek's `<think>` reasoning blocks rendered as collapsible panels
- **Memory Management** — Active model swapping: loads only the selected model, unloads others to save RAM
- **CPU Safety** — Hard caps on threads, context window, and output tokens to prevent Mac from crashing
- **Smooth Streaming** — `requestAnimationFrame`-batched rendering for lag-free token streaming

---

## 🧠 Model Roster

| Mode | Model | Purpose |
|------|-------|---------|
| ⚡ Fast | `gemma4:e2b` | Instant responses, minimal CPU load |
| 🧠 Chat | `deepseek-r1:7b` | Deep reasoning, Marathi/Hindi storytelling |
| 💻 Code | `qwen2.5-coder:7b` | Senior-level code generation |

> **Note:** Models are hot-swapped on demand. Only one model is kept in RAM at a time.

---

## 🛠 Requirements

- **macOS** (Apple Silicon recommended — tested on M2)
- **[Ollama](https://ollama.com)** installed
- **Python 3** (pre-installed on macOS)

---

## 🚀 Setup

### 1. Install Ollama

```bash
# Download from https://ollama.com or via Homebrew
brew install ollama
```

### 2. Pull the models

```bash
ollama pull gemma4:e2b
ollama pull deepseek-r1:7b
ollama pull qwen2.5-coder:7b
```

### 3. Clone the repo

```bash
git clone https://github.com/IamAdinath/gemma-ai.git
cd gemma-ai
```

### 4. Launch the app

```bash
chmod +x start.sh
./start.sh
```

This will:
- Start `ollama serve` in the background with CORS enabled
- Boot the custom Python API backend on `http://localhost:8000`
- Automatically open the app in your browser

---

## 📁 Project Structure

```
gemma-ai/
├── index.html       # App UI — sidebar, header, chat area
├── app.js           # All frontend logic — sessions, streaming, agentic loop
├── styles.css       # Dark-mode premium UI styles
├── server.py        # Python API backend — serves UI + context file APIs
├── start.sh         # One-command launcher
└── contexts/        # Auto-created — per-chat JSON knowledge files (gitignored)
```

---

## 📄 Per-Chat Context Files

Each chat session can have a custom context file stored in `contexts/<session-id>.json`. This file is:
- **Created** when you click "📄 Attach Context" in the header and save data
- **Read** automatically by the AI agent whenever it needs to reference your rules/notes
- **Deleted** permanently when you delete the chat from the sidebar

You can also edit the file directly in VS Code for large context documents!

---

## 🌐 Bhashini Translation (Optional)

To enable post-generation translation to Indian languages:

1. Register at [bhashini.gov.in](https://bhashini.gov.in) and get a free API key
2. Click **⚙️ Bhashini API** in the app header
3. Paste your key and select your target language
4. After any AI response, click **🌐 Edit with Bhashini** to translate it

---

## ⚠️ Hardware Notes (Apple M2 / 16GB)

- The app is tuned for **16GB Unified Memory** — do not swap the Code model to anything above `7b` or you risk swap-death
- CPU threads are capped at **4 of 8** cores to keep the system responsive
- Context window is capped at **1024–2048 tokens** to prevent RAM overflow on long chats
- `deepseek-r1:7b` does **not** support Ollama's native tool-calling — context is injected manually via the system prompt instead
