'use client'

import { useEffect, useState } from 'react'

interface Stats {
    tasks: {
        total: number
        completed: number
        failed: number
        active: number
        successRate: number
    }
    agents: {
        total: number
        available: number
        busy: number
    }
    escalations: {
        pending: number
        resolved: number
    }
}

export default function AnalyticsPage() {
    const [stats, setStats] = useState<Stats | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        fetchStats()
    }, [])

    async function fetchStats() {
        try {
            const [tasksRes, agentsRes, escalationsRes] = await Promise.all([
                fetch('/api/tasks'),
                fetch('/api/agents'),
                fetch('/api/escalations')
            ])

            const [tasksData, agentsData, escalationsData] = await Promise.all([
                tasksRes.json(),
                agentsRes.json(),
                escalationsRes.json()
            ])

            const tasks = tasksData.tasks || []
            const agents = agentsData.agents || []
            const escalations = escalationsData.escalations || []

            const completed = tasks.filter((t: any) => t.status === 'completed').length
            const failed = tasks.filter((t: any) => t.status === 'failed' || t.status === 'cancelled').length

            setStats({
                tasks: {
                    total: tasks.length,
                    completed,
                    failed,
                    active: tasks.filter((t: any) => !['completed', 'failed', 'cancelled'].includes(t.status)).length,
                    successRate: completed + failed > 0 ? completed / (completed + failed) : 0
                },
                agents: {
                    total: agents.length,
                    available: agents.filter((a: any) => a.status === 'available').length,
                    busy: agents.filter((a: any) => a.status === 'busy').length
                },
                escalations: {
                    pending: escalations.filter((e: any) => !e.resolvedAt).length,
                    resolved: escalations.filter((e: any) => e.resolvedAt).length
                }
            })
        } catch (error) {
            console.error('Failed to fetch stats:', error)
        } finally {
            setLoading(false)
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500"></div>
            </div>
        )
    }

    if (!stats) {
        return <div className="text-gray-400">Failed to load analytics</div>
    }

    const successRatePercent = (stats.tasks.successRate * 100).toFixed(1)
    const meetsThreshold = stats.tasks.successRate >= 0.95

    return (
        <div>
            <h1 className="text-2xl font-bold mb-6">Analytics</h1>

            {/* Success Rate Card */}
            <div className={`rounded-xl border p-6 mb-6 ${meetsThreshold
                    ? 'bg-green-900/20 border-green-800'
                    : 'bg-yellow-900/20 border-yellow-800'
                }`}>
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-lg font-medium text-gray-300">Success Rate</h2>
                        <p className={`text-4xl font-bold ${meetsThreshold ? 'text-green-400' : 'text-yellow-400'}`}>
                            {successRatePercent}%
                        </p>
                    </div>
                    <div className={`text-right ${meetsThreshold ? 'text-green-400' : 'text-yellow-400'}`}>
                        {meetsThreshold ? (
                            <>
                                <span className="text-2xl">✓</span>
                                <p className="text-sm">Meets 95% threshold</p>
                            </>
                        ) : (
                            <>
                                <span className="text-2xl">!</span>
                                <p className="text-sm">Below 95% threshold</p>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
                <div className="bg-gray-800/50 rounded-xl border border-gray-700 p-4">
                    <h3 className="text-sm text-gray-400 mb-1">Total Tasks</h3>
                    <p className="text-2xl font-bold text-white">{stats.tasks.total}</p>
                </div>

                <div className="bg-gray-800/50 rounded-xl border border-gray-700 p-4">
                    <h3 className="text-sm text-gray-400 mb-1">Completed</h3>
                    <p className="text-2xl font-bold text-green-400">{stats.tasks.completed}</p>
                </div>

                <div className="bg-gray-800/50 rounded-xl border border-gray-700 p-4">
                    <h3 className="text-sm text-gray-400 mb-1">Failed</h3>
                    <p className="text-2xl font-bold text-red-400">{stats.tasks.failed}</p>
                </div>

                <div className="bg-gray-800/50 rounded-xl border border-gray-700 p-4">
                    <h3 className="text-sm text-gray-400 mb-1">Active Now</h3>
                    <p className="text-2xl font-bold text-blue-400">{stats.tasks.active}</p>
                </div>
            </div>

            {/* Agents & Escalations */}
            <div className="grid gap-4 md:grid-cols-2">
                <div className="bg-gray-800/50 rounded-xl border border-gray-700 p-6">
                    <h3 className="text-lg font-medium text-gray-300 mb-4">Agents</h3>
                    <div className="space-y-3">
                        <div className="flex justify-between">
                            <span className="text-gray-400">Total</span>
                            <span className="text-white font-medium">{stats.agents.total}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-400">Available</span>
                            <span className="text-green-400 font-medium">{stats.agents.available}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-400">Busy</span>
                            <span className="text-yellow-400 font-medium">{stats.agents.busy}</span>
                        </div>
                    </div>
                </div>

                <div className="bg-gray-800/50 rounded-xl border border-gray-700 p-6">
                    <h3 className="text-lg font-medium text-gray-300 mb-4">Escalations</h3>
                    <div className="space-y-3">
                        <div className="flex justify-between">
                            <span className="text-gray-400">Pending</span>
                            <span className={`font-medium ${stats.escalations.pending > 0 ? 'text-orange-400' : 'text-gray-400'}`}>
                                {stats.escalations.pending}
                            </span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-400">Resolved</span>
                            <span className="text-green-400 font-medium">{stats.escalations.resolved}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
