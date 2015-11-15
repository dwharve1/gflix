@echo off
forever start -o plex.log -e error.log plex.js
