@echo off
echo Fixing npm dependencies...

echo Removing node_modules and package-lock.json...
if exist node_modules rmdir /s /q node_modules
if exist package-lock.json del package-lock.json

echo Cleaning npm cache...
npm cache clean --force

echo Installing dependencies with legacy-peer-deps...
npm install --legacy-peer-deps

echo Dependencies fixed successfully!
echo.
echo You can now run 'npm start' to start the application.
pause