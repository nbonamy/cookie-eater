#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
: "${COOKIE_EATER_TEAM_ID:?Set COOKIE_EATER_TEAM_ID to your Apple Developer team ID}"
export COOKIE_EATER_TEAM_ID
options_dir=$(mktemp -d /tmp/cookie-eater-store.XXXXXX)
trap 'rm -rf "$options_dir"' EXIT
python3 - "$options_dir/ExportOptions.plist" <<'PY'
import os,plistlib,sys
with open(sys.argv[1],'wb') as f:
    plistlib.dump({'method':'app-store-connect','destination':'export','signingStyle':'automatic','teamID':os.environ['COOKIE_EATER_TEAM_ID'],'manageAppVersionAndBuildNumber':False},f)
PY
xcodebuild -project 'Cookie Eater/Cookie Eater.xcodeproj' -scheme 'Cookie Eater' -configuration Release -derivedDataPath build/AppStoreDerivedData -archivePath dist/app-store/CookieEater.xcarchive CODE_SIGN_STYLE=Automatic DEVELOPMENT_TEAM="$COOKIE_EATER_TEAM_ID" ARCHS='arm64 x86_64' ONLY_ACTIVE_ARCH=NO -allowProvisioningUpdates archive
xcodebuild -exportArchive -archivePath dist/app-store/CookieEater.xcarchive -exportPath dist/app-store/export -exportOptionsPlist "$options_dir/ExportOptions.plist" -allowProvisioningUpdates
