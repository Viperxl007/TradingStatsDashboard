@echo off
echo Fixing all npm issues (dependencies and modules)...

echo Removing node_modules and package-lock.json...
if exist node_modules rmdir /s /q node_modules
if exist package-lock.json del package-lock.json

echo Cleaning npm cache...
npm cache clean --force

echo Installing ajv and ajv-keywords explicitly...
npm install ajv@8.12.0 ajv-keywords@5.1.0 --no-save

echo Installing dependencies with legacy-peer-deps...
npm install --legacy-peer-deps

echo Fixing vulnerabilities (safe fixes only)...
npm audit fix

echo All issues fixed successfully!
echo.
echo You can now run 'npm start' to start the application.
echo.
echo If you still encounter issues, try running:
echo npm install --force
echo.
pause