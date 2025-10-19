#!/usr/bin/env python3
"""
MAINTEST Report Generator
Generate HTML reports with test results, timing, and security findings.
"""

from datetime import datetime
from typing import List, Dict, Any
from pathlib import Path


class TestResult:
    """Container for test results."""
    def __init__(self, category: str, test_name: str, passed: bool, 
                 message: str, duration_ms: float = 0, details: str = None):
        self.category = category
        self.test_name = test_name
        self.passed = passed
        self.message = message
        self.duration_ms = duration_ms
        self.details = details
        self.severity = 'CRITICAL' if not passed and 'security' in category.lower() else 'ERROR'


class MAINTESTReport:
    """Generate comprehensive HTML test reports."""
    
    def __init__(self, test_mode: str = 'full'):
        self.test_mode = test_mode
        self.start_time = datetime.now()
        self.results: List[TestResult] = []
        self.metadata: Dict[str, Any] = {}
    
    def add_result(self, category: str, test_name: str, passed: bool, 
                   message: str, duration_ms: float = 0, details: str = None):
        """Add a test result."""
        self.results.append(TestResult(category, test_name, passed, message, duration_ms, details))
    
    def set_metadata(self, key: str, value: Any):
        """Set metadata for the report."""
        self.metadata[key] = value
    
    def get_summary(self) -> Dict[str, int]:
        """Get test summary statistics."""
        total = len(self.results)
        passed = sum(1 for r in self.results if r.passed)
        failed = total - passed
        
        categories = {}
        for result in self.results:
            if result.category not in categories:
                categories[result.category] = {'passed': 0, 'failed': 0}
            if result.passed:
                categories[result.category]['passed'] += 1
            else:
                categories[result.category]['failed'] += 1
        
        return {
            'total': total,
            'passed': passed,
            'failed': failed,
            'categories': categories,
        }
    
    def generate_html(self) -> str:
        """Generate HTML report."""
        summary = self.get_summary()
        end_time = datetime.now()
        duration = (end_time - self.start_time).total_seconds()
        
        # Calculate status
        all_passed = summary['failed'] == 0
        status_class = 'success' if all_passed else 'failure'
        status_text = '✅ ALL TESTS PASSED' if all_passed else '❌ SOME TESTS FAILED'
        
        html = f"""
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>MAINTEST Report - {self.test_mode.upper()} MODE</title>
    <style>
        * {{
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }}
        
        body {{
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #0f172a;
            color: #e2e8f0;
            padding: 2rem;
            line-height: 1.6;
        }}
        
        .container {{
            max-width: 1200px;
            margin: 0 auto;
        }}
        
        .header {{
            background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
            padding: 2rem;
            border-radius: 12px;
            border: 1px solid #334155;
            margin-bottom: 2rem;
        }}
        
        .header h1 {{
            font-size: 2rem;
            margin-bottom: 0.5rem;
            color: #38bdf8;
        }}
        
        .status {{
            display: inline-block;
            padding: 0.5rem 1rem;
            border-radius: 6px;
            font-weight: bold;
            font-size: 1.1rem;
            margin-top: 1rem;
        }}
        
        .status.success {{
            background: #065f46;
            color: #d1fae5;
        }}
        
        .status.failure {{
            background: #991b1b;
            color: #fecaca;
        }}
        
        .summary {{
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 1rem;
            margin-bottom: 2rem;
        }}
        
        .summary-card {{
            background: #1e293b;
            padding: 1.5rem;
            border-radius: 8px;
            border: 1px solid #334155;
        }}
        
        .summary-card h3 {{
            font-size: 0.875rem;
            text-transform: uppercase;
            color: #94a3b8;
            margin-bottom: 0.5rem;
        }}
        
        .summary-card .value {{
            font-size: 2rem;
            font-weight: bold;
            color: #38bdf8;
        }}
        
        .category {{
            background: #1e293b;
            border: 1px solid #334155;
            border-radius: 8px;
            margin-bottom: 1.5rem;
            overflow: hidden;
        }}
        
        .category-header {{
            background: #334155;
            padding: 1rem 1.5rem;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }}
        
        .category-header h2 {{
            font-size: 1.25rem;
            color: #e2e8f0;
        }}
        
        .category-stats {{
            display: flex;
            gap: 1rem;
            font-size: 0.875rem;
        }}
        
        .stat-passed {{
            color: #6ee7b7;
        }}
        
        .stat-failed {{
            color: #fca5a5;
        }}
        
        .test-result {{
            padding: 1rem 1.5rem;
            border-bottom: 1px solid #334155;
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
        }}
        
        .test-result:last-child {{
            border-bottom: none;
        }}
        
        .test-result.passed {{
            background: rgba(6, 95, 70, 0.1);
        }}
        
        .test-result.failed {{
            background: rgba(153, 27, 27, 0.1);
        }}
        
        .test-info {{
            flex: 1;
        }}
        
        .test-name {{
            font-weight: 600;
            margin-bottom: 0.25rem;
            display: flex;
            align-items: center;
            gap: 0.5rem;
        }}
        
        .test-icon {{
            font-size: 1.25rem;
        }}
        
        .test-message {{
            color: #94a3b8;
            font-size: 0.875rem;
        }}
        
        .test-details {{
            background: #0f172a;
            padding: 0.75rem;
            border-radius: 4px;
            margin-top: 0.5rem;
            font-size: 0.8125rem;
            font-family: 'Courier New', monospace;
            color: #cbd5e1;
            white-space: pre-wrap;
            border-left: 3px solid #ef4444;
        }}
        
        .test-duration {{
            color: #64748b;
            font-size: 0.75rem;
            text-align: right;
        }}
        
        .footer {{
            margin-top: 2rem;
            padding: 1rem;
            text-align: center;
            color: #64748b;
            font-size: 0.875rem;
        }}
        
        .metadata {{
            background: #1e293b;
            border: 1px solid #334155;
            border-radius: 8px;
            padding: 1rem 1.5rem;
            margin-bottom: 2rem;
        }}
        
        .metadata-item {{
            display: flex;
            justify-content: space-between;
            padding: 0.5rem 0;
            border-bottom: 1px solid #334155;
        }}
        
        .metadata-item:last-child {{
            border-bottom: none;
        }}
        
        .metadata-key {{
            color: #94a3b8;
            font-weight: 500;
        }}
        
        .metadata-value {{
            color: #e2e8f0;
            font-family: 'Courier New', monospace;
        }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🧪 MAINTEST Pre-deployment Report</h1>
            <div>Test Mode: <strong>{self.test_mode.upper()}</strong></div>
            <div>Generated: {end_time.strftime('%Y-%m-%d %H:%M:%S')}</div>
            <div class="status {status_class}">{status_text}</div>
        </div>
        
        <div class="summary">
            <div class="summary-card">
                <h3>Total Tests</h3>
                <div class="value">{summary['total']}</div>
            </div>
            <div class="summary-card">
                <h3>Passed</h3>
                <div class="value" style="color: #6ee7b7;">{summary['passed']}</div>
            </div>
            <div class="summary-card">
                <h3>Failed</h3>
                <div class="value" style="color: #fca5a5;">{summary['failed']}</div>
            </div>
            <div class="summary-card">
                <h3>Duration</h3>
                <div class="value" style="font-size: 1.5rem;">{duration:.1f}s</div>
            </div>
        </div>
"""
        
        # Add metadata if present
        if self.metadata:
            html += """
        <div class="metadata">
            <h3 style="margin-bottom: 1rem; color: #94a3b8;">Test Environment</h3>
"""
            for key, value in self.metadata.items():
                html += f"""
            <div class="metadata-item">
                <span class="metadata-key">{key}</span>
                <span class="metadata-value">{value}</span>
            </div>
"""
            html += "        </div>\n"
        
        # Group results by category
        categories = {}
        for result in self.results:
            if result.category not in categories:
                categories[result.category] = []
            categories[result.category].append(result)
        
        # Render each category
        for category, results in categories.items():
            passed = sum(1 for r in results if r.passed)
            failed = len(results) - passed
            
            html += f"""
        <div class="category">
            <div class="category-header">
                <h2>{category}</h2>
                <div class="category-stats">
                    <span class="stat-passed">✓ {passed} passed</span>
                    <span class="stat-failed">✗ {failed} failed</span>
                </div>
            </div>
"""
            
            for result in results:
                icon = "✅" if result.passed else "❌"
                status_class = "passed" if result.passed else "failed"
                
                html += f"""
            <div class="test-result {status_class}">
                <div class="test-info">
                    <div class="test-name">
                        <span class="test-icon">{icon}</span>
                        <span>{result.test_name}</span>
                    </div>
                    <div class="test-message">{result.message}</div>
"""
                
                if result.details:
                    html += f"""
                    <div class="test-details">{result.details}</div>
"""
                
                html += """
                </div>
"""
                
                if result.duration_ms > 0:
                    html += f"""
                <div class="test-duration">{result.duration_ms:.0f}ms</div>
"""
                
                html += """
            </div>
"""
            
            html += """
        </div>
"""
        
        html += f"""
        <div class="footer">
            Generated by MAINTEST Pre-deployment Suite | Chess Analytics Platform
        </div>
    </div>
</body>
</html>
"""
        
        return html
    
    def save_report(self, filename: str = None) -> str:
        """Save HTML report to file."""
        if filename is None:
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            filename = f"MAINTEST_results_{timestamp}.html"
        
        filepath = Path(filename)
        html = self.generate_html()
        
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(html)
        
        return str(filepath.absolute())
    
    def print_summary(self):
        """Print a text summary to console."""
        summary = self.get_summary()
        
        print("\n" + "="*80)
        print("TEST SUMMARY")
        print("="*80)
        print(f"Total Tests: {summary['total']}")
        print(f"Passed: {summary['passed']} ✅")
        print(f"Failed: {summary['failed']} ❌")
        print("\nBy Category:")
        
        for category, stats in summary['categories'].items():
            print(f"  {category}: {stats['passed']} passed, {stats['failed']} failed")
        
        print("="*80)

