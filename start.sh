#!/bin/sh
cd "$(dirname "$0")"
[ -d .git ] && git pull
cd engine && npm start
