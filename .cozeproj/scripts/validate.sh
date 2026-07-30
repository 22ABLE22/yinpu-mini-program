#!/bin/bash
set -Eeuo pipefail

cd "${COZE_WORKSPACE_PATH}"

echo "🔍 Running validate..."
pnpm validate
echo "✅ Validate passed!"
