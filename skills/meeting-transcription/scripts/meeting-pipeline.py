#!/usr/bin/env python3
"""
Meeting Pipeline: Transcribe → Summarize → Save to Vault
Usage: python3 meeting-pipeline.py <audio_file> <client_name> <meeting_title> [--date YYYY-MM-DD]
"""
import sys
import os
import json
import argparse
import subprocess
import datetime

def run_transcription(audio_path, model="base"):
    """Transcribe audio using faster-whisper."""
    cmd = [
        sys.executable,
        os.path.join(os.path.dirname(__file__), "transcribe.py"),
        audio_path,
        "--model", model,
        "--output", "/tmp/meeting_transcript.json"
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(f"Transcription failed: {result.stderr}")
    
    with open("/tmp/meeting_transcript.json") as f:
        return json.load(f)

def format_summary(transcript_text, language="en"):
    """Use LiteLLM to generate executive summary + action items."""
    import os as os_module
    api_key = os_module.environ.get("LITELLM_API_KEY", "")
    
    if not api_key:
        return {
            "summary": "[LiteLLM_API_Key not configured — install as 'export LITELLM_API_KEY=your-key']",
            "action_items": [],
            "raw_transcript": transcript_text[:2000]
        }
    
    prompt = f"""You are a meeting assistant. Given the following meeting transcript, produce:
1. An executive summary (3-5 key bullet points)
2. A list of action items with owners (if mentioned)

Format your response as JSON with keys: "summary" (string), "action_items" (array of {{"task": str, "owner": str|null, "due": str|null}})

Transcript:
{transcript_text[:8000]}
"""
    
    import urllib.request
    req = urllib.request.Request(
        "http://10.0.0.100:4000/v1/chat/completions",
        data=json.dumps({
            "model": "gpt-4o",
            "messages": [{"role": "user", "content": prompt}],
            "temperature": 0.3
        }).encode(),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        },
        method="POST"
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read())
            content = data["choices"][0]["message"]["content"]
            # Try to parse as JSON
            try:
                return json.loads(content)
            except:
                return {"summary": content, "action_items": [], "raw_transcript": transcript_text[:2000]}
    except Exception as e:
        return {"summary": f"[LLM call failed: {e}]", "action_items": [], "raw_transcript": transcript_text[:2000]}

def save_to_vault(client_name, meeting_title, date_str, transcript, summary_text, action_items):
    """Save meeting note to vault using vault-write."""
    date = date_str or datetime.date.today().isoformat()
    safe_title = meeting_title.lower().replace(" ", "-").replace("/", "-")[:50]
    filename = f"{date}-{safe_title}.md"
    
    content = f"""---
tags: [phatt-tech, meetings, {client_name.lower().replace(" ", "-")}]
date: {date}
---

# {meeting_title}

**Client:** {client_name}
**Date:** {date}
**Duration:** {transcript.get('duration_seconds', '?')}s
**Language:** {transcript.get('language', 'en')} ({transcript.get('language_probability', 0):.0%})

---

## Executive Summary

{summary_text}

---

## Action Items

"""
    for i, item in enumerate(action_items or [], 1):
        owner = item.get("owner", "Unassigned")
        due = item.get("due", "")
        task = item.get("task", str(item))
        content += f"{i}. **[{owner}]{f' (Due: {due})' if due else ''}** {task}\n"
    
    if not action_items:
        content += "_No action items identified._\n"
    
    content += f"""

---

## Full Transcript

{transcript.get('text', '_Transcript not available_')}

---

## Raw Segments

"""
    for seg in transcript.get("segments", []):
        content += f"[{seg['start']:.1f}s - {seg['end']:.1f}s] {seg['text']}\n"
    
    # Write to temp file and save to vault
    tmp_path = f"/tmp/{filename}"
    with open(tmp_path, "w") as f:
        f.write(content)
    
    vault_path = f"PHATT-TECH/meetings/{client_name.lower().replace(' ', '-')}/{filename}"
    
    result = subprocess.run(
        ["/root/.openclaw/utilities/vault-write", vault_path, "--file", tmp_path],
        capture_output=True, text=True
    )
    return vault_path, result.stdout, result.stderr

def main():
    parser = argparse.ArgumentParser(description="Meeting transcription pipeline")
    parser.add_argument("audio_file", help="Path to audio file")
    parser.add_argument("client_name", help="Client name")
    parser.add_argument("meeting_title", help="Meeting title")
    parser.add_argument("--date", "-d", help="Meeting date (YYYY-MM-DD)")
    parser.add_argument("--model", "-m", default="base", 
                        choices=["tiny","base","small","medium","large-v3"],
                        help="Whisper model (default: base)")
    parser.add_argument("--dry-run", action="store_true", help="Skip vault save")
    args = parser.parse_args()

    print(f"[Pipeline] Transcribing: {args.audio_file}", file=sys.stderr)
    transcript = run_transcription(args.audio_file, model=args.model)
    print(f"[Pipeline] Transcript: {transcript['num_segments']} segments, {transcript['duration_seconds']:.0f}s", file=sys.stderr)
    
    if transcript['text'].strip():
        print(f"[Pipeline] Summary: {transcript['text'][:100]}...", file=sys.stderr)
    else:
        print(f"[Pipeline] No speech detected", file=sys.stderr)
    
    summary_text = f"[{transcript['duration_seconds']:.0f}s audio, {transcript['num_segments']} segments — manual review needed]"
    
    if args.dry_run:
        print("[Pipeline] Dry run — skipping vault save")
        print(json.dumps({"transcript": transcript, "summary": summary_text}, indent=2))
        return
    
    vault_path, stdout, stderr = save_to_vault(
        args.client_name,
        args.meeting_title,
        args.date or "",
        transcript,
        summary_text,
        []
    )
    
    print(f"[Pipeline] Vault: {vault_path}")
    if stderr:
        print(f"[Pipeline] vault-write: {stderr[:200]}")

if __name__ == "__main__":
    main()
