import { createChatServer } from './server.js'

// Fail closed: a paid provider must be explicitly implemented/reviewed next round.
if ((process.env.AI_PROVIDER ?? 'test') !== 'test') throw new Error('AI provider is not configured; only the free test provider is implemented')
const port = Number(process.env.PORT ?? 8787)
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Invalid PORT')
const server = createChatServer({
  origins: process.env.ALLOWED_ORIGINS?.split(',').map(value => value.trim()),
  enabled: process.env.CHAT_ENABLED !== 'false',
  log: entry => console.info(JSON.stringify(entry)),
})
server.listen(port, '127.0.0.1', () => console.info(`CIC local test backend: http://127.0.0.1:${port} (not AI, no paid calls)`))
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.on(signal, () => { server.close(); server.closeAllConnections() })
