import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(request: NextRequest) {
    try {
        const tasks = await prisma.task.findMany({
            where: {
                status: {
                    notIn: ['completed', 'cancelled']
                }
            },
            orderBy: {
                createdAt: 'desc'
            },
            take: 50
        })

        return NextResponse.json({ tasks })
    } catch (error) {
        console.error('Failed to fetch tasks:', error)
        return NextResponse.json(
            { error: 'Failed to fetch tasks' },
            { status: 500 }
        )
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()

        const task = await prisma.task.create({
            data: {
                externalId: body.id,
                type: body.type,
                title: body.title || body.type,
                description: body.description,
                status: body.status || 'pending',
                progress: body.progress || 0,
                agentId: body.agentId,
                input: body.input ? JSON.stringify(body.input) : null
            }
        })

        return NextResponse.json({ task })
    } catch (error) {
        console.error('Failed to create task:', error)
        return NextResponse.json(
            { error: 'Failed to create task' },
            { status: 500 }
        )
    }
}
