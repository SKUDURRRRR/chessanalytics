# Security Policy

## 🔒 Critical Security Guidelines

This document outlines security practices for the Chess Analytics project to prevent credential leaks and other security issues.

## ⚠️ IMMEDIATE ACTION REQUIRED

**If you see hardcoded credentials in this repository:**

### 1. Rotate All Exposed Credentials Immediately

#### Rotating Supabase Keys:

1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Select your project
3. Navigate to: Settings → API → Service Role Key
4. Click "Reset API Key" for the service role
5. Click "Generate New Key"
6. Update your local `.env` file with the new key
7. Update any production deployments (Railway, Vercel, etc.)
8. **NEVER** commit the new key to git

### 2. Remove Hardcoded Credentials

Replace any hardcoded credentials with environment variables:

```python
# ❌ WRONG - Hardcoded credential
SUPABASE_URL = "https://<your-project-id>.supabase.co"
SUPABASE_SERVICE_ROLE_KEY = "eyJhbGci..."

# ✅ CORRECT - Use environment variables
import os
from dotenv import load_dotenv

load_dotenv()
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
    raise ValueError("Missing required environment variables")
```

### 3. Check Git History

Check if the secret was committed to git:

```bash
# Search git history for the exposed secret
git log --all --full-history --source -- '*' | grep -i "secret_pattern"

# If found, you may need to rewrite history (DANGEROUS - backup first!)
# Consider using tools like:
# - BFG Repo-Cleaner: https://rtyley.github.io/bfg-repo-cleaner/
# - git-filter-repo: https://github.com/newren/git-filter-repo
```

### 4. Notify Team

If this is a shared repository, notify all team members that keys have been rotated.

## 🛡️ Prevention Measures

### Pre-commit Hooks (RECOMMENDED)

We've set up pre-commit hooks to automatically detect secrets:

```bash
# Install pre-commit hooks
pip install pre-commit
pre-commit install

# Run manually to check all files
pre-commit run --all-files
```

### Manual Security Scan

Run the security scanner manually:

```bash
python scripts/check_secrets.py
```

### Environment Variables Best Practices

1. **Always use `.env` files for local development**
   - Copy `.env.example` to `.env`
   - Fill in your actual credentials
   - `.env` is already in `.gitignore`

2. **For production deployments:**
   - Use platform environment variable features (Railway, Vercel, etc.)
   - Never store secrets in code or config files
   - Use secret management services when possible

3. **Rotate credentials regularly:**
   - Service role keys: Every 90 days or after any exposure
   - API keys: According to provider recommendations
   - After team member departure: Immediately

## 🚨 What to Do If Secrets Are Exposed

### Immediate Actions (within 1 hour):

1. ✅ **Rotate the exposed credentials** (see above)
2. ✅ **Remove hardcoded secrets** from code
3. ✅ **Check database logs** for unauthorized access
4. ✅ **Notify team members**

### Follow-up Actions (within 24 hours):

1. ✅ **Audit git history** for the exposed secret
2. ✅ **Review access logs** for suspicious activity
3. ✅ **Update deployment environments** with new credentials
4. ✅ **Document the incident** and lessons learned
5. ✅ **Install pre-commit hooks** to prevent recurrence

### Long-term Actions:

1. ✅ **Implement secret scanning** in CI/CD pipeline
2. ✅ **Set up automated key rotation** if possible
3. ✅ **Use a secret management service** (AWS Secrets Manager, HashiCorp Vault, etc.)
4. ✅ **Regular security audits** (quarterly)

## 📋 Security Checklist for Pull Requests

Before submitting a PR, verify:

- [ ] No hardcoded credentials in code
- [ ] All secrets use environment variables
- [ ] `.env.example` is updated if new variables are added
- [ ] Pre-commit hooks pass
- [ ] No API keys, tokens, or passwords in comments
- [ ] No database credentials in code
- [ ] No private keys or certificates committed

## 🔍 Common Patterns to Avoid

### ❌ NEVER Do This:

<!-- Examples below use non-real placeholder values. -->
```python
# Hardcoded credentials
API_KEY = "EXAMPLE_NOT_A_REAL_KEY"
PASSWORD = "EXAMPLE_PASSWORD"
DATABASE_URL = "postgres://user:password@host/db"

# Credentials in comments
# TODO: Use key: eyJhbGci...

# Credentials in logs
print(f"Using API key: {api_key}")

# Credentials in error messages
raise Exception(f"Failed to connect with password {password}")
```

### ✅ DO This Instead:

```python
# Use environment variables
import os
from dotenv import load_dotenv

load_dotenv()
API_KEY = os.getenv("API_KEY")

# Redact credentials in logs
print(f"Using API key: {api_key[:5]}***")

# Generic error messages
raise Exception("Failed to connect - check credentials")
```

## 📞 Reporting Security Issues

If you discover a security vulnerability:

1. **DO NOT** create a public GitHub issue
2. **DO NOT** commit any fixes that reveal the vulnerability
3. Contact the repository maintainers privately
4. Wait for confirmation before making any public disclosure

## 🔗 Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [GitHub Secret Scanning](https://docs.github.com/en/code-security/secret-scanning)
- [Supabase Security Best Practices](https://supabase.com/docs/guides/platform/going-into-prod)
- [12 Factor App - Config](https://12factor.net/config)

## 📅 Last Updated

This security policy was created on: October 13, 2024

**Review and update this policy quarterly.**

