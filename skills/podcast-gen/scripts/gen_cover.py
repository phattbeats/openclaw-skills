#!/usr/bin/env python3
"""Generate per-episode cover art by overlaying text on the base cover.

Usage:
  python3 gen_cover.py <episode_number> "<episode_title>" [output_path]

Example:
  python3 gen_cover.py 2 "SpaceX & Kessler Syndrome"
  python3 gen_cover.py 2 "SpaceX & Kessler Syndrome" output/EP002/cover.png

If output_path is omitted, prints to stdout as base64.
"""
import sys, os

# Check PIL availability
try:
    from PIL import Image, ImageDraw, ImageFont
except ImportError:
    print("ERROR: Pillow not installed.")
    print("Install: pip3 install Pillow")
    sys.exit(1)

# Paths
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
BASE_DIR = os.path.dirname(SCRIPT_DIR)
BASE_COVER = os.path.join(BASE_DIR, "assets", "cover_base.png")
OUTPUT_DIR = os.path.join(BASE_DIR, "assets", "covers")

# Default font (DejaVu should be on most Linux systems)
FONT_PATHS = [
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    "/usr/share/fonts/TTF/DejaVuSans-Bold.ttf",
]

def get_font(size):
    for fp in FONT_PATHS:
        if os.path.exists(fp):
            return ImageFont.truetype(fp, size)
    return ImageFont.load_default()

def generate_cover(ep_number, ep_title, output_path=None):
    if not os.path.exists(BASE_COVER):
        print(f"ERROR: Base cover not found at {BASE_COVER}")
        sys.exit(1)

    img = Image.open(BASE_COVER).convert("RGBA")
    draw = ImageDraw.Draw(img)
    w, h = img.size

    # Episode number (top area)
    ep_label = f"EP{ep_number:03d}"
    ep_font = get_font(int(h * 0.08))  # 8% of image height
    
    # Draw episode number with shadow for readability
    ep_x = int(w * 0.05)
    ep_y = int(h * 0.05)
    # Shadow
    draw.text((ep_x + 2, ep_y + 2), ep_label, font=ep_font, fill=(0, 0, 0, 180))
    # Text
    draw.text((ep_x, ep_y), ep_label, font=ep_font, fill=(255, 215, 0, 255))  # Gold

    # Episode title (bottom area, wrapped)
    title_font = get_font(int(h * 0.045))  # 4.5% of image height
    title_y = int(h * 0.88)
    
    # Simple word wrap
    words = ep_title.split()
    lines = []
    current_line = []
    max_width = int(w * 0.9)
    
    for word in words:
        test = " ".join(current_line + [word])
        bbox = draw.textbbox((0, 0), test, font=title_font)
        if bbox[2] - bbox[0] > max_width and current_line:
            lines.append(" ".join(current_line))
            current_line = [word]
        else:
            current_line.append(word)
    if current_line:
        lines.append(" ".join(current_line))
    
    # Draw title lines (bottom aligned)
    line_height = int(h * 0.055)
    start_y = title_y - (len(lines) - 1) * line_height
    
    for i, line in enumerate(lines):
        # Center align
        bbox = draw.textbbox((0, 0), line, font=title_font)
        line_w = bbox[2] - bbox[0]
        tx = (w - line_w) // 2
        ty = start_y + i * line_height
        
        # Shadow
        draw.text((tx + 1, ty + 1), line, font=title_font, fill=(0, 0, 0, 200))
        # Text
        draw.text((tx, ty), line, font=title_font, fill=(255, 255, 255, 255))

    # Save — default to assets/covers/NNN-cover.png (matching render.py lookup)
    if output_path is None:
        os.makedirs(OUTPUT_DIR, exist_ok=True)
        output_path = os.path.join(OUTPUT_DIR, f"{ep_number:03d}-cover.png")
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    img.save(output_path, "PNG")
    size = os.path.getsize(output_path)
    print(f"✅ Cover saved: {output_path} ({size:,} bytes)")
    return output_path


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python3 gen_cover.py <episode_number> '<title>' [output_path]")
        sys.exit(1)
    
    ep_num = int(sys.argv[1])
    ep_title = sys.argv[2]
    out_path = sys.argv[3] if len(sys.argv) > 3 else None
    
    generate_cover(ep_num, ep_title, out_path)
