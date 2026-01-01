import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function POST(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const body = await request.json()
        const { id } = params

        // Update escalation with resolution
        const escalation = await prisma.escalation.update({
            where: { id },
            data: {
                resolution: JSON.stringify({
                    action: body.action,
                    comment: body.comment,
                    modifiedTask: body.modifiedTask,
                    preferredAgent: body.preferredAgent
                }),
                resolvedAt: new Date(),
                resolvedBy: body.resolvedBy || 'user'
            }
        })

        // Update associated task status
        if (body.action === 'retry' || body.action === 'assign_different_agent') {
            await prisma.task.updateMany({
                where: { externalId: escalation.taskId },
                data: {
                    status: 'pending',
                    error: null
                }
            })
        } else if (body.action === 'cancel') {
            await prisma.task.updateMany({
                where: { externalId: escalation.taskId },
                data: {
                    status: 'cancelled',
                    completedAt: new Date()
                }
            })
        }

        return NextResponse.json({
            success: true,
            escalation,
            action: body.action
        })
    } catch (error) {
        console.error('Failed to respond to escalation:', error)
        return NextResponse.json(
            { error: 'Failed to respond to escalation' },
            { status: 500 }
        )
    }
}
