import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
    title: 'Agent Orchestrator Dashboard',
    description: 'Monitor and manage your AI agent tasks',
}

export default function RootLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <html lang="en" className="dark">
            <body className="antialiased">
                <div className="min-h-screen">
                    <nav className="bg-gray-900/50 backdrop-blur-sm border-b border-gray-800 sticky top-0 z-50">
                        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                            <div className="flex items-center justify-between h-16">
                                <div className="flex items-center">
                                    <span className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
                                        Agent Orchestrator
                                    </span>
                                </div>
                                <div className="flex items-center space-x-4">
                                    <a href="/" className="text-gray-300 hover:text-white px-3 py-2 text-sm">
                                        Tasks
                                    </a>
                                    <a href="/agents" className="text-gray-300 hover:text-white px-3 py-2 text-sm">
                                        Agents
                                    </a>
                                    <a href="/escalations" className="text-gray-300 hover:text-white px-3 py-2 text-sm">
                                        Escalations
                                    </a>
                                    <a href="/analytics" className="text-gray-300 hover:text-white px-3 py-2 text-sm">
                                        Analytics
                                    </a>
                                </div>
                            </div>
                        </div>
                    </nav>
                    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                        {children}
                    </main>
                </div>
            </body>
        </html>
    )
}
