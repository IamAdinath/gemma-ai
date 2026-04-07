// ReAct agentic loop — Observe → Think → Act → Observe

import { contextApi, toolsApi } from '../services/api'
import { streamChat } from '../services/ollama'

const MODELS = {
  chat:  { id: 'gemma4:e2b',          tools: true  },
  code:  { id: 'qwen2.5-coder:7b',    tools: true  },
  story: { id: 'deepseek-r1:7b',      tools: false },
}

const MODE_PROMPTS = {
  chat:  'You are a powerful agentic AI assistant. Use tools proactively whenever you need real-world data, web info, or to run code.',
  code:  'You are an elite software architect. Use tools to verify logic, run code, or fetch documentation. Output clean, well-commented code.',
  story: 'You are a master storyteller. Write vivid, culturally rich scripts in English, Hindi, or Marathi. Use <think> tags to plan your narrative before writing. IMPORTANT: Respond only with natural language prose or script text. Never output JSON, tool calls, or structured data of any kind — not even as examples.',
}
function sanitizeForDisplay(text) {
  // Remove fenced ```json blocks containing tool-call shaped objects
  let out = text.replace(/```json[\s\S]*?"name"[\s\S]*?```/gi, '')
  // Remove bare JSON objects that look like tool calls { "name": ..., "arguments": ... }
  out = out.replace(/\{[\s\S]{0,800}?"name"\s*:[\s\S]{0,800}?"arguments"[\s\S]{0,800}?\}/g, '')
  // Collapse resulting triple blank lines
  out = out.replace(/\n{3,}/g, '\n\n')
  return out.trim()
}

