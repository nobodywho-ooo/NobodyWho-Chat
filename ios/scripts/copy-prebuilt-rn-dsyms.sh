#!/bin/bash
# Copies the dSYMs of React Native's prebuilt frameworks into the build's dSYM
# folder so archives include them (App Store Connect "Upload Symbols Failed")
# and the Sentry upload phase that runs after this one picks them up.
#
# React-Core-prebuilt, ReactNativeDependencies and hermes-engine ship
# xcframeworks without dSYMs. Meta publishes UUID-matching dSYMs separately on
# Maven Central; this downloads the device slice once per version, verifies the
# tarball's SHA-1, and caches it under ~/Library/Caches/reffen-rn-dsyms.
#
# Runs only when archiving for device (ACTION=install, PLATFORM_NAME=iphoneos)
# unless FORCE_RN_DSYMS=1. Never fails the build: problems are Xcode warnings.

set -uo pipefail

if [ "${FORCE_RN_DSYMS:-0}" != "1" ]; then
  if [ "${ACTION:-}" != "install" ] || [ "${PLATFORM_NAME:-}" != "iphoneos" ]; then
    echo "Not a device archive (ACTION=${ACTION:-} PLATFORM_NAME=${PLATFORM_NAME:-}), skipping."
    exit 0
  fi
fi

warn() { echo "warning: [RN dSYMs] $*"; }

: "${DWARF_DSYM_FOLDER_PATH:?DWARF_DSYM_FOLDER_PATH is not set}"
LOCKFILE="${PODS_PODFILE_DIR_PATH:-${SRCROOT:-$(cd "$(dirname "$0")/.." && pwd)}}/Podfile.lock"
CACHE_ROOT="${RN_DSYMS_CACHE:-${HOME}/Library/Caches/reffen-rn-dsyms}"
MAVEN="https://repo1.maven.org/maven2/com/facebook"

pod_version() {
  # "  - hermes-engine (260318099.0.5):" -> 260318099.0.5
  sed -n -E "s/^  - $1 \(([^)]+)\):?$/\1/p" "$LOCKFILE" | head -1
}

# copy_dsym <framework> <version> <tarball url> <path of the dSYM inside the tarball>
copy_dsym() {
  local framework="$1" version="$2" url="$3" member="$4"
  local cache_dir="${CACHE_ROOT}/${framework}-${version}"
  local dsym="${cache_dir}/${framework}.framework.dSYM"

  if [ ! -d "$dsym" ]; then
    echo "Downloading ${framework} ${version} dSYM from ${url}"
    local tmp
    tmp="$(mktemp -d "${TMPDIR:-/tmp}/rn-dsyms.XXXXXX")" || { warn "mktemp failed"; return; }
    if ! curl -fsSL --retry 3 -o "${tmp}/dsym.tgz" "$url" \
      || ! curl -fsSL --retry 3 -o "${tmp}/dsym.tgz.sha1" "${url}.sha1"; then
      warn "download of ${framework} dSYM failed: ${url}"
      rm -rf "$tmp"; return
    fi
    local expected actual
    expected="$(tr -d '[:space:]' < "${tmp}/dsym.tgz.sha1" | cut -c1-40)"
    actual="$(shasum -a 1 "${tmp}/dsym.tgz" | cut -d' ' -f1)"
    if [ "$expected" != "$actual" ]; then
      warn "${framework} dSYM checksum mismatch (expected ${expected}, got ${actual})"
      rm -rf "$tmp"; return
    fi
    mkdir -p "${tmp}/x"
    if ! tar -xzf "${tmp}/dsym.tgz" -C "${tmp}/x" "./${member}" || [ ! -d "${tmp}/x/${member}" ]; then
      warn "${member} not found in ${url}"
      rm -rf "$tmp"; return
    fi
    rm -rf "$cache_dir" && mkdir -p "$cache_dir"
    mv "${tmp}/x/${member}" "$dsym"
    rm -rf "$tmp"
  fi

  mkdir -p "$DWARF_DSYM_FOLDER_PATH"
  rm -rf "${DWARF_DSYM_FOLDER_PATH}/${framework}.framework.dSYM"
  cp -R "$dsym" "$DWARF_DSYM_FOLDER_PATH/"
  echo "Copied ${framework}.framework.dSYM ($(dwarfdump --uuid "$dsym" | awk '{print $2, $3}' | tr '\n' ' '))"
}

if [ ! -f "$LOCKFILE" ]; then
  warn "Podfile.lock not found at ${LOCKFILE}"
  exit 0
fi

RN_VERSION="$(pod_version React-Core-prebuilt)"
DEPS_VERSION="$(pod_version ReactNativeDependencies)"
HERMES_VERSION="$(pod_version hermes-engine)"

if [ -n "$RN_VERSION" ]; then
  copy_dsym React "$RN_VERSION" \
    "${MAVEN}/react/react-native-artifacts/${RN_VERSION}/react-native-artifacts-${RN_VERSION}-reactnative-core-dSYM-release.tar.gz" \
    "ios-arm64/React.framework.dSYM"
else
  echo "React-Core-prebuilt not in Podfile.lock (built from source?), skipping React."
fi

if [ -n "$DEPS_VERSION" ]; then
  copy_dsym ReactNativeDependencies "$DEPS_VERSION" \
    "${MAVEN}/react/react-native-artifacts/${DEPS_VERSION}/react-native-artifacts-${DEPS_VERSION}-reactnative-dependencies-dSYM-release.tar.gz" \
    "ios-arm64/ReactNativeDependencies.framework.dSYM"
else
  echo "ReactNativeDependencies not in Podfile.lock, skipping."
fi

if [ -n "$HERMES_VERSION" ]; then
  copy_dsym hermesvm "$HERMES_VERSION" \
    "${MAVEN}/hermes/hermes-ios/${HERMES_VERSION}/hermes-ios-${HERMES_VERSION}-hermes-framework-dSYM-release.tar.gz" \
    "iphoneos/hermesvm.framework.dSYM"
else
  echo "hermes-engine not in Podfile.lock, skipping Hermes."
fi

exit 0
