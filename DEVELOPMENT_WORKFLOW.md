# Development Workflow Guide

## 🏗️ Branch Structure

```
master (stable, production-ready)
    ↑
development (integration, testing)
    ↑
feature/my-feature (specific changes)
```

## 🔄 Daily Development Workflow

### **1. Starting New Work**
```bash
# Always start from development
git checkout development
git pull origin development

# Create feature branch
git checkout -b feature/your-feature-name
```

### **2. Making Changes**
```bash
# Make your changes
# Edit files, add features, fix bugs

# Stage and commit
git add .
git commit -m "Add: description of what you added"
# or
git commit -m "Fix: description of what you fixed"
```

### **3. Pushing Changes**
```bash
# Push feature branch
git push origin feature/your-feature-name

# Create Pull Request: feature/your-feature-name → development
```

### **4. Merging to Development**
- Go to GitHub
- Create PR from feature branch to development
- Wait for CI checks to pass
- Merge PR
- Delete feature branch

### **5. Releasing to Master**
```bash
# When development is ready for release
git checkout development
git pull origin development

# Create PR: development → master
# Merge after review and CI passes
```

## 📝 Commit Message Convention

- `Add:` - New features
- `Fix:` - Bug fixes
- `Update:` - Updates to existing features
- `Refactor:` - Code refactoring
- `Docs:` - Documentation changes
- `Style:` - Code style changes
- `Test:` - Adding or updating tests

## 🚫 What NOT to Do

- ❌ Never push directly to `master`
- ❌ Never push directly to `development` (use feature branches)
- ❌ Never force push to protected branches
- ❌ Never merge without CI checks passing

## ✅ Best Practices

- ✅ Always create feature branches for changes
- ✅ Write descriptive commit messages
- ✅ Keep feature branches small and focused
- ✅ Test your changes before creating PRs
- ✅ Delete feature branches after merging
