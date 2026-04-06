document.addEventListener('DOMContentLoaded', () => {
    const chatForm = document.getElementById('chat-form');
    const messageInput = document.getElementById('message-input');
    const chatHistoryEl = document.getElementById('chat-history');
    const loadingIndicator = document.getElementById('loading-indicator');
    const sendButton = document.getElementById('send-button');
    const chatContainer = document.querySelector('.chat-container');
    const statusText = document.querySelector('.status-text');
    const statusDot = document.querySelector('.status-dot');
    const newChatBtn = document.getElementById('new-chat-btn');
    const chatListEl = document.getElementById('chat-list');

    // ─── Model Configuration ──────────────────────────────────────────────────
    const MODELS = {
        fast:  { id: "gemma4:e2b",         tools: false },
        chat:  { id: "qwen2.5:7b",          tools: true  },
        code:  { id: "qwen2.5-coder:7b",    tools: true  },
        story: { id: "deepseek-r1:7b",      tools: false }
    };

    const MODE_PROMPTS = {
        fast:  "Respond directly, concisely and quickly. No reasoning tags.",
        chat:  "You are a powerful agentic AI assistant. You have tools available. Use them proactively whenever you need real-world data, math, web info, or to run code. Think step-by-step.",
        code:  "You are an elite software architect. Use tools to verify logic, run code, or fetch documentation. Output pristine, well-commented code.",
        story: "You are a master storyteller. Write vivid, culturally rich scripts and stories in English, Hindi, or Marathi as requested. Use <think> tags to plan your narrative structure before writing."
    };

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

    // ─── Memory Swap ─────────────────────────────────────────────────────────
    async function handleModelMemorySwap(mode) {
        const HOST = 'http://127.0.0.1:11434';
        const targetModel = MODELS[mode].id;

        document.querySelectorAll('.model-btn').forEach(b => b.style.pointerEvents = 'none');
        messageInput.disabled = true;
        sendButton.disabled = true;

        setStatus(true, 'Unloading unused models...');
        const unusedModels = Object.values(MODELS).map(m => m.id).filter(id => id !== targetModel);
        for (let m of unusedModels) {
            try {
                await fetch(`${HOST}/api/generate`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ model: m, keep_alive: 0 })
                });
            } catch (e) {}
        }

        setStatus(true, `Booting ${targetModel}...`);
        try {
            await fetch(`${HOST}/api/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ model: targetModel, keep_alive: "5m", options: { num_ctx: 2048 } })
            });
            setStatus(true, `${mode.toUpperCase()} Ready`);
        } catch (e) {
            setStatus(false, 'Connection Error');
        }

        document.querySelectorAll('.model-btn').forEach(b => b.style.pointerEvents = 'auto');
        messageInput.disabled = false;
        sendButton.disabled = false;
        messageInput.focus();
    }

    // ─── System Prompt ───────────────────────────────────────────────────────
    const defaultSystemPrompt = {
        role: "system",
        content: "You are a highly capable local AI assistant inspired by Google Gemini. Be helpful, precise, and intelligent."
    };

    // ─── Session Management ──────────────────────────────────────────────────
    let sessions = [];
    let currentSessionId = null;

    function loadStorage() {
        try { sessions = JSON.parse(localStorage.getItem('gemma_sessions') || '[]'); } catch(e) { sessions = []; }
        if (sessions.length === 0) createNewSession();
        else switchSession(sessions[0].id);
        renderSidebar();
    }

    function saveStorage() {
        localStorage.setItem('gemma_sessions', JSON.stringify(sessions));
    }

    function generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substring(2, 5);
    }

    function createNewSession() {
        const newSession = { id: generateId(), title: "New Chat", updatedAt: Date.now(), messages: [defaultSystemPrompt] };
        sessions.unshift(newSession);
        saveStorage();
        switchSession(newSession.id);
        renderSidebar();
    }

    function switchSession(id) {
        currentSessionId = id;
        const session = sessions.find(s => s.id === id);
        if (!session) return;
        chatHistoryEl.innerHTML = '';
        let hasMessages = false;
        session.messages.forEach(msg => {
            if (msg.role === 'system' || msg.role === 'tool') return;
            hasMessages = true;
            let content = msg.content || '';
            if (msg.role === 'assistant') content = renderThinkTags(content);
            addMessageToUI(msg.role, content);
        });
        if (!hasMessages) addMessageToUI('assistant', "Hello! I'm your local AI assistant. How can I help you today?");
        renderSidebar();
    }

    function deleteSession(id, event) {
        event.stopPropagation();
        if (confirm("Delete this chat and its attached context file?")) {
            sessions = sessions.filter(s => s.id !== id);
            try { fetch('/api/context/' + id, { method: 'DELETE' }); } catch(e) {}
            if (sessions.length === 0) createNewSession();
            else if (currentSessionId === id) switchSession(sessions[0].id);
            else { saveStorage(); renderSidebar(); }
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

    newChatBtn.addEventListener('click', createNewSession);

    // ─── Attach Context Button ────────────────────────────────────────────────
    document.getElementById('edit-context-btn').addEventListener('click', async () => {
        let existing = "{}";
        try {
            const resp = await fetch('/api/context/' + currentSessionId);
            if (resp.ok) existing = await resp.text();
        } catch(e) {}
        const input = prompt("Paste custom rules, background, or JSON knowledge for this session.\nThe agent will read this automatically:", existing);
        if (input !== null) {
            await fetch('/api/context/' + currentSessionId, { method: 'POST', body: input });
            alert("Context saved to contexts/" + currentSessionId + ".json");
        }
    });

    // ─── Bhashini Modal ───────────────────────────────────────────────────────
    const bhashiniModal = document.getElementById('bhashini-modal');
    document.getElementById('bhashini-config-btn').addEventListener('click', () => {
        const conf = JSON.parse(localStorage.getItem('bhashini_config') || '{}');
        document.getElementById('bhashini-key').value = conf.key || '';
        const langEl = document.getElementById('bhashini-lang');
        if (conf.lang) langEl.value = conf.lang;
        bhashiniModal.style.display = 'flex';
    });
    document.getElementById('close-bhashini-modal').addEventListener('click', () => bhashiniModal.style.display = 'none');
    document.getElementById('save-bhashini-config').addEventListener('click', () => {
        localStorage.setItem('bhashini_config', JSON.stringify({
            key: document.getElementById('bhashini-key').value.trim(),
            lang: document.getElementById('bhashini-lang').value
        }));
        bhashiniModal.style.display = 'none';
        alert('Bhashini config saved!');
    });

    async function translateViaBhashini(text) {
        const config = JSON.parse(localStorage.getItem('bhashini_config') || '{}');
        if (!config.key) { alert("Set Bhashini API key first."); return null; }
        try {
            const resp = await fetch('https://dhruva-api.bhashini.gov.in/services/inference/pipeline', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': config.key },
                body: JSON.stringify({
                    pipelineTasks: [{ taskType: "translation", config: { language: { sourceLanguage: "en", targetLanguage: config.lang }, serviceId: "ai4bharat/indictrans-v2-all-gpu--t4" } }],
                    inputData: { input: [{ source: text }] }
                })
            });
            const data = await resp.json();
            return data.pipelineResponse?.[0]?.output?.[0]?.target || null;
        } catch(e) { alert("Bhashini request failed."); return null; }
    }

    // ─── UI Helpers ───────────────────────────────────────────────────────────
    messageInput.addEventListener('input', function() {
        this.style.height = 'auto';
        this.style.height = Math.min(this.scrollHeight, 200) + 'px';
    });
    messageInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); chatForm.dispatchEvent(new Event('submit')); }
    });

    function renderThinkTags(text) {
        text = text.replace(/<think>/g, '<details class="thinking-block" open><summary>💭 Thinking Process</summary>\n\n');
        text = text.replace(/<\/think>/g, '\n\n</details>\n\n');
        const opens = (text.match(/<details class="thinking-block" open>/g) || []).length;
        const closes = (text.match(/<\/details>/g) || []).length;
        if (opens > closes) text += '\n\n</details>';
        return text;
    }

    function setStatus(isOnline, override = null) {
        statusDot.style.backgroundColor = isOnline ? '#10b981' : '#ef4444';
        statusDot.style.boxShadow = `0 0 8px ${isOnline ? '#10b981' : '#ef4444'}`;
        statusText.textContent = override || (isOnline ? 'Ollama Active' : 'Ollama Offline');
    }

    function setGeneratingState(on) {
        loadingIndicator.classList.toggle('hidden', !on);
        messageInput.disabled = on;
        sendButton.disabled = on;
        if (on) chatContainer.scrollTop = chatContainer.scrollHeight;
        else messageInput.focus();
    }

    function addMessageToUI(role, text) {
        if (role === 'user' && chatHistoryEl.children.length === 1 && chatHistoryEl.children[0].textContent.includes("How can I help")) {
            chatHistoryEl.innerHTML = '';
        }
        const div = document.createElement('div');
        div.className = `message ${role}`;
        const content = document.createElement('div');
        content.className = 'message-content';
        if (role === 'assistant') content.innerHTML = marked.parse(text);
        else content.textContent = text;
        div.appendChild(content);
        chatHistoryEl.appendChild(div);
        chatContainer.scrollTop = chatContainer.scrollHeight;
        return content;
    }

    // ─── Agent Steps Panel ────────────────────────────────────────────────────
    function createAgentPanel() {
        const wrapper = document.createElement('div');
        wrapper.className = 'message assistant';
        const panel = document.createElement('div');
        panel.className = 'agent-steps-panel';
        wrapper.appendChild(panel);
        chatHistoryEl.appendChild(wrapper);
        chatContainer.scrollTop = chatContainer.scrollHeight;
        return panel;
    }

    function addAgentStep(panel, icon, label, detail = '') {
        const step = document.createElement('div');
        step.className = 'agent-step';
        step.innerHTML = `<span class="agent-step-icon">${icon}</span><span class="agent-step-label">${label}</span>${detail ? `<span class="agent-step-detail">${detail}</span>` : ''}`;
        panel.appendChild(step);
        chatContainer.scrollTop = chatContainer.scrollHeight;
        return step;
    }

    // ─── Real Agentic Tools ───────────────────────────────────────────────────
    const agenticTools = [
        {
            type: "function",
            function: {
                name: "web_search",
                description: "Search the web for real-time information using DuckDuckGo. Returns a summary and top results.",
                parameters: { type: "object", properties: { query: { type: "string", description: "Search query" } }, required: ["query"] }
            }
        },
        {
            type: "function",
            function: {
                name: "fetch_url",
                description: "Fetch and read the text content of any URL. Use after web_search to get full article content.",
                parameters: { type: "object", properties: { url: { type: "string", description: "Full URL to fetch" } }, required: ["url"] }
            }
        },
        {
            type: "function",
            function: {
                name: "run_python",
                description: "Execute Python 3 code on the local machine and return its output. Use for calculations, data processing, or verifying logic.",
                parameters: { type: "object", properties: { code: { type: "string", description: "Python code to execute" } }, required: ["code"] }
            }
        },
        {
            type: "function",
            function: {
                name: "read_context",
                description: "Read the custom knowledge/rules file attached to this chat session.",
                parameters: { type: "object", properties: {}, required: [] }
            }
        },
        {
            type: "function",
            function: {
                name: "write_note",
                description: "Write or append a note/result to the session's context file for future reference.",
                parameters: { type: "object", properties: { content: { type: "string", description: "Note to write" } }, required: ["content"] }
            }
        }
    ];

    async function executeRealTool(name, args, agentPanel) {
        switch(name) {
            case 'web_search': {
                const q = encodeURIComponent(args.query);
                addAgentStep(agentPanel, '🔍', 'Searching the web', args.query);
                try {
                    // DuckDuckGo Instant Answer API (no key needed)
                    const resp = await fetch(`https://api.duckduckgo.com/?q=${q}&format=json&no_html=1&skip_disambig=1`);
                    const data = await resp.json();
                    const results = [
                        data.AbstractText && `Summary: ${data.AbstractText}`,
                        ...(data.RelatedTopics || []).slice(0, 5).map(t => t.Text || '').filter(Boolean)
                    ].filter(Boolean);
                    const output = results.length > 0 ? results.join('\n\n') : `No instant answer found for: ${args.query}. Try fetch_url with a specific URL instead.`;
                    addAgentStep(agentPanel, '✅', 'Search complete', `${results.length} results`);
                    return output;
                } catch(e) {
                    return `Search failed: ${e.message}`;
                }
            }
            case 'fetch_url': {
                addAgentStep(agentPanel, '📖', 'Fetching URL', args.url.substring(0, 60) + '...');
                try {
                    const resp = await fetch(`/api/fetch_url?url=${encodeURIComponent(args.url)}`);
                    const data = await resp.json();
                    if (data.error) return `Error fetching URL: ${data.error}`;
                    addAgentStep(agentPanel, '✅', 'URL fetched', `${data.content.length} chars`);
                    return `Content from ${args.url}:\n\n${data.content}`;
                } catch(e) {
                    return `Fetch failed: ${e.message}`;
                }
            }
            case 'run_python': {
                const preview = args.code.split('\n')[0].substring(0, 50);
                addAgentStep(agentPanel, '🐍', 'Running Python', preview);
                try {
                    const resp = await fetch('/api/run_python', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ code: args.code })
                    });
                    const data = await resp.json();
                    addAgentStep(agentPanel, '✅', 'Code executed');
                    return `Python output:\n${data.output}`;
                } catch(e) {
                    return `Execution failed: ${e.message}`;
                }
            }
            case 'read_context': {
                addAgentStep(agentPanel, '📄', 'Reading session context');
                try {
                    const resp = await fetch('/api/context/' + currentSessionId);
                    const text = resp.ok ? await resp.text() : 'No context file found.';
                    addAgentStep(agentPanel, '✅', 'Context loaded');
                    return text;
                } catch(e) {
                    return 'No context file found.';
                }
            }
            case 'write_note': {
                addAgentStep(agentPanel, '📝', 'Writing note to context');
                try {
                    await fetch('/api/context/' + currentSessionId, {
                        method: 'POST',
                        body: args.content
                    });
                    addAgentStep(agentPanel, '✅', 'Note saved');
                    return 'Note written to context file successfully.';
                } catch(e) {
                    return `Write failed: ${e.message}`;
                }
            }
            default:
                return 'Unknown tool.';
        }
    }

    // ─── Core Generate / ReAct Loop ───────────────────────────────────────────
    async function generateResponse(prompt, session) {
        const HOST = 'http://127.0.0.1:11434';
        const modelConfig = MODELS[currentMode];
        const targetModel = modelConfig.id;
        const supportsTools = modelConfig.tools;
        const modeInstruction = MODE_PROMPTS[currentMode];

        let agentIsActive = true;
        let finalContentDiv = null;
        let agentPanel = null;
        let iterationCount = 0;
        const MAX_ITERATIONS = 6; // Safety cap on tool loops

        while (agentIsActive && iterationCount < MAX_ITERATIONS) {
            iterationCount++;

            let apiMessages = [...session.messages];
            if (apiMessages.length > 13) {
                const sys = apiMessages.find(m => m.role === 'system');
                apiMessages = [sys, ...apiMessages.slice(-12)];
            }

            // Inject mode instruction + context for non-tool models
            if (apiMessages[0]?.role === 'system') {
                let systemContent = apiMessages[0].content + '\n\n' + modeInstruction;

                // Manual context injection for models without tool support
                if (!supportsTools) {
                    try {
                        const ctxResp = await fetch('/api/context/' + currentSessionId);
                        if (ctxResp.ok) {
                            const ctx = await ctxResp.text();
                            if (ctx.trim().length > 5) systemContent += `\n\n[Session Knowledge Context:\n${ctx}\n]`;
                        }
                    } catch(e) {}
                }

                apiMessages[0] = { ...apiMessages[0], content: systemContent };
            }

            const requestBody = {
                model: targetModel,
                messages: apiMessages,
                stream: true,
                options: {
                    num_ctx: supportsTools ? 2048 : 1024,
                    num_predict: supportsTools ? 1024 : 512,
                    num_thread: 4,
                    temperature: 0.7
                }
            };

            if (supportsTools) requestBody.tools = agenticTools;

            const response = await fetch(`${HOST}/api/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                const err = await response.text();
                let errData;
                try { errData = JSON.parse(err); } catch(e) { errData = { error: err }; }
                if (finalContentDiv) finalContentDiv.innerHTML = `<em style="color:#ef4444;">Error: ${errData.error || err}</em>`;
                agentIsActive = false;
                break;
            }

            setStatus(true);

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let fullResponse = '';
            let toolCalls = [];

            // Create the answer div once
            if (!finalContentDiv) {
                finalContentDiv = addMessageToUI('assistant', '');
            }
            // Create agent panel on first tool-capable model iteration
            if (supportsTools && !agentPanel) {
                agentPanel = createAgentPanel();
            }

            let queuedRenderText = '';
            let renderPending = false;
            const scheduleRender = () => {
                if (renderPending) return;
                renderPending = true;
                requestAnimationFrame(() => {
                    finalContentDiv.innerHTML = marked.parse(renderThinkTags(queuedRenderText));
                    chatContainer.scrollTop = chatContainer.scrollHeight;
                    renderPending = false;
                });
            };

            // Stream reader loop
            while (true) {
                const { done, value } = await reader.read();
                if (done) {
                    // Final render flush
                    finalContentDiv.innerHTML = marked.parse(renderThinkTags(queuedRenderText));
                    chatContainer.scrollTop = chatContainer.scrollHeight;

                    if (toolCalls.length > 0 && supportsTools) {
                        // Agent decided to use a tool
                        session.messages.push({ role: "assistant", content: fullResponse, tool_calls: toolCalls });
                        loadingIndicator.querySelector('span').textContent = 'Agent working...';

                        for (const tc of toolCalls) {
                            let args = {};
                            try { args = JSON.parse(tc.function.arguments || '{}'); } catch(e) {}
                            const result = await executeRealTool(tc.function.name, args, agentPanel);
                            session.messages.push({ role: "tool", content: String(result) });
                        }
                        // Continue the loop — let the model process tool results
                        break;
                    } else {
                        // Done — no more tools
                        session.messages.push({ role: "assistant", content: fullResponse });
                        session.updatedAt = Date.now();
                        sessions = [session, ...sessions.filter(s => s.id !== session.id)];
                        saveStorage();
                        agentIsActive = false;
                        loadingIndicator.querySelector('span').textContent = 'Thinking...';

                        // Mark agent panel as complete
                        if (agentPanel) {
                            addAgentStep(agentPanel, '✨', 'Answer ready');
                        }

                        // Bhashini button
                        const cleanText = fullResponse.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
                        if (cleanText.length > 20) {
                            const bBtn = document.createElement('button');
                            bBtn.className = 'bhashini-btn';
                            bBtn.textContent = '🌐 Translate with Bhashini';
                            bBtn.addEventListener('click', async () => {
                                bBtn.textContent = 'Translating...';
                                bBtn.disabled = true;
                                const trans = await translateViaBhashini(cleanText);
                                if (trans) {
                                    const tDiv = document.createElement('div');
                                    tDiv.className = 'bhashini-result';
                                    tDiv.innerHTML = `<strong>🇮🇳 Bhashini Translation:</strong><br><br>${marked.parse(trans)}`;
                                    finalContentDiv.appendChild(tDiv);
                                    bBtn.style.display = 'none';
                                } else {
                                    bBtn.textContent = '🌐 Translate with Bhashini';
                                    bBtn.disabled = false;
                                }
                            });
                            finalContentDiv.appendChild(bBtn);
                        }
                        break;
                    }
                }

                const lines = decoder.decode(value, { stream: true }).split('\n');
                for (const line of lines) {
                    if (!line.trim()) continue;
                    try {
                        const parsed = JSON.parse(line);
                        if (parsed.message?.content) {
                            fullResponse += parsed.message.content;
                            queuedRenderText = fullResponse;
                            scheduleRender();
                        }
                        if (parsed.message?.tool_calls) {
                            parsed.message.tool_calls.forEach(tc => {
                                const existing = toolCalls.find(t => t.function.name === tc.function.name);
                                if (!existing) toolCalls.push({ function: { name: tc.function.name, arguments: tc.function.arguments || '' } });
                                else existing.function.arguments += tc.function.arguments || '';
                            });
                        }
                    } catch(e) { /* partial chunk — ignore */ }
                }
            }
        }

        if (iterationCount >= MAX_ITERATIONS && agentPanel) {
            addAgentStep(agentPanel, '⚠️', 'Max iterations reached', 'Stopping agent loop');
        }
    }

    // ─── Form Submit ──────────────────────────────────────────────────────────
    chatForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const messageText = messageInput.value.trim();
        if (!messageText) return;

        let session = sessions.find(s => s.id === currentSessionId);
        if (!session) return;

        if (session.messages.length === 1 && session.messages[0].role === 'system') {
            session.title = messageText.trim().split(/\s+/).slice(0, 4).join(' ') + (messageText.split(/\s+/).length > 4 ? '...' : '');
            renderSidebar();
        }

        session.messages.push({ role: "user", content: messageText });
        session.updatedAt = Date.now();
        sessions = [session, ...sessions.filter(s => s.id !== session.id)];
        saveStorage();
        renderSidebar();

        addMessageToUI('user', messageText);
        messageInput.value = '';
        messageInput.style.height = 'auto';
        setGeneratingState(true);

        try {
            await generateResponse(messageText, session);
        } catch(err) {
            console.error(err);
            addMessageToUI('assistant', `**Connection Error:** ${err.message}. Make sure Ollama is running.`);
            setStatus(false);
        } finally {
            setGeneratingState(false);
        }
    });

    // ─── Init ─────────────────────────────────────────────────────────────────
    loadStorage();
    fetch('http://127.0.0.1:11434/api/tags')
        .then(() => setStatus(true))
        .catch(() => setStatus(false));
});
