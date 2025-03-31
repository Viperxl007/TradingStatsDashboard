#!/bin/bash
echo "Fixing all npm issues (dependencies and modules)..."

echo "Removing node_modules and package-lock.json..."
rm -rf node_modules
rm -f package-lock.json

echo "Cleaning npm cache..."
npm cache clean --force

echo "Installing ajv and ajv-keywords explicitly..."
npm install ajv@8.12.0 ajv-keywords@5.1.0 --no-save

echo "Installing dependencies with legacy-peer-deps..."
npm install --legacy-peer-deps

echo "Fixing vulnerabilities (safe fixes only)..."
npm audit fix

echo "All issues fixed successfully!"
echo ""
echo "You can now run 'npm start' to start the application."
echo ""
echo "If you still encounter issues, try running:"
echo "npm install --force"