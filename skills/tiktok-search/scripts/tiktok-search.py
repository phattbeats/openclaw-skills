#!/usr/bin/env python3
"""
TikTok Search — uses TikTokApi with playwright sessions
Usage: python3 tiktok-search.py "search query" [count]
"""
import asyncio
import sys
import json
import re
sys.path.insert(0, '/root/.openclaw/utilities/python-packages')

async def search_tiktok(query, count=10):
    from TikTokApi import TikTokApi
    import random

    ms_tokens = os.environ.get('TIKTOK_MS_TOKENS', '').split(',') if os.environ.get('TIKTOK_MS_TOKENS') else []
    
    async with TikTokApi() as api:
        # Try to get session cookies from env or file
        cookies_file = '/root/.openclaw/workspace/agents/ledger/tiktok-cookies.json'
        if os.path.exists(cookies_file):
            cookies = json.load(open(cookies_file))
            await api.set_session_cookies(cookies)
            print(f"Loaded session cookies from {cookies_file}")
        
        print(f"Searching TikTok for: {query}")
        try:
            results = []
            async for video in api.search(query, count=count):
                results.append(video.as_dict)
            
            print(f"\nFound {len(results)} results:\n")
            for i, v in enumerate(results[:10], 1):
                desc = v.get('desc', '(no description)')
                author = v.get('author', {}).get('uniqueId', 'unknown')
                likes = v.get('stats', {}).get('diggCount', 0)
                shares = v.get('stats', {}).get('shareCount', 0)
                url = f"https://www.tiktok.com/@{author}/video/{v.get('videoId', '')}"
                print(f"{i}. {desc}")
                print(f"   @{author} | ❤️ {likes:,} | 🔗 {shares:,}")
                print(f"   {url}\n")
            
            return results
        except Exception as e:
            print(f"Search error: {e}")
            import traceback
            traceback.print_exc()
            return []

if __name__ == '__main__':
    query = sys.argv[1] if len(sys.argv) > 1 else "IEM Rio 2026 CS2"
    count = int(sys.argv[2]) if len(sys.argv) > 2 else 10
    import os
    asyncio.run(search_tiktok(query, count))