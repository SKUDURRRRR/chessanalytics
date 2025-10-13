#!/usr/bin/env python3
"""
Security scanner to detect hardcoded credentials in the codebase.
This runs as part of pre-commit hooks.
"""
import re
import sys
from pathlib import Path
from typing import List, Tuple

# Patterns to detect
DANGEROUS_PATTERNS = [
    # Supabase credentials
    (r'eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}', 'JWT Token (Supabase or similar)'),
    (r'SUPABASE_SERVICE_ROLE_KEY\s*=\s*["\']eyJ', 'Hardcoded Supabase Service Role Key'),
    (r'SUPABASE_URL\s*=\s*["\']https?://[a-z0-9]+\.supabase\.co', 'Hardcoded Supabase URL'),
    
    # API keys and tokens
    (r'api[_-]?key\s*=\s*["\'][^"\']{20,}["\']', 'API Key'),
    (r'secret[_-]?key\s*=\s*["\'][^"\']{20,}["\']', 'Secret Key'),
    (r'password\s*=\s*["\'][^"\']{8,}["\']', 'Hardcoded Password'),
    (r'token\s*=\s*["\'][^"\']{20,}["\']', 'Token'),
    
    # AWS keys
    (r'AKIA[0-9A-Z]{16}', 'AWS Access Key'),
    (r'aws_secret_access_key\s*=\s*["\'][^"\']{20,}["\']', 'AWS Secret Key'),
    
    # Private keys
    (r'-----BEGIN (RSA|DSA|EC|OPENSSH) PRIVATE KEY-----', 'Private Key'),
]

# Files to exclude from scanning
EXCLUDED_PATTERNS = [
    r'\.git/',
    r'node_modules/',
    r'dist/',
    r'\.venv/',
    r'__pycache__/',
    r'\.md$',
    r'\.log$',
    r'package-lock\.json$',
    r'\.example$',
    r'check_secrets\.py$',  # This file
    r'\.secrets\.baseline$',
]

def should_exclude(file_path: Path) -> bool:
    """Check if file should be excluded from scanning."""
    file_str = str(file_path).replace('\\', '/')
    return any(re.search(pattern, file_str) for pattern in EXCLUDED_PATTERNS)

def scan_file(file_path: Path) -> List[Tuple[int, str, str]]:
    """
    Scan a file for dangerous patterns.
    Returns list of (line_number, pattern_name, matched_text)
    """
    findings = []
    
    try:
        with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
            for line_num, line in enumerate(f, 1):
                for pattern, name in DANGEROUS_PATTERNS:
                    if re.search(pattern, line, re.IGNORECASE):
                        # Redact the actual secret in output
                        matched = re.search(pattern, line, re.IGNORECASE)
                        if matched:
                            redacted = matched.group()[:10] + '***REDACTED***'
                            findings.append((line_num, name, redacted))
    except Exception as e:
        print(f"[!] Could not scan {file_path}: {e}", file=sys.stderr)
    
    return findings

def main():
    """Main security scanner."""
    project_root = Path(__file__).resolve().parent.parent
    
    print("[*] Running security scanner...")
    print(f"[*] Scanning: {project_root}")
    print()
    
    all_findings = []
    
    # Scan all Python files
    for file_path in project_root.rglob('*.py'):
        if should_exclude(file_path):
            continue
        
        findings = scan_file(file_path)
        if findings:
            all_findings.append((file_path, findings))
    
    # Scan all TypeScript files
    for file_path in project_root.rglob('*.ts'):
        if should_exclude(file_path):
            continue
        
        findings = scan_file(file_path)
        if findings:
            all_findings.append((file_path, findings))
    
    # Scan all JavaScript files
    for file_path in project_root.rglob('*.js'):
        if should_exclude(file_path):
            continue
        
        findings = scan_file(file_path)
        if findings:
            all_findings.append((file_path, findings))
    
    # Report findings
    if all_findings:
        print("[!] SECURITY ISSUES FOUND!\n")
        print("="*70)
        
        for file_path, findings in all_findings:
            rel_path = file_path.relative_to(project_root)
            print(f"\n[!] File: {rel_path}")
            for line_num, name, redacted in findings:
                print(f"   Line {line_num}: {name}")
                print(f"   Found: {redacted}")
        
        print("\n" + "="*70)
        print("\n[!] IMMEDIATE ACTIONS REQUIRED:")
        print("1. Remove all hardcoded credentials from these files")
        print("2. Use environment variables with python-dotenv or similar")
        print("3. Rotate any exposed keys/tokens immediately")
        print("4. Add .env to .gitignore (already done)")
        print("5. Run: git log --all --full-history --source --find-object=$(git hash-object <secret>)")
        print("   to find if secrets were committed")
        print("\n[!] COMMIT BLOCKED - Fix security issues before committing\n")
        
        sys.exit(1)
    else:
        print("[OK] No security issues detected!")
        print("[OK] Safe to commit\n")
        sys.exit(0)

if __name__ == "__main__":
    main()

