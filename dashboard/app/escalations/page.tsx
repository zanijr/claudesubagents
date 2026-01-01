'use client'

import { useEffect, useState } from 'react'

interface Escalation {
    id: string
    taskId: string
    agentId?: string
    type: string
    priority: string
    message: string
    options: string
    createdAt: string
    resolvedAt?: string
    resolution?: string
}

const priorityColors: Record<string, string> = {
    high: 'bg-red-500/20 text-red-400 border-red-500/50',
    medium: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50',
    low: 'bg-blue-500/20 text-blue-400 border-blue-500/50',
}

export default function EscalationsPage() {
    const [escalations, setEscalations] = useState<Escalation[]>([])
    const [loading, setLoading] = useState(true)
    const [responding, setResponding] = useState<string | null>(null)

    useEffect(() => {
        fetchEscalations()
    }, [])

    async function fetchEscalations() {
        try {
            const res = await fetch('/api/escalations?status=pending')
            const data = await res.json()
            setEscalations(data.escalations || [])
        } catch (error) {
            console.error('Failed to fetch escalations:', error)
        } finally {
            setLoading(false)
        }
    }

    async function handleResponse(escalationId: string, action: string) {
        setResponding(escalationId)
        try {
            const res = await fetch(`/api/escalations/${escalationId}/respond`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action })
            })

            if (res.ok) {
                setEscalations(prev => prev.filter(e => e.id !== escalationId))
            }
        } catch (error) {
            console.error('Failed to respond:', error)
        } finally {
            setResponding(null)
        }
    }

    function getRelativeTime(date: string) {
        const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000)
        if (seconds < 60) return `${seconds}s ago`
        const minutes = Math.floor(seconds / 60)
        if (minutes < 60) return `${minutes}m ago`
        const hours = Math.floor(minutes / 60)
        return `${hours}h ago`
    }

    function parseOptions(optionsStr: string): string[] {
        try {
            return JSON.parse(optionsStr)
        } catch {
            return ['retry', 'cancel']
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
            </div>
        )
    }

    return (
        <div>
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-bold">Escalations</h1>
                <span className="text-sm text-gray-400">
                    {escalations.length} pending decision{escalations.length !== 1 ? 's' : ''}
                </span>
            </div>

            {escalations.length === 0 ? (
                <div className="bg-gray-800/50 rounded-xl border border-gray-700 p-12 text-center">
                    <div className="text-gray-400 text-lg">No pending escalations</div>
                    <div className="text-gray-500 text-sm mt-2">
                        When agents fail after max retries, escalations will appear here
                    </div>
                </div>
            ) : (
                <div className="space-y-4">
                    {escalations.map(escalation => (
                        <div
                            key={escalation.id}
                            className="bg-gray-800/50 rounded-xl border border-gray-700 p-6"
                        >
                            <div className="flex items-start justify-between mb-4">
                                <div className="flex items-center space-x-3">
                                    <span className={`px-2 py-1 rounded-full text-xs border ${priorityColors[escalation.priority] || priorityColors.medium}`}>
                                        {escalation.priority.toUpperCase()}
                                    </span>
                                    <span className="text-sm text-gray-400">
                                        Task: {escalation.taskId.substring(0, 8)}...
                                    </span>
                                </div>
                                <span className="text-xs text-gray-500">
                                    {getRelativeTime(escalation.createdAt)}
                                </span>
                            </div>

                            <p className="text-white mb-4 whitespace-pre-line">
                                {escalation.message}
                            </p>

                            {escalation.agentId && (
                                <p className="text-sm text-gray-400 mb-4">
                                    Agent: {escalation.agentId}
                                </p>
                            )}

                            <div className="flex items-center justify-end space-x-3">
                                {parseOptions(escalation.options).map(option => (
                                    <button
                                        key={option}
                                        onClick={() => handleResponse(escalation.id, option)}
                                        disabled={responding === escalation.id}
                                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 ${option === 'retry'
                                                ? 'bg-blue-600 hover:bg-blue-500 text-white'
                                                : option === 'cancel'
                                                    ? 'bg-gray-600 hover:bg-gray-500 text-white'
                                                    : 'bg-purple-600 hover:bg-purple-500 text-white'
                                            }`}
                                    >
                                        {responding === escalation.id ? 'Processing...' : option.replace('_', ' ')}
                                    </button>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
