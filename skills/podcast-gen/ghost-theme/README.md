# Ghost Podcast Theme Overlay

These files add a proper podcast RSS feed to your Ghost theme.

## Files

- `routes.yaml` — Adds `/podcast/` collection and `/podcast/rss/` custom route
- `templates/podcast/rss.hbs` — Podcast-optimized RSS template (iTunes compatible)

## Installation

1. Download your active theme from Ghost Admin → Design
2. Extract the theme folder
3. Copy `routes.yaml` into the theme root (overwrite or merge with existing)
4. Copy the entire `templates/podcast/` folder into the theme's `templates/` directory
5. Zip the theme folder and upload via Ghost Admin → Design → Upload theme
6. Activate the theme (or re-activate if already active)

## Post Setup

For each episode post:
- Tag: `podcast`
- Audio URL: paste the MP3 file URL into **Post settings → Advanced → Facebook Description** (this populates `{{og_description}}` in the template)
- Duration (optional): put `HH:MM` in **Meta description** field for `<itunes:duration>`
- Featured image: set as usual

The RSS feed will be available at: `https://phattmedia.club/podcast/rss/`

## Notes

- Test feed validation: https://castfeedvalidator.com/
- iTunes category can be changed in `rss.hbs` under `<itunes:category>`
