import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

// Simple in-memory event store for SSE broadcasting
// In production, use Redis or similar for multi-instance support
const eventQueue: Array<{ type: string; data: object; timestamp: Date }> = []
const MAX_QUEUE_SIZE = 100

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const eventType = request.headers.get('X-Event-Type') || body.type

        // Store event
        await prisma.event.create({
            data: {
                type: eventType,
                data: JSON.stringify(body.data || body)
            }
        })

        // Add to queue for SSE broadcast
        eventQueue.push({
            type: eventType,
            data: body.data || body,
            timestamp: new Date()
        })

        // Trim queue
        while (eventQueue.length > MAX_QUEUE_SIZE) {
            eventQueue.shift()
        }

        // Handle specific event types
        switch (eventType) {
            case 'task_submitted':
            case 'task_started':
                await handleTaskEvent(body.data || body)
                break

            case 'task_progress':
                await handleProgressEvent(body.data || body)
                break

            case 'task_completed':
            case 'task_failed':
            case 'task_cancelled':
                await handleTaskCompletion(body.data || body)
                break

            case 'escalation':
                await handleEscalation(body.data || body)
                break

            case 'agent_registered':
            case 'agent_status':
                await handleAgentEvent(body.data || body)
                break
        }

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Failed to ingest event:', error)
        return NextResponse.json(
            { error: 'Failed to ingest event' },
            { status: 500 }
        )
    }
}

async function handleTaskEvent(data: any) {
    await prisma.task.upsert({
        where: { externalId: data.taskId || data.id },
        create: {
            externalId: data.taskId || data.id,
            type: data.type || 'unknown',
            title: data.title || data.type || 'Untitled Task',
            description: data.description,
            status: data.status || 'pending',
            progress: data.progress || 0,
            agentId: data.agentId
        },
        update: {
            status: data.status,
            progress: data.progress,
            agentId: data.agentId,
            startedAt: data.status === 'running' ? new Date() : undefined
        }
    })
}

async function handleProgressEvent(data: any) {
    await prisma.task.updateMany({
        where: { externalId: data.taskId },
        data: {
            progress: data.percent || data.progress,
            status: 'running'
        }
    })
}

async function handleTaskCompletion(data: any) {
    await prisma.task.updateMany({
        where: { externalId: data.taskId },
        data: {
            status: data.status || 'completed',
            progress: 100,
            completedAt: new Date(),
            output: data.result ? JSON.stringify(data.result) : null,
            error: data.error ? JSON.stringify(data.error) : null
        }
    })
}

async function handleEscalation(data: any) {
    await prisma.escalation.create({
        data: {
            taskId: data.taskId,
            agentId: data.agentId,
            type: data.type || 'failure',
            priority: data.priority || 'medium',
            message: data.message || 'Task requires attention',
            context: data.context ? JSON.stringify(data.context) : null,
            options: JSON.stringify(data.options || ['retry', 'cancel'])
        }
    })

    // Also update task status
    await prisma.task.updateMany({
        where: { externalId: data.taskId },
        data: { status: 'escalated' }
    })
}

async function handleAgentEvent(data: any) {
    await prisma.agent.upsert({
        where: { id: data.agentId || data.id },
        create: {
            id: data.agentId || data.id,
            name: data.name || data.agentId || data.id,
            type: data.type || 'unknown',
            capabilities: JSON.stringify(data.capabilities || []),
            status: data.status || 'available'
        },
        update: {
            status: data.status,
            currentTaskId: data.currentTaskId,
            lastHeartbeat: new Date()
        }
    })
}

// Get recent events (for polling fallback)
export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url)
    const since = searchParams.get('since')

    const events = await prisma.event.findMany({
        where: since ? {
            timestamp: { gt: new Date(since) }
        } : {},
        orderBy: { timestamp: 'desc' },
        take: 50
    })

    return NextResponse.json({
        events: events.map(e => ({
            ...e,
            data: JSON.parse(e.data)
        }))
    })
}
