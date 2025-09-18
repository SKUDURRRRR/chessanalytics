#!/usr/bin/env node

// Environment Variables Validation Script
// This script validates that all required environment variables are set

const fs = require('fs')
const path = require('path')

console.log('🔍 Validating Environment Variables')
console.log('===================================')

// Check if .env files exist
const frontendEnvPath = '.env'
const backendEnvPath = 'python/.env'

const frontendEnvExists = fs.existsSync(frontendEnvPath)
const backendEnvExists = fs.existsSync(backendEnvPath)

console.log(`Frontend .env: ${frontendEnvExists ? '✅ Found' : '❌ Missing'}`)
console.log(`Backend .env: ${backendEnvExists ? '✅ Found' : '❌ Missing'}`)

if (!frontendEnvExists || !backendEnvExists) {
  console.log('\n🚨 Missing .env files detected!')
  console.log('Run: ./setup-env.sh (Linux/Mac) or setup-env.bat (Windows)')
  process.exit(1)
}

// Read and validate frontend .env
console.log('\n📋 Frontend Environment Variables:')
const frontendEnv = fs.readFileSync(frontendEnvPath, 'utf8')
const frontendLines = frontendEnv.split('\n').filter(line => line.trim() && !line.startsWith('#'))

const requiredFrontendVars = [
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_ANON_KEY',
  'VITE_ANALYSIS_API_URL',
]

let frontendValid = true
requiredFrontendVars.forEach(varName => {
  const line = frontendLines.find(l => l.startsWith(varName + '='))
  if (line && !line.includes('your-') && !line.includes('example')) {
    console.log(`  ✅ ${varName}: Set`)
  } else {
    console.log(`  ❌ ${varName}: Not set or using example value`)
    frontendValid = false
  }
})

// Read and validate backend .env
console.log('\n📋 Backend Environment Variables:')
const backendEnv = fs.readFileSync(backendEnvPath, 'utf8')
const backendLines = backendEnv.split('\n').filter(line => line.trim() && !line.startsWith('#'))

const requiredBackendVars = [
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
  'STOCKFISH_PATH',
  'API_HOST',
  'API_PORT',
]

let backendValid = true
requiredBackendVars.forEach(varName => {
  const line = backendLines.find(l => l.startsWith(varName + '='))
  if (line && !line.includes('your-') && !line.includes('example')) {
    console.log(`  ✅ ${varName}: Set`)
  } else {
    console.log(`  ❌ ${varName}: Not set or using example value`)
    backendValid = false
  }
})

// Summary
console.log('\n📊 Validation Summary:')
console.log(`Frontend: ${frontendValid ? '✅ Valid' : '❌ Invalid'}`)
console.log(`Backend: ${backendValid ? '✅ Valid' : '❌ Invalid'}`)

if (frontendValid && backendValid) {
  console.log('\n🎉 All environment variables are properly configured!')
  console.log('You can now run:')
  console.log('  npm run dev (frontend)')
  console.log('  cd python && python main.py (backend)')
  process.exit(0)
} else {
  console.log('\n🚨 Please fix the environment variable issues above.')
  console.log('Edit the .env files with your actual Supabase credentials.')
  process.exit(1)
}
