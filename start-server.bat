@echo off
title HD CUSTOMS - Server & Database
echo ====================================================
echo Starting HD CUSTOMS Workshop OS & Backend Server...
echo Database: data\hd_customs.db
echo ====================================================
start "" http://localhost:3000
node server.js
pause
