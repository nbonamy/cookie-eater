#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
probe_dir=$(mktemp -d /tmp/cookie-eater-live.XXXXXX)
trap 'rm -rf "$probe_dir"' EXIT
xcrun swiftc -parse-as-library -target "$(uname -m)-apple-macosx14.0" Native/ModelBridge.swift scripts/ModelRunner.swift -o "$probe_dir/model"
COOKIE_EATER_MODEL_RUNNER="$probe_dir/model" node scripts/live-browser.cjs "$@"
