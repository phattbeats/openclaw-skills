#!/bin/bash
# Quick health check — fetches key metrics, parses, checks thresholds
# Usage: glances_quickcheck.sh [base_url]
DIR="$(cd "$(dirname "$0")" && pwd)"
BASE=${1:-${GLANCES_BASE_URL:-http://10.0.0.100:61208/api/4}}

echo '{"checks":['
first=true

for endpoint in cpu mem load fs; do
  raw=$(curl -s --max-time 5 --fail "${BASE}/${endpoint}" 2>/dev/null)
  [ -z "$raw" ] && continue
  parsed=$(echo "$raw" | node "$DIR/glances_parse.mjs" "$endpoint" 2>/dev/null)

  case $endpoint in
    cpu)  val=$(echo "$parsed" | node -e "process.stdin.on('data',d=>console.log(JSON.parse(d).percent))") 
          thresh=$(node "$DIR/glances_threshold.mjs" cpu "$val" --warning=85 --critical=95) ;;
    mem)  val=$(echo "$parsed" | node -e "process.stdin.on('data',d=>console.log(JSON.parse(d).percent))")
          thresh=$(node "$DIR/glances_threshold.mjs" mem "$val" --warning=80 --critical=90) ;;
    load) val=$(echo "$parsed" | node -e "process.stdin.on('data',d=>console.log(JSON.parse(d).min1))")
          thresh=$(node "$DIR/glances_threshold.mjs" load "$val" --warning=10 --critical=12) ;;
    fs)   thresh='[]'
          echo "$parsed" | node -e "
            const fs=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
            fs.forEach(f=>{
              const s=f.percent>95?'critical':f.percent>85?'warning':'ok';
              if(s!=='ok') console.log(JSON.stringify({status:s,metric:'fs:'+f.mount,value:f.percent,warning:85,critical:95}));
            });" > /tmp/fs_thresh 2>/dev/null
          ;;
  esac

  [ "$first" = true ] && first=false || echo ','
  if [ "$endpoint" = "fs" ]; then
    echo "{\"endpoint\":\"$endpoint\",\"parsed\":$parsed,\"alerts\":[$(cat /tmp/fs_thresh | paste -sd, -)]}"
  else
    echo "{\"endpoint\":\"$endpoint\",\"parsed\":$parsed,\"threshold\":$thresh}"
  fi
done

echo ']}'