const AGENTIC_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'web_search',
      description: 'Search the web for real-time information using DuckDuckGo.',
      parameters: {
        type: 'object',
        properties: { query: { type: 'string', description: 'Search query' } },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'fetch_url',
      description: 'Fetch and read the text content of any URL.',
      parameters: {
        type: 'object',
        properties: { url: { type: 'string', description: 'Full URL to fetch' } },
        required: ['url'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'run_python',
      description: 'Execute Python 3 code on the local machine and return output.',
      parameters: {
        type: 'object',
        properties: { code: { type: 'string', description: 'Python code to execute' } },
        required: ['code'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'read_context',
      description: 'Read the custom knowledge file attached to this chat session.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'write_note',
      description: 'Write a note to the session context file for future reference.',
      parameters: {
        type: 'object',
        properties: { content: { type: 'string', description: 'Note to write' } },
        required: ['content'],
      },
    },
  },
]

async function executeTool(name, args, sessionId, onStep) {
  switch (name) {
    case 'web_search': {
      onStep({ icon: '🔍', label: 'Searching the web', detail: args.query })
      const result = await toolsApi.searchWeb(args.query)
      if (result.results && result.results.startsWith('Error:')) {
        return result.results
      }
      onStep({ icon: '✅', label: 'Search complete' })
      return result.results
    }

    case 'fetch_url': {
      onStep({ icon: '📖', label: 'Fetching URL', detail: args.url.slice(0, 60) + '…' })
      const result = await toolsApi.fetchUrl(args.url)
      if (result.error) return `Error: ${result.error}`
      onStep({ icon: '✅', label: 'URL fetched', detail: `${result.content.length} chars` })
      return `Content from ${args.url}:\n\n${result.content}`
    }

    case 'run_python': {
      const preview = args.code.split('\n')[0].slice(0, 50)
      onStep({ icon: '🐍', label: 'Running Python', detail: preview })
      const result = await toolsApi.runPython(args.code)
      onStep({ icon: '✅', label: 'Code executed' })
      return `Python output:\n${result.output}`
    }

    case 'read_context': {
      onStep({ icon: '📄', label: 'Reading session context' })
      const resp = await contextApi.get(sessionId)
      const text = resp.ok ? await resp.text() : 'No context file found.'
      onStep({ icon: '✅', label: 'Context loaded' })
      return text
    }

    case 'write_note': {
      onStep({ icon: '📝', label: 'Writing note' })
      await contextApi.save(sessionId, args.content)
      onStep({ icon: '✅', label: 'Note saved' })
      return 'Note written to context file.'
    }

    default:
      return 'Unknown tool.'
  }
}
export async function runAgentLoop({
  mode,
  messages,
  sessionId,
  onToken,
  onStep,
  onDone,
  onError,
}) {
  const modelConfig = MODELS[mode]
  const targetModel = modelConfig.id
  const supportsTools = modelConfig.tools
  const modeInstruction = MODE_PROMPTS[mode]

  let agentMessages = [...messages]
  let fullResponse = ''
  const MAX_ITERATIONS = 6

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    // Trim to last 12 messages + system
    let apiMessages = agentMessages
    if (apiMessages.length > 13) {
      const sys = apiMessages.find((m) => m.role === 'system')
      apiMessages = [sys, ...apiMessages.slice(-12)]
    }

    // Inject mode instruction + optional manual context for non-tool models
    if (apiMessages[0]?.role === 'system') {
      let systemContent = apiMessages[0].content + '\n\n' + modeInstruction
      if (!supportsTools) {
        try {
          const ctxResp = await contextApi.get(sessionId)
          if (ctxResp.ok) {
            const ctx = await ctxResp.text()
            if (ctx.trim().length > 5)
              systemContent += `\n\n[Session Knowledge Context:\n${ctx}\n]`
          }
        } catch { /* no context file */ }
      }
      apiMessages = [{ ...apiMessages[0], content: systemContent }, ...apiMessages.slice(1)]
    }

    fullResponse = ''
    let toolCalls = []

    try {
      await streamChat({
        model: targetModel,
        messages: apiMessages,
        tools: supportsTools ? AGENTIC_TOOLS : undefined,
        options: {
          num_ctx: supportsTools ? 2048 : 1024,
          num_predict: supportsTools ? 1024 : 512,
          num_thread: 4,
          temperature: 0.7,
        },
        onChunk: (parsed) => {
          if (parsed.message?.content) {
            fullResponse += parsed.message.content
            const display = supportsTools ? fullResponse : sanitizeForDisplay(fullResponse)
            onToken(display)
          }
          if (parsed.message?.tool_calls) {
            parsed.message.tool_calls.forEach((tc) => {
              const existing = toolCalls.find((t) => t.function.name === tc.function.name)
              if (!existing) {
                toolCalls.push({ function: { name: tc.function.name, arguments: tc.function.arguments || '' } })
              } else {
                existing.function.arguments += tc.function.arguments || ''
              }
            })
          }
        },
      })
    } catch (err) {
      onError(err.message)
      return { messages: agentMessages, finalResponse: '' }
    }

    if (toolCalls.length > 0 && supportsTools) {
      // Push assistant message with tool calls
      agentMessages = [
        ...agentMessages,
        { role: 'assistant', content: fullResponse, tool_calls: toolCalls },
      ]

      // Execute each tool
      for (const tc of toolCalls) {
        let args = {}
        try { args = JSON.parse(tc.function.arguments || '{}') } catch { /* bad JSON */ }
        const result = await executeTool(tc.function.name, args, sessionId, onStep)
        agentMessages = [...agentMessages, { role: 'tool', content: String(result) }]
      }
      // Continue loop
    } else {
      // No tool calls — we're done
      onStep({ icon: '✨', label: 'Answer ready' })
      // Sanitize the stored response too so history doesn't contain raw JSON
      const cleanedResponse = supportsTools ? fullResponse : sanitizeForDisplay(fullResponse)
      const finalMessages = [
        ...agentMessages,
        { role: 'assistant', content: cleanedResponse },
      ]
      onDone(cleanedResponse, finalMessages)
      return { messages: finalMessages, finalResponse: cleanedResponse }
    }
  }

  // Hit max iterations
  onStep({ icon: '⚠️', label: 'Max iterations reached' })
  onDone(fullResponse, agentMessages)
  return { messages: agentMessages, finalResponse: fullResponse }
}
