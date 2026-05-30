# 🎮 Minecraft Portfolio

> A pixel-perfect Minecraft-themed personal portfolio + browser-based no-code editor.
> Pure HTML, CSS, and JavaScript. Zero frameworks. Zero backend. Deploy free on GitHub Pages in under 5 minutes.

[![MIT License](https://img.shields.io/badge/License-MIT-green.svg)](./LICENSE)
[![GitHub Pages](https://img.shields.io/badge/GitHub%20Pages-Ready-blue)](https://rafie-kun.github.io)
[![No frameworks](https://img.shields.io/badge/No%20frameworks-Yes-brightgreen)](#tech-stack)
[![Open Source](https://img.shields.io/badge/Open%20Source-Yes-orange)](#contributing)
[![Made with HTML/CSS/JS](https://img.shields.io/badge/Made%20with-HTML%20%7C%20CSS%20%7C%20JS-yellow)](#tech-stack)

## Live Demo

https://rafie-kun.github.io

## Screenshots

- Portfolio: [assets/preview.png](./assets/preview.png)
- Editor: [assets/editor-preview.png](./assets/editor-preview.png)

## What is this?

This is a fully Minecraft-themed portfolio site with a built-in browser editor.
There is no terminal workflow, no npm, and no build tools. You upload the two HTML files to GitHub, enable GitHub Pages, and the site is live.

The visual style is intentionally pixel-art inspired: `Press Start 2P` for headers and labels, `VT323` for body text, a grass/dirt/stone palette, an animated hero terrain, floating clouds, and a bobbing creeper that keeps the whole experience feeling like a tiny playable world.

## Features

### Portfolio (`index.html`)

- Animated Minecraft hero scene with sky, sun, clouds, pixel terrain, trees, and creeper
- Player Card with name, role, level, location, and health bar
- About Me section with stat cards
- Work Experience timeline with current and past jobs plus badges
- Skills/Inventory grid with 5 rarity tiers: Common, Uncommon, Rare, Epic, Legendary
- Projects/Builds section with a "Coming Soon" chunk-loading overlay
- Achievements system with unlocked gold and locked greyed out states
- GitHub profile section
- Contact section with email, Discord, phone, LinkedIn, and custom link
- Pixel particle effects on click
- Sticky Minecraft-styled nav
- Fully responsive layout
- Profile photo support embedded as base64

### Editor (`editor.html`)

- Full visual editor for every section of the portfolio
- Edit name, role, age, level, location, bio, and GitHub username
- Upload profile photo embedded directly with no external hosting needed
- Add, remove, and edit Work Experience entries for current and past jobs
- Add, remove, and edit Skills with emoji, name, and rarity tier
- Add, remove, and edit Projects with emoji, name, description, link, tags, and status
- Add, remove, and edit Achievements with unlocked or locked states
- Edit all contact info including email, Discord, phone, LinkedIn, and custom link
- GitHub token authentication stored in `localStorage` and never sent anywhere except GitHub API requests
- One-click publish to GitHub Pages via the GitHub REST API
- Download `index.html` locally as a backup
- Same Minecraft pixel theme as the portfolio

## File Hosting & Images

All images, including the profile photo, are embedded as base64 inside the HTML.

For larger project images or extra media, use one of these options:

- Cloudflare Pages, a free fast CDN, to upload images and link them directly
- GitHub itself by uploading images to an `/assets` folder and referencing them as `https://raw.githubusercontent.com/Rafie-kun/Rafie-kun.github.io/main/assets/image.png`
- imgbb.com for free image hosting with a direct image link

Future versions will support uploading images directly to the GitHub repo from inside the editor.

## Getting Started

1. Fork this repo or click **Use this template**.
2. Rename the repo to `yourusername.github.io`.
3. Go to **Settings → Pages → Deploy from main branch**.
4. Open `editor.html` in your browser, either by opening the file locally or by visiting `yourusername.github.io/editor.html`.
5. Generate a GitHub Personal Access Token:
   - GitHub → Settings → Developer Settings → Personal Access Tokens → Tokens (classic)
   - Note: `portfolio-editor`
   - Expiration: `No expiration`
   - Scope: tick ONLY `repo` and nothing else
   - Copy the `ghp_...` token
6. Paste the token in the editor and hit **TEST**.
7. Fill in all your info, upload a photo, and add your projects.
8. Hit **PUBLISH** and your site goes live in about 30 seconds at `yourusername.github.io`.

## GitHub Token Safety

- Your token is stored only in your browser's `localStorage`
- It is sent ONLY to `api.github.com` and nowhere else
- Never share your token in a chat, email, or public place
- If you accidentally expose it, go to GitHub → Settings → Developer Settings, delete it immediately, and generate a new one
- The editor only needs the `repo` scope, so do not grant more permissions than that

## Customization Guide

Everything is customizable through the editor, so no code is needed.

- Profile photo, with any image you want
- Name, role, age, location, and bio
- Work history, with as many jobs as you want and current/past status
- Skills, with any skill, emoji, and rarity from Common to Legendary
- Projects, with GitHub links, live links, tags, and coming soon status
- Achievements, with each one unlocked or locked
- All contact links

For advanced users who want to edit the HTML directly, all data is stored in clearly labeled JavaScript variables at the top of `editor.html`.

## Roadmap

- [ ] Multiple Minecraft themes (Nether, The End, Ocean Monument, Mesa Biome)
- [ ] Animated pixel player character that walks across the screen
- [ ] Pixel cursor (Minecraft pickaxe or sword)
- [ ] Minecraft ambient sounds toggle (cave sounds, music disc)
- [ ] Easter egg: Konami code triggers TNT explosion animation
- [ ] Blog/devlog section
- [ ] Visitor counter (free API like countapi.xyz)
- [ ] PWA support, installable as mobile app
- [ ] Export portfolio as PDF
- [ ] Preview mode inside editor before publishing
- [ ] Auto-save drafts to localStorage
- [ ] Upload project images directly to GitHub repo from inside editor
- [ ] Multi-language support (EN, Bengali, etc.)
- [ ] Testimonials/references section
- [ ] Animated skill XP bars
- [ ] Day/night cycle on hero section based on real time
- [ ] Integration with GitHub API to auto-pull repos as projects

## Tech Stack

- HTML5
- CSS3 with custom properties, keyframe animations, and pixel art techniques
- Vanilla JavaScript (ES6+)
- GitHub REST API v3 for publishing
- Google Fonts: `Press Start 2P`, `VT323`
- Hosted on GitHub Pages for free
- Optional image CDN: Cloudflare Pages, GitHub raw, or imgbb

## What Not to Do

- Do not run `npm install` or any build tool, because there is none
- Do not convert this to React, Vue, Next.js, or any framework
- Do not add a backend or database
- Do not use a bundler such as webpack, Vite, or Parcel
- Do not modify `index.html` manually if you can avoid it, use the editor
- Do not grant your GitHub token more than `repo` scope
- Do not share your GitHub token with anyone
- Do not host `editor.html` publicly if you want to keep it private; it works fine opened as a local file in your browser too

## Contributing

Contributions are welcome. Please keep the Minecraft theme, avoid frameworks, and keep the project build-tool free.

Open an issue first before making big changes.

## License

MIT — Hossain Fazle Rafie 2025
