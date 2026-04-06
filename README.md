# 🤖 Gemma AI — Local Agentic Assistant

A fully local, privacy-first AI chat application with a real agentic execution loop. Runs entirely on your Mac using [Ollama](https://ollama.com). No cloud, no data leaving your machine.

---

## ✨ Features

- **4 Model Modes** — Fast, Chat (agentic), Code (agentic), Story
- **Real Agentic Loop** — ReAct-style Observe → Think → Act → Observe cycle
- **Live Agent Steps Panel** — watch the model decide and execute tools in real-time
- **Agentic Tools** — web search, URL fetcher, Python code runner, context file read/write
- **Per-Chat Context Files** — attach a custom knowledge file (rules, background data) to any session
- **Bhashini Translation** — post-generate translation to Marathi, Hindi, Tamil, Telugu
- **Memory Management** — loads only the active model, unloads others to protect 16GB RAM
- **Multi-Session Sidebar** — manage multiple chat threads, auto-titled
- **API Docs** — FastAPI auto-generates Swagger UI at `/docs`

---

## 🧠 Model Roster

| Mode | Model | Tools | Purpose |
|------|-------|-------|---------|
| ⚡ Fast | `gemma4:e2b` | ✗ | Instant, lightweight responses |
| 🧠 Chat | `qwen2.5:7b` | ✓ | Deep reasoning + real agentic tool use |
| 💻 Code | `qwen2.5-coder:7b` | ✓ | Code generation, runs/verifies its own code |
| ✍️ Story | `deepseek-r1:7b` | ✗ | Marathi/Hindi/English storytelling |

---

## 🛠 Requirements

- **macOS** (Apple Silicon recommended — tested on M2 16GB)
- **[Ollama](https://ollama.com)** installed
- **Python 3.10+** (pre-installed on macOS)

---

## 🚀 Setup

### 1. Install Ollama

```bash
brew install ollama
```

### 2. Pull the models

```bash
ollama pull gemma4:e2b
ollama pull qwen2.5:7b
ollama pull qwen2.5-coder:7b
ollama pull deepseek-r1:7b
```

### 3. Clone the repo

```bash
git clone https://github.com/IamAdinath/gemma-ai.git
cd gemma-ai
```

### 4. Launch

```bash
chmod +x start.sh
./start.sh
```

`start.sh` will automatically:
- Start `ollama serve` with CORS enabled
- Create a Python virtual environment at `backend/venv/` (first run only)
- Install dependencies from `backend/requirements.txt`
- Launch the FastAPI server with hot-reload at `http://localhost:8000`
- Open the app in your browser

> **First launch** takes ~30 seconds to create the venv and install deps. Subsequent launches are instant.

---

## 📁 Project Structure

```
gemma-ai/
├── start.sh                  ← Single launch entry point
├── README.md
│
├── ui/                       ← Frontend (Vanilla HTML/CSS/JS)
│   ├── index.html
│   ├── app.js                ← Session management, streaming, ReAct loop
│   └── styles.css
│
└── backend/                  ← Python FastAPI server
    ├── requirements.txt
    ├── main.py               ← App entry point, router registration, static mount
    │
    ├── api/
    │   └── routes/
    │       ├── context.py    ← GET/POST/DELETE /api/context/{session_id}
    │       └── tools.py      ← POST /api/tools/run_python, GET /api/tools/fetch_url
    │
    ├── core/
    │   ├── config.py         ← All paths and constants (single source of truth)
    │   └── tool_runner.py    ← Tool execution logic (isolated from HTTP layer)
    │
    └── data/
        └── contexts/         ← Per-chat JSON knowledge files (auto-created)
```

---

## 🔌 API Reference

Full interactive docs available at **[http://localhost:8000/docs](http://localhost:8000/docs)** when the server is running.

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/context/{id}` | Read session context file |
| `POST` | `/api/context/{id}` | Write/overwrite session context |
| `DELETE` | `/api/context/{id}` | Delete session context file |
| `POST` | `/api/tools/run_python` | Execute Python code (5s timeout) |
| `GET` | `/api/tools/fetch_url?url=` | Fetch and strip a URL's content |

---

## 📄 Per-Chat Context Files

Each chat session can have a custom context file at `backend/data/contexts/<session-id>.json`.  
It is automatically:
- **Created** via "📄 Attach Context" in the UI header
- **Read** by the agent's `read_context` tool during agentic loops
- **Deleted** when you delete the chat from the sidebar

You can also edit these files directly in VS Code for large rulesets or story outlines.

---

## 🌐 Bhashini Translation (Optional)

Requires a free account at [bhashini.gov.in](https://bhashini.gov.in).

1. Register and copy your API key
2. Click **⚙️ Bhashini API** in the header
3. Paste your key and select target language
4. After any AI response, click **🌐 Translate with Bhashini**

---

## ⚠️ Hardware Notes (Apple M2 / 16GB)

- Only **one model** is kept in RAM at a time via Ollama's `keep_alive` management
- CPU threads are hard-capped at **4 of 8 cores** (`num_thread: 4`)
- Context window: **1024 tokens** (Story/Fast), **2048 tokens** (Chat/Code)
- Do not swap Code model above `7b` — the 30b variant will cause memory swap-death
- `deepseek-r1:7b` does not support Ollama's native tool-calling; context is injected manually

---

## 🔧 Manual Backend Setup (without start.sh)

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```
