'use client'

import { useEffect, useState } from 'react'

interface Agent {
    id: string
    name: string
    type: string
    description?: string
    capabilities: string
    status: string
    currentTaskId?: string
    successRate: number
    tasksExecuted: number
    lastHeartbeat?: string
}

const statusColors: Record<string, string> = {
    available: 'bg-green-500',
    busy: 'bg-yellow-500',
    offline: 'bg-gray-500',
    error: 'bg-red-500',
}

export default function AgentsPage() {
    const [agents, setAgents] = useState<Agent[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        fetchAgents()
    }, [])

    async function fetchAgents() {
        try {
            const res = await fetch('/api/agents')
            const data = await res.json()
            setAgents(data.agents || [])
        } catch (error) {
            console.error('Failed to fetch agents:', error)
        } finally {
            setLoading(false)
        }
    }

    function parseCapabilities(capStr: string): string[] {
        try {
            return JSON.parse(capStr)
        } catch {
            return []
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
            </div>
        )
    }

    const availableCount = agents.filter(a => a.status === 'available').length
    const busyCount = agents.filter(a => a.status === 'busy').length

    return (
        <div>
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-bold">Agents</h1>
                <div className="flex items-center space-x-4 text-sm">
                    <span className="text-green-400">{availableCount} available</span>
                    <span className="text-yellow-400">{busyCount} busy</span>
                    <span className="text-gray-400">{agents.length} total</span>
                </div>
            </div>

            {agents.length === 0 ? (
                <div className="bg-gray-800/50 rounded-xl border border-gray-700 p-12 text-center">
                    <div className="text-gray-400 text-lg">No agents registered</div>
                    <div className="text-gray-500 text-sm mt-2">
                        Agents will appear here when the orchestrator starts
                    </div>
                </div>
            ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {agents.map(agent => (
                        <div
                            key={agent.id}
                            className="bg-gray-800/50 rounded-xl border border-gray-700 p-4 hover:border-gray-600 transition-colors"
                        >
                            <div className="flex items-start justify-between mb-3">
                                <div>
                                    <h3 className="font-medium text-white">{agent.name}</h3>
                                    <p className="text-xs text-gray-500">{agent.id}</p>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <span className={`w-2 h-2 rounded-full ${statusColors[agent.status] || statusColors.offline}`}></span>
                                    <span className="text-xs text-gray-400">{agent.status}</span>
                                </div>
                            </div>

                            {agent.description && (
                                <p className="text-sm text-gray-400 mb-3 line-clamp-2">
                                    {agent.description}
                                </p>
                            )}

                            <div className="flex flex-wrap gap-1 mb-3">
                                {parseCapabilities(agent.capabilities).slice(0, 4).map(cap => (
                                    <span
                                        key={cap}
                                        className="px-2 py-0.5 bg-gray-700 rounded text-xs text-gray-300"
                                    >
                                        {cap}
                                    </span>
                                ))}
                            </div>

                            <div className="flex items-center justify-between text-xs text-gray-500 pt-3 border-t border-gray-700">
                                <span>{agent.tasksExecuted} tasks</span>
                                <span>{(agent.successRate * 100).toFixed(0)}% success</span>
                            </div>

                            {agent.currentTaskId && (
                                <div className="mt-2 text-xs text-yellow-400">
                                    Working on: {agent.currentTaskId.substring(0, 8)}...
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
