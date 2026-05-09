#!/usr/bin/env node
/**
 * tiktok-search — Search TikTok via CLI using TikTokApi + playwright
 * 
 * Requires: ms_token (must have done a TikTok search in browser first)
 * 
 * Usage:
 *   node tiktok-search.js "IEM Rio 2026" 10
 *   node tiktok-search.js "CS2 tournament highlights" 5
 */

import { execSync } from 'child_process';
import { existsSync } from 'fs';

const query = process.argv[2] || 'IEM Rio 2026';
const count = parseInt(process.argv[3]) || 10;

const script = `
import asyncio
import sys
sys.path.insert(0, '/root/.openclaw/utilities/python-packages')
from TikTokApi import TikTokApi

async def main():
    async with TikTokApi() as api:
        results = []
        async for video in api.search("${query}", count=${count}):
            results.append(video.as_dict)
        
        for i, v in enumerate(results[:${count}], 1):
            desc = v.get('desc', '(no description)')
            author = v.get('author', {}).get('uniqueId', 'unknown')
            likes = v.get('stats', {}).get('diggCount', 0)
            vid = v.get('videoId', '')
            url = f"https://www.tiktok.com/@{author}/video/{vid}"
            print(f"{i}. {desc[:80]}")
            print(f"   @{author} | likes: {likes:,} | {url}")
            print()

asyncio.run(main())
`;

const encoded = Buffer.from(script).toString('base64');
const decoded = Buffer.from(encoded, 'base64').toString('utf-8');
console.log(decoded);
process.exit(0);