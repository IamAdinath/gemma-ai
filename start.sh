#!/bin/bash

# Configuration
PORT=8000
echo -e "\033[1;34mStarting Gemma AI Chat Environment\033[0m"

# 1. Configure Ollama CORS
export OLLAMA_ORIGINS="*"
if ! pgrep -x "ollama" > /dev/null; then
    echo -e "➔ Starting \033[1;32mollama serve\033[0m in background..."
    ollama serve > ollama.log 2>&1 &
    OLLAMA_PID=$!
    echo "Ollama PID: $OLLAMA_PID"
    sleep 3
else
    echo -e "➔ Ollama already running."
fi

# 2. Start Python API backend (serves UI from ../ui and handles /api/* routes)
echo -e "➔ Starting backend on \033[1;36mhttp://localhost:$PORT\033[0m"
cd backend && python3 server.py &
PYTHON_PID=$!
cd ..

# 3. Open browser
sleep 1
if [[ "$OSTYPE" == "darwin"* ]]; then
    open http://localhost:$PORT
fi

# 4. Cleanup on exit
function cleanup {
    echo -e "\n\033[1;31mShutting down...\033[0m"
    kill $PYTHON_PID 2>/dev/null
    [ -n "$OLLAMA_PID" ] && kill $OLLAMA_PID 2>/dev/null
    exit
}
trap cleanup INT TERM

echo -e "\n\033[1;32mRunning!\033[0m Press Ctrl+C to stop."
wait $PYTHON_PID
