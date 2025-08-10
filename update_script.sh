#!/bin/bash

echo "🔍 Checking current dependency status..."
npm outdated

echo "🛡️ Checking for security vulnerabilities..."
npm audit

echo "📦 Updating all dependencies to latest versions..."
npx npm-check-updates -u

echo "🔧 Installing updated dependencies..."
npm install

echo "🛡️ Fixing security vulnerabilities..."
npm audit fix

echo "🧪 Running tests to ensure everything still works..."
npm test

echo "🎯 Linting code with updated rules..."
npm run lint

echo "✅ Update complete! Please review the changes and test your extension."

# Optional: Show what changed
echo "📋 Summary of changes:"
git diff package.json package-lock.json