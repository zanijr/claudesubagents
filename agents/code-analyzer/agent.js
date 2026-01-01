/**
 * Code Analyzer Agent
 *
 * Analyzes code for quality, patterns, and potential issues.
 * This is a built-in example agent demonstrating the agent pattern.
 */

import { BaseAgent } from '../../core/BaseAgent.js';

export class CodeAnalyzerAgent extends BaseAgent {
    constructor(manifest) {
        super(manifest || require('./manifest.json'));
    }

    async execute(task) {
        const { code, language, context, focusAreas } = task.input;

        this.reportProgress({ percent: 10, message: 'Starting code analysis...', stage: 'init' });

        try {
            // Analyze code structure
            this.reportProgress({ percent: 30, message: 'Analyzing code structure...', stage: 'structure' });
            const structureAnalysis = this.analyzeStructure(code);

            // Check for issues
            this.reportProgress({ percent: 50, message: 'Detecting potential issues...', stage: 'issues' });
            const issues = this.detectIssues(code, language);

            // Calculate metrics
            this.reportProgress({ percent: 70, message: 'Calculating metrics...', stage: 'metrics' });
            const metrics = this.calculateMetrics(code);

            // Generate recommendations
            this.reportProgress({ percent: 90, message: 'Generating recommendations...', stage: 'recommendations' });
            const recommendations = this.generateRecommendations(issues, metrics);

            this.reportProgress({ percent: 100, message: 'Analysis complete', stage: 'complete' });

            return {
                status: 'success',
                output: {
                    issues,
                    metrics,
                    structure: structureAnalysis,
                    recommendations,
                    summary: this.generateSummary(issues, metrics)
                },
                confidence: 0.85
            };

        } catch (error) {
            return {
                status: 'failure',
                output: {},
                error: {
                    code: 'ANALYSIS_ERROR',
                    message: error.message,
                    recoverable: true,
                    suggestedAction: 'Check code format and try again'
                }
            };
        }
    }

    analyzeStructure(code) {
        const lines = code.split('\n');

        return {
            totalLines: lines.length,
            codeLines: lines.filter(l => l.trim() && !l.trim().startsWith('//')).length,
            commentLines: lines.filter(l => l.trim().startsWith('//')).length,
            blankLines: lines.filter(l => !l.trim()).length,
            functions: (code.match(/function\s+\w+|const\s+\w+\s*=.*=>/g) || []).length,
            classes: (code.match(/class\s+\w+/g) || []).length
        };
    }

    detectIssues(code, language) {
        const issues = [];

        // Check for common issues
        if (code.includes('console.log')) {
            issues.push({
                type: 'warning',
                category: 'debugging',
                message: 'Console.log statement found',
                suggestion: 'Remove console.log before production'
            });
        }

        if (code.includes('TODO') || code.includes('FIXME')) {
            issues.push({
                type: 'info',
                category: 'maintenance',
                message: 'TODO/FIXME comment found',
                suggestion: 'Address pending items'
            });
        }

        if (code.match(/catch\s*\(\s*\w+\s*\)\s*\{\s*\}/)) {
            issues.push({
                type: 'warning',
                category: 'error-handling',
                message: 'Empty catch block detected',
                suggestion: 'Handle or log the error appropriately'
            });
        }

        // Check for very long lines
        const longLines = code.split('\n').filter(l => l.length > 120);
        if (longLines.length > 0) {
            issues.push({
                type: 'style',
                category: 'formatting',
                message: `${longLines.length} lines exceed 120 characters`,
                suggestion: 'Consider breaking long lines for readability'
            });
        }

        return issues;
    }

    calculateMetrics(code) {
        const lines = code.split('\n');
        const nonEmptyLines = lines.filter(l => l.trim());

        // Simple complexity estimation
        const conditionals = (code.match(/if\s*\(|else|switch|case|\?.*:/g) || []).length;
        const loops = (code.match(/for\s*\(|while\s*\(|\.forEach|\.map|\.filter/g) || []).length;

        return {
            linesOfCode: nonEmptyLines.length,
            cyclomaticComplexity: conditionals + loops + 1,
            maintainabilityIndex: Math.max(0, 100 - (conditionals * 2) - (loops * 3)),
            codeToCommentRatio: this.calculateCommentRatio(code)
        };
    }

    calculateCommentRatio(code) {
        const lines = code.split('\n');
        const codeLines = lines.filter(l => l.trim() && !l.trim().startsWith('//')).length;
        const commentLines = lines.filter(l => l.trim().startsWith('//')).length;

        return codeLines > 0 ? (commentLines / codeLines).toFixed(2) : 0;
    }

    generateRecommendations(issues, metrics) {
        const recommendations = [];

        if (metrics.cyclomaticComplexity > 10) {
            recommendations.push({
                priority: 'high',
                category: 'complexity',
                message: 'Consider refactoring to reduce complexity',
                details: 'High cyclomatic complexity makes code harder to test and maintain'
            });
        }

        if (metrics.maintainabilityIndex < 50) {
            recommendations.push({
                priority: 'medium',
                category: 'maintainability',
                message: 'Improve code maintainability',
                details: 'Consider breaking down large functions and adding documentation'
            });
        }

        const criticalIssues = issues.filter(i => i.type === 'error' || i.type === 'warning');
        if (criticalIssues.length > 0) {
            recommendations.push({
                priority: 'high',
                category: 'issues',
                message: `Address ${criticalIssues.length} critical issues`,
                details: criticalIssues.map(i => i.message).join(', ')
            });
        }

        return recommendations;
    }

    generateSummary(issues, metrics) {
        const errorCount = issues.filter(i => i.type === 'error').length;
        const warningCount = issues.filter(i => i.type === 'warning').length;

        let healthStatus = 'good';
        if (errorCount > 0 || metrics.maintainabilityIndex < 30) {
            healthStatus = 'poor';
        } else if (warningCount > 3 || metrics.maintainabilityIndex < 50) {
            healthStatus = 'fair';
        }

        return {
            healthStatus,
            issueCount: issues.length,
            errorCount,
            warningCount,
            complexity: metrics.cyclomaticComplexity,
            recommendation: healthStatus === 'good'
                ? 'Code looks healthy!'
                : 'Consider addressing the identified issues'
        };
    }
}

export default CodeAnalyzerAgent;
