#!/usr/bin/env bash
# Fase 2: ctest sem ecrã + ASan/UBSan. Correr em WSL Ubuntu, a partir de Player-Linux/.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BUILD="${ROOT}/build-test"
cmake -S "${ROOT}" -B "${BUILD}" \
  -DCMAKE_BUILD_TYPE=Debug \
  -DPLAYER_LINUX_WITH_GSTREAMER=OFF \
  -DPLAYER_LINUX_SANITIZE=ON
cmake --build "${BUILD}" -j"$(nproc)"
ctest --test-dir "${BUILD}" --output-on-failure
