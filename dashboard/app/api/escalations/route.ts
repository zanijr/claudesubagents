import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const status = searchParams.get('status')

        const where = status === 'pending'
            ? { resolvedAt: null }
            : status === 'resolved'
                ? { resolvedAt: { not: null } }
                : {}

        const escalations = await prisma.escalation.findMany({
            where,
            orderBy: [
                { priority: 'desc' },
                { createdAt: 'desc' }
            ],
            take: 50
        })

        return NextResponse.json({ escalations })
    } catch (error) {
        console.error('Failed to fetch escalations:', error)
        return NextResponse.json(
            { error: 'Failed to fetch escalations' },
            { status: 500 }
        )
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()

        const escalation = await prisma.escalation.create({
            data: {
                taskId: body.taskId,
                agentId: body.agentId,
                type: body.type || 'failure',
                priority: body.priority || 'medium',
                message: body.message,
                context: body.context ? JSON.stringify(body.context) : null,
                options: JSON.stringify(body.options || ['retry', 'cancel'])
            }
        })

        return NextResponse.json({ escalation })
    } catch (error) {
        console.error('Failed to create escalation:', error)
        return NextResponse.json(
            { error: 'Failed to create escalation' },
            { status: 500 }
        )
    }
}
