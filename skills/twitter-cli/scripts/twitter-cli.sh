#!/bin/bash
# twitter-cli wrapper
export PYTHONPATH="/root/.openclaw/utilities/python-packages:/root/.openclaw/utilities/twitter-cli:$PYTHONPATH"

# Load credentials from skill folder
ENV_FILE="/root/.openclaw/workspace/skills/twitter-cli/.env"
if [[ -f "$ENV_FILE" ]]; then
    set -a
    source "$ENV_FILE"
    set +a
fi

exec python3 -c "from twitter_cli.cli import cli; cli()" "$@"
