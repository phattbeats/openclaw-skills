---

title: Suno Channel Profiles
status: research
tags:
  - music
date: 2026-03-01
---

# Suno Channel Profiles

Reverse-engineer YouTube music channels to recreate their sound and aesthetic with Suno.

## Goal

Build a library of Suno prompt profiles for specific YouTube channels. Each profile contains core prompts, sub-vibe variants, thematic vocabulary, title/description templates, and notes on the channel's evolution.

## Profiles

| Channel | Handle | Vibe | Profile |
|---------|--------|------|---------|
| Pause,maybe? | @pause_maybe | 1940s noir jazz, masculine stoic, smoke & coffee | `skills/suno-profiles/pause_maybe.md` |
| Jazz & Co | @JazzAndCo | Modern smooth jazz, lofi chill, relaxed lounge | `skills/suno-profiles/jazz-and-co.md` |

## Workflow

1. Pull channel video list (browser or yt-dlp)
2. Sample 10–15 videos across Latest, Popular, and Oldest tabs
3. Extract titles, descriptions, tags, tracklist titles via yt-dlp --dump-json
4. Identify genre, instrumentation, mood, era, thematic vocabulary
5. Document channel evolution (style often shifts over time)
6. Write profile with core prompt + sub-vibe variants
7. Test prompts in Suno, log what worked

## Suno Notes

- No vocals = add "instrumental, no vocals" explicitly
- 3hr videos = generate 2–4 min segments, chain with Extend
- Vary lead instrument between segments to avoid loop feel
- Suno responds well to era + instrument + mood stacked together
- Test the core prompt first, then tune sub-vibes

---

# Jazz & Co

YouTube channel: https://www.youtube.com/channel/UCtg2c36ZH1gxpZuqu2dhGPQ

Reverse-engineered profile for recreating the channel's sound with Suno.

## Channel Info

- **Handle**: @JazzAndCo (inferred from channel name)
- **Genre**: Contemporary jazz, smooth jazz, lofi jazz
- **Vibe**: Relaxed, modern, accessible

## Profiles

**Core** · `pending`
```
modern jazz, smooth jazz, piano and saxophone, soft and warm, lofi aesthetic, chill, relaxed atmosphere, contemporary, instrumental, no vocals
```

**Late Night Lounge** · `pending`
```
smooth jazz, late night, piano and saxophone, warm bass, relaxed tempo, intimate lounge, cozy, chill vibes, instrumental, no vocals
```

**Coffee Shop Jazz** · `pending`
```
contemporary jazz, coffee shop atmosphere, piano, saxophone, upright bass, soft drums, relaxed and warm, afternoon chill, instrumental, no vocals
```

**Rainy Day Jazz** · `pending`
```
smooth jazz, rainy day, piano and saxophone, soft and melancholic, contemplative, warm, introspective, chill, instrumental, no vocals
```

**Sunday Morning** · `pending`
```
lofi jazz, Sunday morning, relaxed, piano and saxophone, soft, peaceful, warm, gentle, easy listening, instrumental, no vocals
```

**Drive Home** · `pending`
```
smooth jazz, evening drive, saxophone lead, piano, warm bass, relaxed tempo, nostalgic, cinematic, chill, instrumental, no vocals
```

**Study Session** · `pending`
```
lofi jazz, study music, focus, piano and saxophone, soft, minimal, ambient, chill, low tempo, instrumental, no vocals
```

**Bossa Nova Twist** · `pending`
```
bossa nova inspired jazz, modern smooth, piano and guitar, relaxed, tropical, warm, chill, instrumental, no vocals
```

## Notes

- Channel appears to focus on chill/relaxed contemporary jazz
- Piano + saxophone combo seems common
- Generally no vocals, instrumental focus
- Modern production quality
- Accessible, non-complex arrangements

---

# Pause,maybe? Prompts

**Core** · `pending`
```
1940s noir jazz, tenor saxophone lead, upright bass, brushed drums, slow tempo, smoky late night lounge, cinematic, melancholic, introspective, warm, instrumental, no vocals
```

**Smoke & Whiskey** · `pending`
```
retro noir jazz, 1940s, tenor saxophone, piano, upright bass, slow dark atmosphere, smoky bar, whiskey, dim lighting, brooding, melancholic, cinematic instrumental, no vocals
```

**Coffee & Quiet Morning** · `pending`
```
vintage jazz, 1940s, saxophone and piano, soft brushed drums, warm coffee shop morning, quiet and calm, nostalgic, gentle, introspective, instrumental, no vocals
```

**Late Night Solitude** · `pending`
```
1940s noir jazz, late night, saxophone, upright bass, sparse piano, empty room, silence, slow and restrained, cinematic, dark ambient jazz, instrumental, no vocals
```

**Stoic Gentleman** · `pending`
```
retro jazz, vintage 1940s, tenor saxophone, upright bass, brushed drums, slow deliberate tempo, masculine, dignified, cinematic noir, quiet strength, instrumental, no vocals
```

**Espresso/Retro Café** · `pending`
```
retro jazz, 1950s café, saxophone, piano, upright bass, medium slow tempo, warm afternoon, espresso bar, nostalgic, European lounge, instrumental, no vocals
```

**Rain & Window** · `pending`
```
1940s jazz, rain outside, saxophone and piano, slow, melancholic, intimate, candlelight, late night, cinematic noir, bittersweet, instrumental, no vocals
```

**Empty Bar at Closing** · `pending`
```
vintage noir jazz, 1940s, solo saxophone, sparse upright bass, brushed snare, empty late night bar, last call, solitude, fading, slow and heavy, cinematic, no vocals
```

**Fireplace & Bourbon** · `pending`
```
retro jazz, 1940s, tenor saxophone, piano, upright bass, fireplace warmth, bourbon, winter night, slow and warm, nostalgic, intimate lounge, instrumental, no vocals
```

**Driving Empty Streets** · `pending`
```
1940s noir jazz, saxophone, upright bass, brushed drums with subtle pulse, late night city drive, empty streets, headlights, cinematic, moody, moving but slow, instrumental, no vocals
```

**Vintage Recording** · `pending`
```
1940s jazz, vintage recording quality, lo-fi warmth, vinyl crackle, tenor saxophone, piano, old microphone texture, nostalgic, slow, cinematic noir, instrumental, no vocals
```
