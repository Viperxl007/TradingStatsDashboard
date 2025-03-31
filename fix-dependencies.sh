#!/bin/bash
echo "Fixing npm dependencies..."

echo "Removing node_modules and package-lock.json..."
rm -rf node_modules
rm -f package-lock.json

echo "Cleaning npm cache..."
npm cache clean --force

echo "Installing dependencies with legacy-peer-deps..."
npm install --legacy-peer-deps

echo "Dependencies fixed successfully!"
echo ""
echo "You can now run 'npm start' to start the application."