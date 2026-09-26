#!/usr/bin/env bash
# CraftHub — build the Windows .exe and installer (cross-compiles from Linux)
#
#   sudo apt-get install -y gcc-mingw-w64-x86-64 nsis
#   APP_URL="https://your-app.pages.dev/" bash native/windows/build.sh
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_URL="${APP_URL:-https://webapp.pages.dev/}"
CC="${CC:-x86_64-w64-mingw32-gcc}"
RES="${RES:-x86_64-w64-mingw32-windres}"

command -v "$CC"  >/dev/null || { echo "ERROR: $CC not found (apt-get install gcc-mingw-w64-x86-64)"; exit 1; }
command -v makensis >/dev/null || { echo "ERROR: makensis not found (apt-get install nsis)"; exit 1; }

echo "==> 1/4  Icon"
python3 "$HERE/make_ico.py" "$HERE/crafthub.ico"

echo "==> 2/4  Resources"
(cd "$HERE" && "$RES" resource.rc -O coff -o resource.o)

echo "==> 3/4  CraftHub.exe  (APP_URL=$APP_URL)"
"$CC" -O2 -municode -mwindows \
  -DAPP_URL="L\"$APP_URL\"" \
  "$HERE/crafthub.c" "$HERE/resource.o" -o "$HERE/CraftHub.exe" \
  -lole32 -loleaut32 -lshlwapi -ladvapi32 -luser32 -lshell32

echo "==> 4/4  CraftHub-Setup.exe"
(cd "$HERE" && makensis -DAPP_EXE=CraftHub.exe -DOUT=CraftHub-Setup.exe installer.nsi | tail -3)

echo ""
ls -lh "$HERE/CraftHub.exe" "$HERE/CraftHub-Setup.exe"
