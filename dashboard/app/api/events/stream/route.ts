import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'

// Store for active SSE connections
const clients = new Set<ReadableStreamDefaultController>()

export async function GET(request: NextRequest) {
    const stream = new ReadableStream({
        start(controller) {
            clients.add(controller)

            // Send initial connection event
            const data = `event: connected\ndata: ${JSON.stringify({ timestamp: new Date().toISOString() })}\n\n`
            controller.enqueue(new TextEncoder().encode(data))

            // Keep connection alive with periodic heartbeat
            const heartbeat = setInterval(() => {
                try {
                    const ping = `event: heartbeat\ndata: ${JSON.stringify({ timestamp: new Date().toISOString() })}\n\n`
                    controller.enqueue(new TextEncoder().encode(ping))
                } catch {
                    clearInterval(heartbeat)
                    clients.delete(controller)
                }
            }, 30000)

            // Cleanup on close
            request.signal.addEventListener('abort', () => {
                clearInterval(heartbeat)
                clients.delete(controller)
            })
        },
        cancel() {
            // Client disconnected
        }
    })

    return new Response(stream, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
        },
    })
}

// Broadcast event to all connected clients
export function broadcastEvent(type: string, data: object) {
    const message = `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`
    const encoded = new TextEncoder().encode(message)

    for (const client of clients) {
        try {
            client.enqueue(encoded)
        } catch {
            clients.delete(client)
        }
    }
}
