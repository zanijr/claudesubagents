/**
 * Task Validator Agent
 *
 * Validates that task completions actually achieve the stated goals.
 * Detects incomplete, superficial, or fraudulent completion claims.
 */

import { BaseAgent } from '../../core/BaseAgent.js';

export class TaskValidatorAgent extends BaseAgent {
    constructor(manifest) {
        super(manifest || require('./manifest.json'));
    }

    async execute(task) {
        const { taskDescription, claimedOutput, successCriteria, context } = task.input;

        this.reportProgress({ percent: 10, message: 'Starting validation...', stage: 'init' });

        try {
            // Analyze the claimed output
            this.reportProgress({ percent: 30, message: 'Analyzing claimed output...', stage: 'analysis' });
            const outputAnalysis = this.analyzeOutput(claimedOutput);

            // Check against success criteria
            this.reportProgress({ percent: 50, message: 'Checking success criteria...', stage: 'criteria' });
            const criteriaCheck = this.checkCriteria(claimedOutput, successCriteria);

            // Detect potential issues
            this.reportProgress({ percent: 70, message: 'Detecting potential issues...', stage: 'issues' });
            const issues = this.detectIssues(taskDescription, claimedOutput);

            // Calculate validation score
            this.reportProgress({ percent: 90, message: 'Calculating validation score...', stage: 'scoring' });
            const validationResult = this.calculateValidation(outputAnalysis, criteriaCheck, issues);

            this.reportProgress({ percent: 100, message: 'Validation complete', stage: 'complete' });

            return {
                status: validationResult.isValid ? 'success' : 'failure',
                output: {
                    isValid: validationResult.isValid,
                    confidence: validationResult.confidence,
                    score: validationResult.score,
                    criteriaResults: criteriaCheck,
                    issues,
                    summary: validationResult.summary,
                    recommendations: validationResult.recommendations
                },
                confidence: validationResult.confidence
            };

        } catch (error) {
            return {
                status: 'failure',
                output: {},
                error: {
                    code: 'VALIDATION_ERROR',
                    message: error.message,
                    recoverable: true
                }
            };
        }
    }

    analyzeOutput(output) {
        const analysis = {
            hasContent: false,
            contentType: 'unknown',
            completeness: 0,
            hasPlaceholders: false,
            hasTodoMarkers: false
        };

        if (!output) {
            return analysis;
        }

        const outputStr = typeof output === 'string' ? output : JSON.stringify(output);

        analysis.hasContent = outputStr.length > 0;
        analysis.contentType = typeof output;

        // Check for placeholder patterns
        const placeholders = outputStr.match(/TODO|FIXME|XXX|\[.*\]|<.*>|\.{3}|placeholder/gi);
        analysis.hasPlaceholders = placeholders && placeholders.length > 0;

        // Check for incomplete markers
        analysis.hasTodoMarkers = /TODO|FIXME|WIP|incomplete/i.test(outputStr);

        // Estimate completeness
        if (!analysis.hasContent) {
            analysis.completeness = 0;
        } else if (analysis.hasPlaceholders || analysis.hasTodoMarkers) {
            analysis.completeness = 0.5;
        } else {
            analysis.completeness = 0.8;
        }

        return analysis;
    }

    checkCriteria(output, successCriteria) {
        if (!successCriteria || successCriteria.length === 0) {
            return {
                hasCriteria: false,
                passed: [],
                failed: [],
                passRate: 1 // No criteria = all pass
            };
        }

        const passed = [];
        const failed = [];
        const outputStr = typeof output === 'string' ? output : JSON.stringify(output);

        for (const criterion of successCriteria) {
            // Simple keyword matching (could be enhanced with AI)
            const criterionKeywords = criterion.toLowerCase().split(/\s+/);
            const matches = criterionKeywords.filter(kw =>
                outputStr.toLowerCase().includes(kw)
            );

            if (matches.length >= criterionKeywords.length * 0.5) {
                passed.push({ criterion, confidence: matches.length / criterionKeywords.length });
            } else {
                failed.push({ criterion, reason: 'Criterion keywords not found in output' });
            }
        }

        return {
            hasCriteria: true,
            passed,
            failed,
            passRate: passed.length / successCriteria.length
        };
    }

    detectIssues(taskDescription, output) {
        const issues = [];
        const outputStr = typeof output === 'string' ? output : JSON.stringify(output);

        // Check for empty or minimal output
        if (!output || outputStr.length < 10) {
            issues.push({
                severity: 'critical',
                type: 'empty-output',
                message: 'Output is empty or too short',
                suggestion: 'Ensure the task actually produces meaningful output'
            });
        }

        // Check for mock/stub indicators
        if (/mock|stub|fake|dummy|test data/i.test(outputStr)) {
            issues.push({
                severity: 'high',
                type: 'mock-data',
                message: 'Output contains mock/stub indicators',
                suggestion: 'Replace mock data with actual implementation'
            });
        }

        // Check for incomplete implementations
        if (/not implemented|throw new Error|NotImplemented/i.test(outputStr)) {
            issues.push({
                severity: 'critical',
                type: 'not-implemented',
                message: 'Output contains not-implemented markers',
                suggestion: 'Complete the implementation before marking as done'
            });
        }

        // Check if output matches task description keywords
        if (taskDescription) {
            const taskKeywords = taskDescription.toLowerCase()
                .replace(/[^\w\s]/g, '')
                .split(/\s+/)
                .filter(w => w.length > 3);

            const matchedKeywords = taskKeywords.filter(kw =>
                outputStr.toLowerCase().includes(kw)
            );

            const relevanceScore = matchedKeywords.length / taskKeywords.length;
            if (relevanceScore < 0.3) {
                issues.push({
                    severity: 'medium',
                    type: 'low-relevance',
                    message: 'Output may not be relevant to the task description',
                    suggestion: 'Verify the output addresses the original task requirements'
                });
            }
        }

        return issues;
    }

    calculateValidation(analysis, criteriaCheck, issues) {
        let score = 100;

        // Deduct for issues
        for (const issue of issues) {
            if (issue.severity === 'critical') score -= 40;
            else if (issue.severity === 'high') score -= 25;
            else if (issue.severity === 'medium') score -= 10;
            else score -= 5;
        }

        // Factor in completeness
        score = score * analysis.completeness;

        // Factor in criteria pass rate
        if (criteriaCheck.hasCriteria) {
            score = score * criteriaCheck.passRate;
        }

        // Determine validity (95% threshold)
        const isValid = score >= 95 && issues.filter(i => i.severity === 'critical').length === 0;

        // Calculate confidence
        const confidence = Math.max(0.5, Math.min(1, score / 100));

        // Generate summary
        const summary = isValid
            ? 'Task completion validated successfully'
            : `Task validation failed with score ${score.toFixed(0)}/100`;

        // Generate recommendations
        const recommendations = issues.map(issue => ({
            priority: issue.severity,
            action: issue.suggestion
        }));

        return {
            isValid,
            score: Math.max(0, Math.min(100, score)),
            confidence,
            summary,
            recommendations
        };
    }
}

export default TaskValidatorAgent;
