document.addEventListener('DOMContentLoaded', () => {
    const chatForm = document.getElementById('chat-form');
    const messageInput = document.getElementById('message-input');
    const chatHistoryEl = document.getElementById('chat-history');
    const loadingIndicator = document.getElementById('loading-indicator');
    const sendButton = document.getElementById('send-button');
    const chatContainer = document.querySelector('.chat-container');
    const statusText = document.querySelector('.status-text');
    const statusDot = document.querySelector('.status-dot');
    
    // Sidebar elements
    const newChatBtn = document.getElementById('new-chat-btn');
    const chatListEl = document.getElementById('chat-list');
    
    // Model variables configuration
    const MODELS = {
        fast: "gemma4:e2b",
        chat: "deepseek-r1:7b", // Qwen 2.5 architecture backbone (perfect Marathi/Hindi) augmented with deep reasoning tokens.
        code: "qwen2.5-coder:7b" // Fallback to 7b: 30b mathematically exceeds 16GB Unified memory and will cause swap-death.
    };

    // Model Selection State
    let currentMode = 'chat';
    
    document.querySelectorAll('.model-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const target = e.currentTarget;
            if (target.classList.contains('active')) return;
            
            document.querySelectorAll('.model-btn').forEach(b => b.classList.remove('active'));
            target.classList.add('active');
            currentMode = target.dataset.mode;
            
            await handleModelMemorySwap(currentMode);
        });
    });

    async function handleModelMemorySwap(mode) {
        const HOST = 'http://127.0.0.1:11434';
        const targetModel = MODELS[mode];
        
        // Lock UI during swap
        document.querySelectorAll('.model-btn').forEach(b => b.style.pointerEvents = 'none');
        messageInput.disabled = true;
        sendButton.disabled = true;
        
        // 1. Unload unused models to free RAM
        setStatus(true, `Unloading unused models...`);
        const unusedModels = Object.values(MODELS).filter(m => m !== targetModel);
        
        for (let m of unusedModels) {
            try {
                await fetch(`${HOST}/api/generate`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ model: m, keep_alive: 0 })
                });
            } catch (e) {} // ignore if model doesn't exist yet
        }
        
        // 2. Pre-load the requested model with strict memory boundaries
        setStatus(true, `Booting ${targetModel} into RAM...`);
        try {
            await fetch(`${HOST}/api/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    model: targetModel, 
                    keep_alive: "5m", 
                    options: { num_ctx: 2048 } // Cap KV Cache allocations for M2 16GB safety
                })
            });
            setStatus(true, `${mode.toUpperCase()} Engine Ready`);
        } catch (e) {
            setStatus(false, 'Connection Error');
        }

        // Unlock UI
        document.querySelectorAll('.model-btn').forEach(b => b.style.pointerEvents = 'auto');
        messageInput.disabled = false;
        sendButton.disabled = false;
        messageInput.focus();
    }

    // Default system prompt
    const defaultSystemPrompt = {
        role: "system",
        content: "You are a highly capable, helpful, and insightful AI assistant, built on the Gemma architecture. Your tone should be friendly, highly intelligent, objective, and precise, similar to Google's Gemini. Structure your responses cleanly with markdown. Be concise and direct."
    };

    // State
    let sessions = [];
    let currentSessionId = null;

    // Load sessions from localStorage
    function loadStorage() {
        const data = localStorage.getItem('gemma_sessions');
        if (data) {
            try {
                sessions = JSON.parse(data);
            } catch (e) {
                sessions = [];
            }
        }
        
        if (sessions.length === 0) {
            createNewSession();
        } else {
            // Load the most recently modified or first session
            switchSession(sessions[0].id);
        }
        renderSidebar();
    }

    function saveStorage() {
        localStorage.setItem('gemma_sessions', JSON.stringify(sessions));
    }

    function generateId() {
        return Math.random().toString(36).substring(2, 9);
    }

    function createNewSession() {
        const newSession = {
            id: generateId(),
            title: "New Chat",
            updatedAt: Date.now(),
            messages: [defaultSystemPrompt]
        };
        // Add to top of list
        sessions.unshift(newSession);
        saveStorage();
        switchSession(newSession.id);
        renderSidebar();
    }

    function extractTitle(text) {
        // Simple heuristic: get first 4 words of the user prompt
        text = text.replace(/<[^>]*>?/gm, ''); // remove html if any
        let words = text.trim().split(/\s+/);
        return words.slice(0, 4).join(" ") + (words.length > 4 ? "..." : "");
    }

    function switchSession(id) {
        currentSessionId = id;
        const session = sessions.find(s => s.id === id);
        if (!session) return;
        
        // Re-render chat UI
        chatHistoryEl.innerHTML = '';
        let hasActualMessages = false;
        
        session.messages.forEach(msg => {
            if (msg.role !== 'system') {
                hasActualMessages = true;
                let renderContent = msg.content;
                if (msg.role === 'assistant') {
                    renderContent = renderContent.replace(/<think>/g, '<details class="thinking-block" open><summary>Thinking Process</summary>\n\n');
                    renderContent = renderContent.replace(/<\/think>/g, '\n\n</details>\n\n');
                }
                addMessageToUI(msg.role, renderContent);
            }
        });

        if (!hasActualMessages) {
            addMessageToUI('assistant', "Hello! I am your local Gemini-style assistant built with Gemma. Start a conversation below.");
        }
        
        renderSidebar(); // Update active state
    }

    function deleteSession(id, event) {
        event.stopPropagation();
        
        if (confirm("Are you sure you want to completely delete this chat and its attached physical context file?")) {
            sessions = sessions.filter(s => s.id !== id);
            
            // Delete physical file via Python
            try { fetch('/api/context/' + id, { method: 'DELETE' }); } catch(e) {}
            
            if (sessions.length === 0) {
                createNewSession();
            } else if (currentSessionId === id) {
                switchSession(sessions[0].id);
            } else {
                saveStorage();
                renderSidebar();
            }
        }
    }

    function renderSidebar() {
        chatListEl.innerHTML = '';
        sessions.forEach(session => {
            const li = document.createElement('li');
            li.className = `chat-item ${session.id === currentSessionId ? 'active' : ''}`;
            
            const titleSpan = document.createElement('span');
            titleSpan.className = 'chat-item-title';
            titleSpan.textContent = session.title;
            
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'delete-chat-btn';
            deleteBtn.innerHTML = '✖';
            deleteBtn.onclick = (e) => deleteSession(session.id, e);
            
            li.appendChild(titleSpan);
            li.appendChild(deleteBtn);
            
            li.onclick = () => switchSession(session.id);
            chatListEl.appendChild(li);
        });
    }

    // Wiring up sidebar events
    newChatBtn.addEventListener('click', createNewSession);
    
    // Custom context mechanism referencing physical Python OS files
    const editContextBtn = document.getElementById('edit-context-btn');
    editContextBtn.addEventListener('click', async () => {
        let session = sessions.find(s => s.id === currentSessionId);
        if (!session) return;
        
        let existingData = "{}";
        try {
            const resp = await fetch('/api/context/' + currentSessionId);
            if (resp.ok) existingData = await resp.text();
        } catch(e) {}
        
        let input = prompt("Paste your narrative templates, rules, or JSON data to write to the physical file.\nThe Agent will be able to retrieve it autonomously:", existingData);
        
        if (input !== null) {
            await fetch('/api/context/' + currentSessionId, {
                method: 'POST',
                body: input
            });
            alert("Context successfully written! Check the `contexts/` folder on your hard drive.");
        }
    });

    // Bhashini Config Modal Mechanism
    const bhashiniConfigBtn = document.getElementById('bhashini-config-btn');
    const bhashiniModal = document.getElementById('bhashini-modal');
    const closeBhashini = document.getElementById('close-bhashini-modal');
    const saveBhashini = document.getElementById('save-bhashini-config');
    const bhashiniKeyInput = document.getElementById('bhashini-key');
    const bhashiniLangInput = document.getElementById('bhashini-lang');

    bhashiniConfigBtn.addEventListener('click', () => {
        const conf = JSON.parse(localStorage.getItem('bhashini_config') || '{}');
        bhashiniKeyInput.value = conf.key || '';
        if (conf.lang) bhashiniLangInput.value = conf.lang;
        bhashiniModal.style.display = 'flex';
    });

    closeBhashini.addEventListener('click', () => {
        bhashiniModal.style.display = 'none';
    });

    saveBhashini.addEventListener('click', () => {
        localStorage.setItem('bhashini_config', JSON.stringify({
            key: bhashiniKeyInput.value.trim(),
            lang: bhashiniLangInput.value
        }));
        bhashiniModal.style.display = 'none';
        alert('Bhashini API Configuration Saved securely to local browser storage!');
    });

    // Bhashini REST Compute Protocol
    async function translateViaBhashini(text) {
        const configRaw = localStorage.getItem('bhashini_config');
        if (!configRaw) {
            alert("Please configure Bhashini API via the gear icon in the header first.");
            return null;
        }
        const config = JSON.parse(configRaw);
        if (!config.key) {
            alert("Bhashini API Key missing! Check settings.");
            return null;
        }

        try {
            // Implementation of Bhashini ULCA Compute inference pipeline
            const response = await fetch('https://dhruva-api.bhashini.gov.in/services/inference/pipeline', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': config.key
                },
                body: JSON.stringify({
                    "pipelineTasks": [{
                        "taskType": "translation",
                        "config": {
                            "language": { "sourceLanguage": "en", "targetLanguage": config.lang },
                            "serviceId": "ai4bharat/indictrans-v2-all-gpu--t4" 
                        }
                    }],
                    "inputData": { "input": [{ "source": text }] }
                })
            });
            const data = await response.json();
            if (data.pipelineResponse && data.pipelineResponse[0]) {
               return data.pipelineResponse[0].output[0].target;
            } else {
               alert("Bhashini Config Error (Invalid Key or Region): " + (data.message || "Unknown API Rejection"));
               return null;
            }
        } catch(e) {
            alert("Bhashini Connection Failed. Check internet or CORS limits.");
            return null;
        }
    }

    // Auto-resize textarea
    messageInput.addEventListener('input', function() {
        this.style.height = 'auto';
        this.style.height = (this.scrollHeight) + 'px';
        if(this.value === '') {
            this.style.height = 'auto';
        }
    });

    // Submit on Enter
    messageInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            chatForm.dispatchEvent(new Event('submit'));
        }
    });

    chatForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const messageText = messageInput.value.trim();
        if (!messageText) return;

        // Ensure we have a valid session
        let session = sessions.find(s => s.id === currentSessionId);
        if (!session) return;

        // Define title dynamically if this is the first real message
        if (session.messages.length === 1 && session.messages[0].role === 'system') {
            session.title = extractTitle(messageText);
            renderSidebar();
        }

        // Add user message to memory and UI
        session.messages.push({ role: "user", content: messageText });
        session.updatedAt = Date.now();
        // Move to topmost in array since it's most recent
        sessions = [session, ...sessions.filter(s => s.id !== session.id)];
        saveStorage();
        renderSidebar(); // reorder visually
        
        const contentDivUser = addMessageToUI('user', messageText);
        
        messageInput.value = '';
        messageInput.style.height = 'auto';
        setGeneratingState(true);

        try {
            await generateResponse(messageText, session);
        } catch (error) {
            console.error('Error generating response:', error);
            addMessageToUI('assistant', '**Error Connection Failed:** Make sure Ollama is running (`./start.sh`).');
            setStatus(false);
        } finally {
            setGeneratingState(false);
        }
    });

    function setGeneratingState(isGenerating) {
        if (isGenerating) {
            loadingIndicator.classList.remove('hidden');
            messageInput.disabled = true;
            sendButton.disabled = true;
            chatContainer.scrollTop = chatContainer.scrollHeight;
        } else {
            loadingIndicator.classList.add('hidden');
            messageInput.disabled = false;
            sendButton.disabled = false;
            messageInput.focus();
        }
    }

    function addMessageToUI(role, text) {
        // If it's a completely fresh start and we insert a user message, clear the welcome msg organically
        if (role === 'user' && chatHistoryEl.children.length === 1 && chatHistoryEl.children[0].textContent.includes('Start a conversation below')) {
            chatHistoryEl.innerHTML = '';
        }

        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message', role);
        
        const contentDiv = document.createElement('div');
        contentDiv.classList.add('message-content');
        
        if (role === 'assistant') {
            contentDiv.innerHTML = marked.parse(text);
        } else {
            contentDiv.textContent = text;
        }

        messageDiv.appendChild(contentDiv);
        chatHistoryEl.appendChild(messageDiv);
        
        chatContainer.scrollTop = chatContainer.scrollHeight;
        return contentDiv;
    }

    function setStatus(isOnline, textOverride = null) {
        if (isOnline) {
            statusDot.style.backgroundColor = '#10b981';
            statusDot.style.boxShadow = '0 0 8px #10b981';
            statusText.textContent = textOverride || 'Ollama Active';
        } else {
            statusDot.style.backgroundColor = '#ef4444';
            statusDot.style.boxShadow = '0 0 8px #ef4444';
            statusText.textContent = textOverride || 'Ollama Offline';
        }
    }

    // --- Agentic Tool Schema ---
    const agenticTools = [
        {
            type: "function",
            function: {
                name: "calculate_math",
                description: "Evaluates a mathematical expression and returns the numerical result. Use this whenever math is required.",
                parameters: {
                    type: "object",
                    properties: {
                        expression: {
                            type: "string",
                            description: "The math expression (e.g. '234 * 49')"
                        }
                    },
                    required: ["expression"]
                }
            }
        },
        {
            type: "function",
            function: {
                name: "fetch_local_date",
                description: "Retrieves the user's current local date and time.",
                parameters: { type: "object", properties: {}, required: [] }
            }
        },
        {
            type: "function",
            function: {
                name: "search_local_knowledge",
                description: "Retrieves the custom hidden JSON contextual knowledge attached specifically to this chat session by the user.",
                parameters: { type: "object", properties: {}, required: [] }
            }
        }
    ];

    async function executeLocalTool(name, argsObj) {
        if (name === 'calculate_math') {
            try { return String(new Function('return ' + argsObj.expression)()); } 
            catch(e) { return `Error: ${e.message}`; }
        } else if (name === 'fetch_local_date') {
            return new Date().toLocaleString();
        } else if (name === 'search_local_knowledge') {
            try {
                const resp = await fetch('/api/context/' + currentSessionId);
                if (resp.ok) return await resp.text();
            } catch(e) {}
            return "No custom context file found.";
        }
        return "Tool not implemented.";
    }

    async function generateResponse(prompt, session) {
        const HOST = 'http://127.0.0.1:11434';
        
        let targetModel = MODELS[currentMode];
        let modeInstruction = "";

        if (currentMode === 'fast') {
            modeInstruction = " Respond directly, concisely, and quickly. Do not use <think> or reasoning tags.";
        } else if (currentMode === 'chat') {
            modeInstruction = " You are an agentic deep thinker. Use tools to solve real problems if necessary. Before giving your final response, strictly calculate your step-by-step reasoning process wrapped securely inside <think> and </think> tags.";
        } else if (currentMode === 'code') {
            modeInstruction = " You are an elite software architect and senior developer (similar to Claude). Output pristine, robust, and optimized code solutions. Use tools to verify logic if needed. Do not output <think> tags.";
        }
        
        // Loop for agentic callbacks
        let agentIsActive = true;
        let finalContentDiv = null;

        while (agentIsActive) {
            let apiMessages = [...session.messages];
            
            if (apiMessages.length > 11) {
                const systemMsg = apiMessages.find(m => m.role === 'system');
                const recentMessages = apiMessages.slice(-10);
                apiMessages = [systemMsg, ...recentMessages];
            }
            
            if (apiMessages[0] && apiMessages[0].role === 'system') {
                apiMessages[0] = {
                    role: "system",
                    content: apiMessages[0].content + modeInstruction
                };
            }

            const requestBody = {
                model: targetModel,
                messages: apiMessages,
                stream: true,
                options: {
                    num_ctx: currentMode === 'chat' ? 1024 : 2048, // DeepSeek needs tighter ceiling
                    num_predict: currentMode === 'chat' ? 512 : 1024,
                    num_thread: 4, // Hard cap at 4 of 8 M2 cores — prevents 100% CPU saturation
                    temperature: 0.7
                }
            };

            // deepseek-r1 doesn't natively support tool calling in Ollama. Strip it to prevent backend crash.
            // But we still want it to access the Knowledge Context File, so we manually inject it!
            if (targetModel.includes('deepseek')) {
                try {
                    const ctxResp = await fetch('/api/context/' + currentSessionId);
                    if (ctxResp.ok) {
                        const manuallyInjectedContext = await ctxResp.text();
                        if (manuallyInjectedContext.trim().length > 5) {
                             if (apiMessages[0]) apiMessages[0].content += `\n\n[Attached Knowledge Context:\n${manuallyInjectedContext}\n]`;
                        }
                    }
                } catch(e) {}
            } else {
                requestBody.tools = agenticTools;
            }

            const response = await fetch(`${HOST}/api/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody)
            });
            
            // Protect UI from Ollama native crash outputs
            if (!response.ok) {
                const errText = await response.text();
                loadingIndicator.querySelector('span').textContent = 'Error: ' + errText;
                agentIsActive = false;
                break;
            }
        
            setStatus(true);

            const reader = response.body.getReader();
            const decoder = new TextDecoder('utf-8');
            let fullResponse = '';
            let toolCalls = [];
            
            if (!finalContentDiv) {
                finalContentDiv = addMessageToUI('assistant', '');
            } else {
                loadingIndicator.querySelector('span').textContent = 'Generating final answer...';
            }

            let queuedRenderText = '';
            let renderThrottled = false;
            
            const scheduleRender = () => {
                if (renderThrottled) return;
                renderThrottled = true;
                requestAnimationFrame(() => {
                    finalContentDiv.innerHTML = marked.parse(queuedRenderText);
                    chatContainer.scrollTop = chatContainer.scrollHeight;
                    renderThrottled = false;
                });
            };

            while (true) {
                const { done, value } = await reader.read();
                if (done) {
                    if (!renderThrottled) {
                        finalContentDiv.innerHTML = marked.parse(queuedRenderText);
                        chatContainer.scrollTop = chatContainer.scrollHeight;
                    }
                    
                    // Conclude stream block
                    if (toolCalls.length > 0) {
                        // The Model wants to execute tools!
                        session.messages.push({ role: "assistant", content: fullResponse, tool_calls: toolCalls });
                        loadingIndicator.querySelector('span').textContent = 'Executing autonomous tools...';
                        
                        // Execute them locally asynchronously
                        for (const tool of toolCalls) {
                            try {
                                const args = JSON.parse(tool.function.arguments);
                                const result = await executeLocalTool(tool.function.name, args);
                                session.messages.push({ role: "tool", content: result });
                            } catch (e) {
                                session.messages.push({ role: "tool", content: "Error parsing arguments." });
                            }
                        }
                        
                        // Break out of the reader loop to fire the while(agentIsActive) loop again
                        break;
                    } else {
                        // Stream completely finished, no tools called
                        session.messages.push({ role: "assistant", content: fullResponse });
                        session.updatedAt = Date.now();
                        saveStorage();
                        agentIsActive = false;
                        loadingIndicator.querySelector('span').textContent = 'Gemma is thinking...'; // reset wrapper UI
                        
                        // Append Bhashini translate action
                        const cleanFinalText = fullResponse.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
                        if (cleanFinalText.length > 5) {
                            const bContainer = document.createElement('div');
                            bContainer.style.marginTop = '0.5rem';
                            const bBtn = document.createElement('button');
                            bBtn.style.padding = '0.4rem 0.8rem';
                            bBtn.style.background = 'transparent';
                            bBtn.style.border = '1px solid var(--border-color)';
                            bBtn.style.color = 'var(--text-secondary)';
                            bBtn.style.borderRadius = '6px';
                            bBtn.style.cursor = 'pointer';
                            bBtn.textContent = '🌐 Edit with Bhashini';
                            
                            bBtn.addEventListener('click', async () => {
                                bBtn.textContent = 'Translating via Government AI...';
                                bBtn.disabled = true;
                                const trans = await translateViaBhashini(cleanFinalText);
                                if (trans) {
                                    const tDiv = document.createElement('div');
                                    tDiv.style.marginTop = '1rem';
                                    tDiv.style.padding = '1rem';
                                    tDiv.style.borderLeft = '3px solid #10b981';
                                    tDiv.style.background = 'rgba(16, 185, 129, 0.05)';
                                    tDiv.innerHTML = `<strong style="color:#10b981;">Bhashini Result:</strong><br><br>${marked.parse(trans)}`;
                                    finalContentDiv.appendChild(tDiv);
                                    bBtn.style.display = 'none';
                                } else {
                                    bBtn.textContent = '🌐 Edit with Bhashini';
                                    bBtn.disabled = false;
                                }
                            });
                            bContainer.appendChild(bBtn);
                            finalContentDiv.appendChild(bContainer);
                        }
                        
                        break;
                    }
                }
                
                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split('\n');
                
                for (const line of lines) {
                    if (line.trim() !== '') {
                        try {
                            const parsed = JSON.parse(line);
                            
                            // Parse standard content
                            if (parsed.message && parsed.message.content) {
                                fullResponse += parsed.message.content;
                                queuedRenderText = fullResponse;
                                queuedRenderText = queuedRenderText.replace(/<think>/g, '<details class="thinking-block" open><summary>Thinking Process</summary>\n\n');
                                queuedRenderText = queuedRenderText.replace(/<\/think>/g, '\n\n</details>\n\n');
                                
                                const openCount = (queuedRenderText.match(/<details class="thinking-block" open>/g) || []).length;
                                const closeCount = (queuedRenderText.match(/<\/details>/g) || []).length;
                                if (openCount > closeCount) queuedRenderText += '\n\n</details>';
                                
                                scheduleRender();
                            }
                            
                            // Parse and accumulate tool_calls
                            if (parsed.message && parsed.message.tool_calls) {
                                parsed.message.tool_calls.forEach(tc => {
                                    // Tool calls stream in pieces, so we piece together the arguments string
                                    let existing = toolCalls.find(t => t.function.name === tc.function.name);
                                    if (!existing) {
                                        toolCalls.push({ function: { name: tc.function.name, arguments: tc.function.arguments || "" } });
                                    } else {
                                        existing.function.arguments += tc.function.arguments || "";
                                    }
                                });
                            }
                        } catch (e) {
                             // silently ignore parse errors on incomplete chunk boundaries
                        }
                    }
                }
            } // end reader loop
        } // end agentic loop
    }
    
    // Initializer
    loadStorage();
    fetch('http://127.0.0.1:11434/api/tags')
        .then(() => setStatus(true))
        .catch(() => setStatus(false));
});
