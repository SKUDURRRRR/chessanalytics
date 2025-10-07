# Example Feature Development

This is an example of how to use the development workflow.

## How this was created:

1. **Started from development branch:**
   ```bash
   git checkout development
   git pull origin development
   ```

2. **Created feature branch:**
   ```bash
   git checkout -b feature/example-workflow
   ```

3. **Made changes:**
   - Created this file
   - Added documentation

4. **Next steps:**
   ```bash
   git add .
   git commit -m "Add: example workflow documentation"
   git push origin feature/example-workflow
   ```

5. **Then create PR on GitHub:**
   - Go to GitHub
   - Create PR: `feature/example-workflow` → `development`
   - Wait for CI checks
   - Merge PR
   - Delete feature branch

## This demonstrates the workflow in action!
