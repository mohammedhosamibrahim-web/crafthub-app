#!/usr/bin/env bash
# CraftHub — build Android .apk and .aab
#
# Run on a machine with JDK 17 + Android SDK (cmdline-tools/platform 35/build-tools).
#   export ANDROID_HOME=$HOME/Android/Sdk
#   bash native/android/build_android.sh
#
# No AdMob keys are required. Outputs land in native/android/artifacts/.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
NATIVE="$(cd "$HERE/.." && pwd)"

echo "==> 1/6  Building web assets (dist/)"
(cd "$ROOT" && npm run build)

echo "==> 2/6  Installing Capacitor"
(cd "$NATIVE" && npm install --no-audit --no-fund)

echo "==> 3/6  Generating launcher icons"
python3 "$HERE/make_icons.py" "$HERE/app/src/main/res"

echo "==> 4/6  Adding/refreshing the Android platform"
if [ ! -d "$NATIVE/android/app" ] || [ ! -f "$NATIVE/android/gradlew" ]; then
  (cd "$NATIVE" && npx cap add android)
fi
(cd "$NATIVE" && npx cap sync android)

echo "==> 5/6  Building APK (debug + release)"
(cd "$NATIVE/android" && ./gradlew --no-daemon assembleDebug assembleRelease)

echo "==> 6/6  Building AAB (release, Play Store)"
(cd "$NATIVE/android" && ./gradlew --no-daemon bundleRelease)

mkdir -p "$HERE/artifacts"
find "$NATIVE/android/app/build/outputs" -name "*.apk" -exec cp {} "$HERE/artifacts/" \;
find "$NATIVE/android/app/build/outputs" -name "*.aab" -exec cp {} "$HERE/artifacts/" \;

echo ""
echo "Artifacts:"
ls -lh "$HERE/artifacts/" || true
echo ""
echo "NOTE: without android/keystore.properties the release artifacts are"
echo "debug-signed (installable for testing). Add a keystore for Play Store."
