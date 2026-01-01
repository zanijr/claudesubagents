/**
 * Security Scanner Agent
 *
 * Scans code for security vulnerabilities, exposed secrets,
 * and common security anti-patterns.
 */

import { BaseAgent } from '../../core/BaseAgent.js';

export class SecurityScannerAgent extends BaseAgent {
    constructor(manifest) {
        super(manifest || require('./manifest.json'));

        // Common secret patterns
        this.secretPatterns = [
            { name: 'AWS Access Key', pattern: /AKIA[0-9A-Z]{16}/g },
            { name: 'AWS Secret Key', pattern: /[A-Za-z0-9/+=]{40}/g },
            { name: 'GitHub Token', pattern: /ghp_[A-Za-z0-9]{36}/g },
            { name: 'API Key Generic', pattern: /api[_-]?key['":\s]*['"=]?\s*['"]?[A-Za-z0-9]{20,}/gi },
            { name: 'Private Key', pattern: /-----BEGIN (?:RSA |EC |DSA )?PRIVATE KEY-----/g },
            { name: 'Password in Code', pattern: /password\s*[=:]\s*['"][^'"]+['"]/gi },
            { name: 'JWT Token', pattern: /eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g },
            { name: 'Database URL', pattern: /(?:mongodb|postgres|mysql|redis):\/\/[^\s'"]+/gi }
        ];

        // Vulnerability patterns
        this.vulnerabilityPatterns = [
            {
                name: 'SQL Injection',
                pattern: /query\s*\(\s*[`'"]\s*SELECT.*\$\{|execute\s*\(.*\+.*\)/gi,
                severity: 'critical',
                cwe: 'CWE-89'
            },
            {
                name: 'XSS Vulnerability',
                pattern: /innerHTML\s*=|document\.write\s*\(|dangerouslySetInnerHTML/gi,
                severity: 'high',
                cwe: 'CWE-79'
            },
            {
                name: 'Command Injection',
                pattern: /exec\s*\(|spawn\s*\(|child_process.*\$\{/gi,
                severity: 'critical',
                cwe: 'CWE-78'
            },
            {
                name: 'Path Traversal',
                pattern: /\.\.\/|\.\.\\|path\.join.*req\.(body|query|params)/gi,
                severity: 'high',
                cwe: 'CWE-22'
            },
            {
                name: 'Insecure Random',
                pattern: /Math\.random\s*\(\)/g,
                severity: 'medium',
                cwe: 'CWE-330'
            },
            {
                name: 'Hardcoded Credentials',
                pattern: /(?:password|secret|token|key)\s*[:=]\s*['"][^'"]{8,}['"]/gi,
                severity: 'critical',
                cwe: 'CWE-798'
            },
            {
                name: 'Eval Usage',
                pattern: /\beval\s*\(|\bnew\s+Function\s*\(/g,
                severity: 'high',
                cwe: 'CWE-95'
            },
            {
                name: 'Missing Input Validation',
                pattern: /req\.(body|query|params)\.\w+(?!\s*&&|\s*\|\||\s*\?)/g,
                severity: 'medium',
                cwe: 'CWE-20'
            }
        ];
    }

    async execute(task) {
        const { code, language, context } = task.input;

        this.reportProgress({ percent: 10, message: 'Starting security scan...', stage: 'init' });

        try {
            // Scan for secrets
            this.reportProgress({ percent: 30, message: 'Scanning for exposed secrets...', stage: 'secrets' });
            const secrets = this.scanForSecrets(code);

            // Scan for vulnerabilities
            this.reportProgress({ percent: 50, message: 'Scanning for vulnerabilities...', stage: 'vulnerabilities' });
            const vulnerabilities = this.scanForVulnerabilities(code);

            // Check security best practices
            this.reportProgress({ percent: 70, message: 'Checking security best practices...', stage: 'best-practices' });
            const bestPractices = this.checkBestPractices(code);

            // Calculate risk score
            this.reportProgress({ percent: 90, message: 'Calculating risk score...', stage: 'scoring' });
            const riskScore = this.calculateRiskScore(secrets, vulnerabilities, bestPractices);

            this.reportProgress({ percent: 100, message: 'Security scan complete', stage: 'complete' });

            const hasCriticalIssues = secrets.length > 0 ||
                vulnerabilities.some(v => v.severity === 'critical');

            return {
                status: hasCriticalIssues ? 'failure' : 'success',
                output: {
                    secrets,
                    vulnerabilities,
                    bestPractices,
                    riskScore,
                    summary: this.generateSummary(secrets, vulnerabilities, riskScore),
                    recommendations: this.generateRecommendations(secrets, vulnerabilities)
                },
                confidence: 0.9
            };

        } catch (error) {
            return {
                status: 'failure',
                output: {},
                error: {
                    code: 'SCAN_ERROR',
                    message: error.message,
                    recoverable: true
                }
            };
        }
    }

    scanForSecrets(code) {
        const findings = [];

        for (const { name, pattern } of this.secretPatterns) {
            const matches = code.match(pattern);
            if (matches) {
                for (const match of matches) {
                    // Mask the actual secret
                    const masked = match.length > 10
                        ? match.substring(0, 4) + '****' + match.substring(match.length - 4)
                        : '****';

                    findings.push({
                        type: name,
                        severity: 'critical',
                        maskedValue: masked,
                        lineNumber: this.findLineNumber(code, match),
                        message: `Potential ${name} exposed in code`,
                        recommendation: 'Move to environment variables or secrets manager'
                    });
                }
            }
        }

        return findings;
    }

    scanForVulnerabilities(code) {
        const findings = [];

        for (const vuln of this.vulnerabilityPatterns) {
            const matches = code.match(vuln.pattern);
            if (matches) {
                findings.push({
                    type: vuln.name,
                    severity: vuln.severity,
                    cwe: vuln.cwe,
                    occurrences: matches.length,
                    lineNumbers: matches.map(m => this.findLineNumber(code, m)).slice(0, 5),
                    message: `${vuln.name} vulnerability detected (${vuln.cwe})`,
                    recommendation: this.getVulnerabilityRecommendation(vuln.name)
                });
            }
        }

        return findings;
    }

    checkBestPractices(code) {
        const checks = [];

        // Check for HTTPS usage
        if (code.match(/http:\/\/(?!localhost|127\.0\.0\.1)/g)) {
            checks.push({
                name: 'Insecure HTTP',
                status: 'fail',
                message: 'Non-localhost HTTP URLs detected',
                recommendation: 'Use HTTPS for all external connections'
            });
        } else {
            checks.push({ name: 'HTTPS Usage', status: 'pass' });
        }

        // Check for proper error handling
        if (code.match(/catch\s*\(\s*\w*\s*\)\s*\{\s*\}/g)) {
            checks.push({
                name: 'Error Handling',
                status: 'fail',
                message: 'Empty catch blocks detected',
                recommendation: 'Handle errors appropriately, avoid swallowing exceptions'
            });
        } else {
            checks.push({ name: 'Error Handling', status: 'pass' });
        }

        // Check for input validation
        if (code.match(/req\.(body|query|params)/g) && !code.match(/validate|sanitize|zod|joi|yup/gi)) {
            checks.push({
                name: 'Input Validation',
                status: 'warning',
                message: 'User input used without apparent validation',
                recommendation: 'Validate and sanitize all user inputs'
            });
        } else {
            checks.push({ name: 'Input Validation', status: 'pass' });
        }

        // Check for authentication
        if (code.match(/app\.(get|post|put|delete)/g) && !code.match(/auth|middleware|authenticate|isAuthenticated/gi)) {
            checks.push({
                name: 'Authentication',
                status: 'warning',
                message: 'Routes without apparent authentication',
                recommendation: 'Ensure routes are protected with appropriate authentication'
            });
        }

        return checks;
    }

    calculateRiskScore(secrets, vulnerabilities, bestPractices) {
        let score = 100;

        // Deduct for secrets
        score -= secrets.length * 25;

        // Deduct for vulnerabilities
        for (const vuln of vulnerabilities) {
            if (vuln.severity === 'critical') score -= 30;
            else if (vuln.severity === 'high') score -= 20;
            else if (vuln.severity === 'medium') score -= 10;
            else score -= 5;
        }

        // Deduct for failed best practices
        const failedPractices = bestPractices.filter(p => p.status === 'fail');
        score -= failedPractices.length * 10;

        return {
            score: Math.max(0, Math.min(100, score)),
            level: score >= 80 ? 'low' : score >= 50 ? 'medium' : 'high',
            secretsFound: secrets.length,
            vulnerabilitiesFound: vulnerabilities.length,
            bestPracticesFailed: failedPractices.length
        };
    }

    generateSummary(secrets, vulnerabilities, riskScore) {
        const criticalVulns = vulnerabilities.filter(v => v.severity === 'critical');
        const highVulns = vulnerabilities.filter(v => v.severity === 'high');

        let summary = `Security Risk Level: ${riskScore.level.toUpperCase()} (Score: ${riskScore.score}/100)\n`;

        if (secrets.length > 0) {
            summary += `\n- ${secrets.length} exposed secret(s) found (CRITICAL)`;
        }
        if (criticalVulns.length > 0) {
            summary += `\n- ${criticalVulns.length} critical vulnerability(ies)`;
        }
        if (highVulns.length > 0) {
            summary += `\n- ${highVulns.length} high severity vulnerability(ies)`;
        }

        if (secrets.length === 0 && criticalVulns.length === 0) {
            summary += '\n\nNo critical security issues detected.';
        } else {
            summary += '\n\nImmediate action required to address security issues.';
        }

        return summary;
    }

    generateRecommendations(secrets, vulnerabilities) {
        const recommendations = [];

        if (secrets.length > 0) {
            recommendations.push({
                priority: 'critical',
                category: 'secrets',
                action: 'Remove all exposed secrets from code immediately',
                details: 'Use environment variables or a secrets manager like AWS Secrets Manager, HashiCorp Vault'
            });
        }

        const vulnTypes = [...new Set(vulnerabilities.map(v => v.type))];
        for (const type of vulnTypes) {
            recommendations.push({
                priority: vulnerabilities.find(v => v.type === type).severity,
                category: 'vulnerability',
                action: this.getVulnerabilityRecommendation(type),
                type
            });
        }

        return recommendations.sort((a, b) => {
            const order = { critical: 0, high: 1, medium: 2, low: 3 };
            return order[a.priority] - order[b.priority];
        });
    }

    getVulnerabilityRecommendation(type) {
        const recommendations = {
            'SQL Injection': 'Use parameterized queries or ORM instead of string concatenation',
            'XSS Vulnerability': 'Sanitize user input and use safe rendering methods',
            'Command Injection': 'Avoid shell commands with user input, use safe APIs',
            'Path Traversal': 'Validate and sanitize file paths, use path.normalize()',
            'Insecure Random': 'Use crypto.randomBytes() for security-sensitive randomness',
            'Hardcoded Credentials': 'Move credentials to environment variables or secrets manager',
            'Eval Usage': 'Avoid eval() entirely, use safer alternatives',
            'Missing Input Validation': 'Validate all user inputs using a validation library'
        };

        return recommendations[type] || 'Review and fix the security issue';
    }

    findLineNumber(code, match) {
        const index = code.indexOf(match);
        if (index === -1) return -1;
        return code.substring(0, index).split('\n').length;
    }
}

export default SecurityScannerAgent;
