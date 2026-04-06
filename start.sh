#!/bin/bash
set -e

BLUE='\033[1;34m'; GREEN='\033[1;32m'; YELLOW='\033[1;33m'; RED='\033[1;31m'; NC='\033[0m'

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  Gemma AI — Local Agentic Assistant   ${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# ── 1. Ollama ──────────────────────────────────────────────────────────────────
export OLLAMA_ORIGINS="*"
if ! pgrep -x "ollama" > /dev/null; then
    echo -e "➔ ${GREEN}Starting ollama serve...${NC}"
    ollama serve > ollama.log 2>&1 &
    OLLAMA_PID=$!
    sleep 3
else
    echo -e "➔ ${YELLOW}Ollama already running.${NC}"
fi

# ── 2. FastAPI backend (port 8000) ─────────────────────────────────────────────
cd backend
if [ ! -d "venv" ]; then
    echo -e "➔ ${GREEN}Creating Python venv (3.12)...${NC}"
    /opt/homebrew/bin/python3.12 -m venv venv
fi
source venv/bin/activate
echo -e "➔ ${GREEN}Installing backend dependencies...${NC}"
pip install -r requirements.txt -q

echo -e "➔ ${GREEN}Starting FastAPI on ${BLUE}http://localhost:8000${GREEN} (docs: /docs)${NC}"
uvicorn main:app --host 0.0.0.0 --port 8000 --reload &
UVICORN_PID=$!
cd ..

# ── 3. Vite dev server (port 5173) ─────────────────────────────────────────────
cd ui
echo -e "➔ ${GREEN}Installing frontend dependencies...${NC}"
npm install -s
echo -e "➔ ${GREEN}Starting Vite on ${BLUE}http://localhost:5173${NC}"
npm run dev &
VITE_PID=$!
cd ..

# ── 4. Open browser ────────────────────────────────────────────────────────────
sleep 2
if [[ "$OSTYPE" == "darwin"* ]]; then
    open http://localhost:5173
fi

# ── 5. Cleanup ─────────────────────────────────────────────────────────────────
function cleanup {
    echo -e "\n${RED}Shutting down...${NC}"
    kill $VITE_PID    2>/dev/null
    kill $UVICORN_PID 2>/dev/null
    [ -n "$OLLAMA_PID" ] && kill $OLLAMA_PID 2>/dev/null
    exit 0
}
trap cleanup INT TERM

echo -e "\n${GREEN}All systems running!${NC}"
echo -e "  UI  → ${BLUE}http://localhost:5173${NC}"
echo -e "  API → ${BLUE}http://localhost:8000/docs${NC}"
echo -e "\nPress Ctrl+C to stop all servers.\n"
wait $VITE_PID
