@echo off
echo Starting Microservices Architecture...

echo.
echo Starting Uber Service (Port 5001)...
start /B /D "c:\Users\rejain\OneDrive\ProjectsSept2025\app1\uber-service" cmd /c "node server.js"

echo.
echo Waiting for Uber service to start...
timeout /t 3 /nobreak > nul

echo.
echo Starting Main Server (Port 5000)...
start /B /D "c:\Users\rejain\OneDrive\ProjectsSept2025\app1" cmd /c "node server/server.js"

echo.
echo Waiting for Main server to start...
timeout /t 3 /nobreak > nul

echo.
echo Both services should be running!
echo.
echo Services:
echo - Main Server: http://localhost:5000
echo - Uber Service: http://localhost:5001
echo - React Client: http://localhost:3000
echo.
echo Press any key to test the services...
pause > nul

echo.
echo Testing services...
node test-services.js

echo.
echo Press any key to exit...
pause > nul