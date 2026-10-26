import type { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';

// Tests only: the route hands every tool call the caller's userId in authInfo
// (app/api/[transport]/route.ts). An in-memory client sends the same, as this learner.
export function signInTransport(transport: InMemoryTransport, userId: string): void {
  const send = transport.send.bind(transport);
  transport.send = (message, options) =>
    send(message, {
      ...options,
      authInfo: { token: 'test', clientId: userId, scopes: ['full'], extra: { userId } },
    });
}
