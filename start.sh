#!/bin/bash

# Configuration
PORT=8000
echo -e "\033[1;34mStarting Gemma AI Chat Environment\033[0m"

# 1. Start Ollama with permissive CORS (needed for the browser fetch API to work locally)
echo -e "➔ Configuring Ollama CORS..."
export OLLAMA_ORIGINS="*"

# Check if ollama is already running
if ! pgrep -x "ollama" > /dev/null; then
    echo -e "➔ Starting \033[1;32mollama serve\033[0m in background..."
    ollama serve > ollama.log 2>&1 &
    OLLAMA_PID=$!
    echo "Ollama started with PID $OLLAMA_PID"
    sleep 3 # Give it a moment to boot
else
    echo -e "➔ Ollama is \033[1;33malready running\033[0m. Please ensure it was started with OLLAMA_ORIGINS=\"*\" if you encounter connection issues."
fi

# 2. Serve the frontend
echo -e "➔ Starting static file server on \033[1;36mhttp://localhost:$PORT\033[0m"

# 3. Start Python API Backend in background
echo -e "${BLUE}Starting dynamic Python API backend server on port 8000...${NC}"
python3 server.py &
PYTHON_PID=$!

# 3. Open Browser
sleep 1
if [[ "$OSTYPE" == "darwin"* ]]; then
    open http://localhost:$PORT
else
    echo -e "Please open \033[1;36mhttp://localhost:$PORT\033[0m in your browser."
fi

# 4. Handle Cleanup on Exit
function cleanup {
    echo -e "\n\033[1;31mShutting down servers...\033[0m"
    kill $PYTHON_PID
    # Only kill ollama if we started it here
    if [ -n "$OLLAMA_PID" ]; then
        kill $OLLAMA_PID
    fi
    exit
}

trap cleanup INT TERM

echo -e "\n\033[1;32mEverything is running!\033[0m Press Ctrl+C to shut down."
wait $PYTHON_PID
