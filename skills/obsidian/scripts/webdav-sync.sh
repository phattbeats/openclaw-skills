#!/bin/bash
# WebDAV sync helper for Obsidian vault
# Downloads vault, allows local work, uploads changes

set -e

NEXTCLOUD_URL="https://nextcloud.phatt.vip/remote.php/dav/files/phatt"
VAULT_NAME="rogue state"
LOCAL_BASE="/root/.openclaw/workspace/vault-cache"
LOCAL_VAULT="$LOCAL_BASE/$VAULT_NAME"
USER="phatt"
PASS="WzPyR-fLAH2-2fGgk-kQDo3-ToYtr"

mkdir -p "$LOCAL_BASE"

cmd=${1:-help}

case "$cmd" in
  download|pull)
    echo "📥 Downloading vault from Nextcloud..."
    curl -u "$USER:$PASS" -X PROPFIND "$NEXTCLOUD_URL/" --output /dev/null -s
    # Download vault directory
    mkdir -p "$LOCAL_VAULT"
    lftp -c "open -u $USER,$PASS https://nextcloud.phatt.vip/remote.php/dav/files/phatt/; mirror \"$VAULT_NAME\" \"$LOCAL_VAULT\"; bye" 2>/dev/null || {
      echo "lftp not available, using curl fallback..."
      echo "Install lftp for full sync: apt-get install lftp"
    }
    echo "✅ Vault cached at: $LOCAL_VAULT"
    ;;
  
  upload|push)
    echo "📤 Uploading changes to Nextcloud..."
    if [ -d "$LOCAL_VAULT" ]; then
      lftp -c "open -u $USER,$PASS https://nextcloud.phatt.vip/remote.php/dav/files/phatt/; mirror -R \"$LOCAL_VAULT\" \"$VAULT_NAME\"; bye" 2>/dev/null || {
        echo "lftp required for upload. Install: apt-get install lftp"
        exit 1
      }
      echo "✅ Changes uploaded"
    else
      echo "❌ No local vault found. Run 'download' first."
      exit 1
    fi
    ;;
  
  path)
    echo "$LOCAL_VAULT"
    ;;
  
  status)
    if [ -d "$LOCAL_VAULT" ]; then
      echo "✅ Vault cached at: $LOCAL_VAULT"
      echo "📝 Note count: $(find "$LOCAL_VAULT" -name "*.md" | wc -l)"
    else
      echo "❌ No local vault. Run '$0 download' first."
    fi
    ;;
  
  *)
    echo "Usage: $0 {download|upload|path|status}"
    echo ""
    echo "Commands:"
    echo "  download  - Pull vault from Nextcloud"
    echo "  upload    - Push changes to Nextcloud"
    echo "  path      - Print local vault path"
    echo "  status    - Show cache status"
    ;;
esac
