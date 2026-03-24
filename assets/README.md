# NoScroll Extension Icons

## Current setup

- `icon.png` – Source logo (place your NS logo here)
- `icon16.png`, `icon32.png`, `icon48.png`, `icon128.png` – Resized versions for Chrome

## Regenerating icons

If you update `icon.png`, run from the project root:

```bash
npm run generate-icons
```

This creates resized PNGs (16, 32, 48, 128) from `icon.png` using the same image, only resized (no cropping).

## Requirements

- Dark background for toolbar visibility
- Centered and readable at 16×16
