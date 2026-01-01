'use client'

import { useEffect, useState } from 'react'

interface Task {
    id: string
    title: string
    type: string
    status: string
    progress: number
    agentId?: string
    retryCount: number
    error?: string
    createdAt: string
    startedAt?: string
}

const statusColors: Record<string, string> = {
    pending: 'bg-gray-500/20 text-gray-400 border-gray-500/50',
    dispatching: 'bg-blue-500/20 text-blue-400 border-blue-500/50',
    running: 'bg-blue-500/20 text-blue-400 border-blue-500/50',
    completed: 'bg-green-500/20 text-green-400 border-green-500/50',
    failed: 'bg-red-500/20 text-red-400 border-red-500/50',
    retrying: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50',
    escalated: 'bg-orange-500/20 text-orange-400 border-orange-500/50',
    cancelled: 'bg-gray-500/20 text-gray-400 border-gray-500/50',
}

export default function TasksPage() {
    const [tasks, setTasks] = useState<Task[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        fetchTasks()

        // Set up SSE for real-time updates
        const eventSource = new EventSource('/api/events/stream')

        eventSource.addEventListener('task_update', (e) => {
            const data = JSON.parse(e.data)
            setTasks(prev => {
                const index = prev.findIndex(t => t.id === data.id)
                if (index >= 0) {
                    const updated = [...prev]
                    updated[index] = { ...updated[index], ...data }
                    return updated
                }
                return [data, ...prev]
            })
        })

        eventSource.addEventListener('task_completed', (e) => {
            const data = JSON.parse(e.data)
            setTasks(prev => prev.filter(t => t.id !== data.taskId))
        })

        return () => eventSource.close()
    }, [])

    async function fetchTasks() {
        try {
            const res = await fetch('/api/tasks')
            const data = await res.json()
            setTasks(data.tasks || [])
        } catch (error) {
            console.error('Failed to fetch tasks:', error)
        } finally {
            setLoading(false)
        }
    }

    function getRelativeTime(date: string) {
        const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000)
        if (seconds < 60) return `${seconds}s ago`
        const minutes = Math.floor(seconds / 60)
        if (minutes < 60) return `${minutes}m ago`
        const hours = Math.floor(minutes / 60)
        if (hours < 24) return `${hours}h ago`
        return `${Math.floor(hours / 24)}d ago`
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            </div>
        )
    }

    return (
        <div>
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-bold">Active Tasks</h1>
                <span className="text-sm text-gray-400">
                    {tasks.length} task{tasks.length !== 1 ? 's' : ''} active
                </span>
            </div>

            {tasks.length === 0 ? (
                <div className="bg-gray-800/50 rounded-xl border border-gray-700 p-12 text-center">
                    <div className="text-gray-400 text-lg">No active tasks</div>
                    <div className="text-gray-500 text-sm mt-2">
                        Tasks will appear here when submitted to the orchestrator
                    </div>
                </div>
            ) : (
                <div className="space-y-4">
                    {tasks.map(task => (
                        <div
                            key={task.id}
                            className="bg-gray-800/50 rounded-xl border border-gray-700 p-4 hover:border-gray-600 transition-colors"
                        >
                            <div className="flex items-start justify-between mb-3">
                                <div>
                                    <h3 className="font-medium text-white">{task.title}</h3>
                                    <div className="text-sm text-gray-400 mt-1">
                                        {task.agentId && (
                                            <span>Agent: {task.agentId}</span>
                                        )}
                                        {task.retryCount > 0 && (
                                            <span className="ml-3 text-yellow-400">
                                                Retry {task.retryCount}/3
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div className="flex items-center space-x-3">
                                    <span className={`px-2 py-1 rounded-full text-xs border ${statusColors[task.status] || statusColors.pending}`}>
                                        {task.status}
                                    </span>
                                    <span className="text-xs text-gray-500">
                                        {getRelativeTime(task.createdAt)}
                                    </span>
                                </div>
                            </div>

                            {task.status === 'running' && (
                                <div className="mt-3">
                                    <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
                                        <span>Progress</span>
                                        <span>{task.progress}%</span>
                                    </div>
                                    <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-300"
                                            style={{ width: `${task.progress}%` }}
                                        />
                                    </div>
                                </div>
                            )}

                            {task.error && (
                                <div className="mt-3 p-2 bg-red-900/20 border border-red-800/50 rounded text-sm text-red-400">
                                    {task.error}
                                </div>
                            )}

                            {task.status === 'escalated' && (
                                <div className="mt-3 flex items-center justify-end space-x-2">
                                    <a
                                        href={`/escalations?task=${task.id}`}
                                        className="px-3 py-1 bg-orange-600 hover:bg-orange-500 text-white text-sm rounded transition-colors"
                                    >
                                        View Escalation
                                    </a>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
