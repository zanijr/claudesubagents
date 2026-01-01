import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(request: NextRequest) {
    try {
        const agents = await prisma.agent.findMany({
            orderBy: {
                name: 'asc'
            }
        })

        return NextResponse.json({ agents })
    } catch (error) {
        console.error('Failed to fetch agents:', error)
        return NextResponse.json(
            { error: 'Failed to fetch agents' },
            { status: 500 }
        )
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()

        const agent = await prisma.agent.upsert({
            where: { id: body.id },
            create: {
                id: body.id,
                name: body.name,
                type: body.type || 'javascript',
                description: body.description,
                capabilities: JSON.stringify(body.capabilities || []),
                status: body.status || 'available'
            },
            update: {
                name: body.name,
                description: body.description,
                capabilities: JSON.stringify(body.capabilities || []),
                status: body.status,
                lastHeartbeat: new Date()
            }
        })

        return NextResponse.json({ agent })
    } catch (error) {
        console.error('Failed to update agent:', error)
        return NextResponse.json(
            { error: 'Failed to update agent' },
            { status: 500 }
        )
    }
}
