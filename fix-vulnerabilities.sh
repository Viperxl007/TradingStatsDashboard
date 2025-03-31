#!/bin/bash
echo "Fixing npm vulnerabilities (safe fixes only)..."

echo "This script will attempt to fix vulnerabilities that don't cause breaking changes."
echo ""

echo "Running npm audit fix..."
npm audit fix

echo ""
echo "Safe vulnerability fixes have been applied."
echo ""
echo "NOTE: Some vulnerabilities may still remain if they require breaking changes."
echo "If you want to attempt to fix all vulnerabilities (may break functionality),"
echo "you can run: npm audit fix --force"