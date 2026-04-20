#!/usr/bin/env bash
# run-tests.sh — run all unit tests and report summary.
# Exits non-zero if any test fails.

set -e
cd "$(dirname "$0")/.."

echo "Running HTMLVault unit tests..."
echo ""

node --test tests/unit/*.test.js
