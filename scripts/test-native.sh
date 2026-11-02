#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
probe_dir=$(mktemp -d /tmp/cookie-eater-native.XXXXXX)
trap 'rm -rf "$probe_dir"' EXIT
xcrun swiftc -parse-as-library -target "$(uname -m)-apple-macosx14.0" Native/ModelBridge.swift scripts/NativeTests.swift -o "$probe_dir/tests"
"$probe_dir/tests"
