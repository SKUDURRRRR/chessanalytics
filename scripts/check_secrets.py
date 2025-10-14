#!/usr/bin/env python3
"""
Security scanner to detect hardcoded credentials in the codebase.
This runs as part of pre-commit hooks and is Windows-compatible.
"""
import re
import sys
import os
from pathlib import Path
from typing import List, Tuple, Dict

# Patterns to detect - enhanced for comprehensive security scanning
DANGEROUS_PATTERNS = [
    # Supabase credentials (specific patterns)
    (r'eyJ[A-Za-z0-9_-]{20,}\.eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}', 'JWT Token (Supabase or similar)'),
    (r'SUPABASE_SERVICE_ROLE_KEY\s*=\s*["\']eyJ[A-Za-z0-9_-]{20,}', 'Hardcoded Supabase Service Role Key'),
    (r'SUPABASE_ANON_KEY\s*=\s*["\']eyJ[A-Za-z0-9_-]{20,}', 'Hardcoded Supabase Anon Key'),
    (r'SUPABASE_URL\s*=\s*["\']https?://[a-z0-9-]+\.supabase\.co["\']', 'Hardcoded Supabase URL'),

    # Database credentials
    (r'DATABASE_URL\s*=\s*["\'][^"\']*postgresql://[^"\']*["\']', 'Database URL with credentials'),
    (r'postgresql://[^:]+:[^@]+@[^/]+', 'PostgreSQL connection string'),

    # API keys and tokens (various formats)
    (r'api[_-]?key\s*=\s*["\'][A-Za-z0-9_-]{20,}["\']', 'API Key'),
    (r'secret[_-]?key\s*=\s*["\'][A-Za-z0-9_-]{20,}["\']', 'Secret Key'),
    (r'password\s*=\s*["\'][^"\']{8,}["\']', 'Hardcoded Password'),
    (r'token\s*=\s*["\'][A-Za-z0-9_-]{20,}["\']', 'Token'),
    (r'access[_-]?token\s*=\s*["\'][A-Za-z0-9_-]{20,}["\']', 'Access Token'),

    # Cloud provider keys
    (r'AKIA[0-9A-Z]{16}', 'AWS Access Key'),
    (r'aws_secret_access_key\s*=\s*["\'][A-Za-z0-9/+=]{20,}["\']', 'AWS Secret Key'),
    (r'GOOGLE_APPLICATION_CREDENTIALS\s*=\s*["\'][^"\']+["\']', 'Google Cloud Credentials'),
    (r'azure[_-]?key\s*=\s*["\'][A-Za-z0-9+/=]{20,}["\']', 'Azure Key'),

    # Stripe keys
    (r'sk_[A-Za-z0-9]{20,}', 'Stripe Secret Key'),
    (r'pk_[A-Za-z0-9]{20,}', 'Stripe Publishable Key'),

    # GitHub tokens
    (r'ghp_[A-Za-z0-9]{36}', 'GitHub Personal Access Token'),
    (r'gho_[A-Za-z0-9]{36}', 'GitHub OAuth Token'),
    (r'ghu_[A-Za-z0-9]{36}', 'GitHub User Token'),
    (r'ghs_[A-Za-z0-9]{36}', 'GitHub Server Token'),
    (r'ghr_[A-Za-z0-9]{36}', 'GitHub Refresh Token'),

    # Private keys (various formats)
    (r'-----BEGIN (RSA|DSA|EC|OPENSSH) PRIVATE KEY-----', 'Private Key'),  # pragma: allowlist secret
    (r'-----BEGIN PRIVATE KEY-----', 'Private Key (PKCS#8)'),  # pragma: allowlist secret

    # OAuth and JWT patterns
    (r'client[_-]?secret\s*=\s*["\'][A-Za-z0-9_-]{20,}["\']', 'OAuth Client Secret'),
    (r'oauth[_-]?token\s*=\s*["\'][A-Za-z0-9_-]{20,}["\']', 'OAuth Token'),

    # Environment variable assignments with secrets
    (r'export\s+[A-Z_]+[A-Z0-9_]*\s*=\s*["\'][A-Za-z0-9_-]{20,}["\']', 'Environment Variable with Secret'),
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
    r'env\.example$',
    r'check_secrets\.py$',  # This file
    r'\.secrets\.baseline$',
    r'\.pre-commit-config\.yaml$',
    r'backups/',
    r'\.cursorignore$',
    r'\.vercel$',
]

# File extensions to scan
SCAN_EXTENSIONS = {'.py', '.ts', '.tsx', '.js', '.jsx', '.json', '.yaml', '.yml', '.env', '.sh', '.ps1', '.bat', '.cmd'}

def should_exclude(file_path: Path) -> bool:
    """Check if file should be excluded from scanning."""
    file_str = str(file_path).replace('\\', '/')
    return any(re.search(pattern, file_str) for pattern in EXCLUDED_PATTERNS)

def is_scannable_file(file_path: Path) -> bool:
    """Check if file should be scanned based on extension and exclusions."""
    if should_exclude(file_path):
        return False

    # Check file extension
    if file_path.suffix.lower() not in SCAN_EXTENSIONS:
        return False

    return True

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

    print("[*] Running comprehensive security scanner...")
    print(f"[*] Scanning: {project_root}")
    print(f"[*] Platform: {os.name} ({sys.platform})")
    print()

    all_findings = []
    files_scanned = 0

    # Scan all relevant files
    for file_path in project_root.rglob('*'):
        if not file_path.is_file():
            continue

        if not is_scannable_file(file_path):
            continue

        files_scanned += 1
        findings = scan_file(file_path)
        if findings:
            all_findings.append((file_path, findings))

    print(f"[*] Scanned {files_scanned} files")
    print()

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
