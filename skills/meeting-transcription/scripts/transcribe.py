#!/usr/bin/env python3
"""
Meeting Transcription Script — faster-whisper
Usage: python3 transcribe.py <audio_file> [--language LANG] [--model MODEL]
Models: tiny, base, small, medium, large-v3
"""
import sys
import argparse
import json

def main():
    parser = argparse.ArgumentParser(description="Transcribe audio with faster-whisper")
    parser.add_argument("audio_file", help="Path to audio file")
    parser.add_argument("--language", "-l", default="en", help="Language code (default: en)")
    parser.add_argument("--model", "-m", default="base", 
                        choices=["tiny","base","small","medium","large-v3"],
                        help="Model size (default: base)")
    parser.add_argument("--device", "-d", default="cpu", choices=["cpu","cuda"],
                        help="Device (default: cpu)")
    parser.add_argument("--compute", default="int8", 
                        choices=["int8","float16","float32"],
                        help="Compute type (default: int8)")
    parser.add_argument("--output", "-o", help="Output file (default: stdout)")
    args = parser.parse_args()

    from faster_whisper import WhisperModel
    import os

    model_size = args.model
    device = args.device
    compute = args.compute

    # Auto-detect GPU if requested but unavailable
    if device == "cuda":
        try:
            import torch
            if not torch.cuda.is_available():
                print("WARNING: CUDA requested but not available, falling back to CPU", file=sys.stderr)
                device = "cpu"
                compute = "int8"
        except ImportError:
            print("WARNING: torch not available, falling back to CPU", file=sys.stderr)
            device = "cpu"
            compute = "int8"

    print(f"Loading faster-whisper model '{model_size}' on {device}/{compute}...", file=sys.stderr)
    model = WhisperModel(model_size, device=device, compute_type=compute)

    print(f"Transcribing: {args.audio_file}", file=sys.stderr)
    segments, info = model.transcribe(
        args.audio_file,
        language=args.language,
        beam_size=5,
        vad_filter=True,
        vad_parameters=dict(min_silence_duration_ms=500)
    )

    result = {
        "language": info.language,
        "language_probability": info.language_probability,
        "duration": info.duration,
        "segments": []
    }

    for seg in segments:
        result["segments"].append({
            "start": seg.start,
            "end": seg.end,
            "text": seg.text.strip(),
            "words": [{"word": w.word, "start": w.start, "end": w.end, "probability": w.probability} 
                     for w in (seg.words or [])]
        })

    full_text = " ".join(s["text"] for s in result["segments"])

    output = {
        "text": full_text,
        "language": result["language"],
        "language_probability": result["language_probability"],
        "duration_seconds": result["duration"],
        "num_segments": len(result["segments"]),
        "segments": result["segments"]
    }

    if args.output:
        with open(args.output, "w") as f:
            json.dump(output, f, indent=2)
        print(f"Transcript saved to: {args.output}", file=sys.stderr)
    else:
        print(json.dumps(output, indent=2))

if __name__ == "__main__":
    main()
