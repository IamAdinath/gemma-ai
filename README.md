# 🤖 Gemma AI — Local Agentic Assistant

A fully local, privacy-first AI chat application with a real agentic execution loop. Runs entirely on your Mac using [Ollama](https://ollama.com). No cloud, no data leaving your machine.

---

## ✨ Features

- **2 Recommended Modes** — Chat and Code, chosen from your machine specs
- **Real Agentic Loop** — ReAct-style Observe → Think → Act → Observe cycle
- **Live Agent Steps Panel** — watch the model decide and execute tools in real-time
- **Agentic Tools** — web search, URL fetcher, Python code runner, context file read/write
- **Per-Chat Context Files** — attach a custom knowledge file (rules, background data) to any session
- **Bhashini Translation** — post-generate translation to Marathi, Hindi, Tamil, Telugu
- **Memory Management** — loads only the active model, unloads others to protect 16GB RAM
- **Multi-Session Sidebar** — manage multiple chat threads, auto-titled
- **API Docs** — FastAPI auto-generates Swagger UI at `/docs`

---

## 🧠 Model Selection

| Mode | Model | Tools | Purpose |
|------|-------|-------|---------|
| 🧠 Chat | Auto-selected | ✓ | General reasoning, web access, agentic task execution |
| 💻 Code | Auto-selected | ✓ | Coding, debugging, verification, code-aware tool use |

The backend inspects system RAM and recommends exactly two Ollama models:
- `16GB+` machines: `qwen2.5:7b` for chat and `qwen2.5-coder:7b` for code
- `32GB+` machines: `qwen2.5:14b` for chat and `qwen2.5-coder:14b` for code
- Smaller systems: `qwen2.5:3b` for chat and `qwen2.5-coder:3b` for code

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

### 2. Clone the repo

```bash
git clone https://github.com/IamAdinath/gemma-ai.git
cd gemma-ai
```

### 3. Launch

```bash
chmod +x start.sh
./start.sh
```

`start.sh` will automatically:
- Start `ollama serve` with CORS enabled
- Inspect your machine specs and recommend one chat model plus one code model
- Pull those recommended models automatically if they are missing
- Create a Python virtual environment at `backend/venv/` (first run only)
- Install frontend (Vite/React) and backend (FastAPI) dependencies
- Launch the FastAPI server at `http://localhost:8000`
- Launch the Vite Dev Server at `http://localhost:5173`
- Open the UI in your browser

> **First launch** takes ~30 seconds to create the venv and install deps. Subsequent launches are instant.

---

## 📁 Project Structure

```
gemma-ai/
├── start.sh                  ← Single launch entry point
├── README.md
│
├── ui/                       ← Vite + React Frontend
│   ├── src/
│   │   ├── App.jsx           ← Bootstraps the UI and Agent loop
│   │   ├── components/       ← UI components
│   │   ├── hooks/            ← State hooks (useSessionStore, useAgent, useToast)
│   │   └── services/         ← API connectors (ollama, fastapi)
│   └── vite.config.js        ← Vite server config mapping /api to FastAPI
│
└── backend/                  ← Python FastAPI server
    ├── requirements.txt
    ├── main.py               ← App entry point, logging, router config
    ├── static/               ← Production UI build output
    │
    ├── api/
    │   └── routes/
    │       ├── context.py    ← GET/POST/DELETE /api/context/{session_id}
    │       ├── system.py     ← GET /api/system/models
    │       └── tools.py      ← POST /api/tools/run_python, GET /api/tools/fetch_url
    │
    ├── core/
    │   ├── config.py         ← All paths and constants (single source of truth)
    │   ├── model_selection.py← System-spec based chat/code recommendations
    │   └── tool_runner.py    ← Tool execution logic (isolated from HTTP layer)
    │
    └── data/
        ├── chats/            ← Per-chat complete message history (JSON)
        └── contexts/         ← Per-chat knowledge file used by AI (JSON)
```

---

## 🔌 API Reference

Full interactive docs available at **[http://localhost:8000/docs](http://localhost:8000/docs)** when the server is running.

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/chats/{id}` | Read full chat message history |
| `POST` | `/api/chats/{id}` | Save/update chat message history |
| `DELETE` | `/api/chats/{id}` | Delete chat history and context file |
| `GET` | `/api/context/{id}` | Read session context file |
| `POST` | `/api/context/{id}` | Write/overwrite session context |
| `DELETE` | `/api/context/{id}` | Delete session context file |
| `GET` | `/api/system/models` | Return system specs and recommended chat/code models |
| `POST` | `/api/tools/run_python` | Execute Python code (5s timeout) |
| `GET` | `/api/tools/fetch_url?url=` | Fetch and strip a URL's content |

---

## 📄 Per-Chat Context Files

Each chat session can have a custom context file at `backend/data/contexts/<session-id>.json`.  
It is automatically:
- **Created** via "📄 Attach Context" in the UI header
- **Read** by the agent's `read_context` tool during agentic loops
- **Deleted** when you delete the chat from the sidebar

You can also edit these files directly in VS Code for large rulesets or background notes.

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
- Context window: **2048 tokens** for the active chat/code model
- On 16GB machines, the app stays on `7b` class recommendations to avoid swap pressure
- Only the recommended chat/code pair is used in the active UI

---

## 🔧 Manual Backend Setup (without start.sh)

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```
