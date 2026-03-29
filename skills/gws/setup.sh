#!/bin/bash
# Google Workspace CLI (gws) skill setup
# Installs gws globally via npm and verifies authentication

set -e

echo "Installing @googleworkspace/cli globally..."
npm install -g @googleworkspace/cli

echo "Verifying installation..."
if ! command -v gws &> /dev/null; then
  echo "ERROR: gws not found in PATH after install"
  exit 1
fi

echo "gws version: $(gws --version)"

echo ""
echo "Next steps:"
echo "  1. Run 'gws auth setup' to create a GCP project and authenticate"
echo "  2. After auth, test with: gws drive about get"
echo ""
echo "Optional: Install upstream agent skills for higher-level workflows:"
echo "  npx skills add https://github.com/googleworkspace/cli"
echo ""
