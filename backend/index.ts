import { createChatServer } from './server.js'
import { createOllamaProvider, ollamaConfig } from './ollama.js'
import { testProvider } from './provider.js'

const providerName = process.env.AI_PROVIDER ?? 'test'
if (!['test', 'ollama'].includes(providerName)) throw new Error('Only test and local ollama providers are supported')
const provider = providerName === 'ollama' ? createOllamaProvider(ollamaConfig(process.env)) : testProvider
const port = Number(process.env.PORT ?? 8787)
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Invalid PORT')
const server = createChatServer({
  provider,
  maxConcurrent: providerName === 'ollama' ? 1 : 2,
  origins: process.env.ALLOWED_ORIGINS?.split(',').map(value => value.trim()),
  enabled: process.env.CHAT_ENABLED !== 'false',
  log: entry => console.info(JSON.stringify(entry)),
})
server.listen(port, '127.0.0.1', () => console.info(`CIC local backend: http://127.0.0.1:${port} (${providerName}, loopback only)`))
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.on(signal, () => { server.close(); server.closeAllConnections() })
