#!/bin/bash
 
forever start -a -l plexlog.log -o plex.log -e error.log plex.js
