#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
identity=${COOKIE_EATER_SIGN_IDENTITY:--}
team=${COOKIE_EATER_TEAM_ID:-}
configuration=Debug
injection=YES
timestamp=--timestamp=none
if [ "$identity" != '-' ]; then
  configuration=${COOKIE_EATER_CONFIGURATION:-Release}
  injection=NO
  timestamp=--timestamp
fi
xcodebuild -project 'Cookie Eater/Cookie Eater.xcodeproj' -scheme 'Cookie Eater' -configuration "$configuration" -derivedDataPath build CODE_SIGN_IDENTITY="$identity" CODE_SIGN_STYLE=Manual DEVELOPMENT_TEAM="$team" CODE_SIGN_INJECT_BASE_ENTITLEMENTS="$injection" OTHER_CODE_SIGN_FLAGS="$timestamp" build "$@"
