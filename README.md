# OPEN Northwest Website

Astro site for OPEN Northwest, migrated from WordPress and managed with Decap CMS.

## Local Development

- Install dependencies:

```bash
npm install
```

- Run the dev server:

```bash
npm run dev
```

## Content Structure

- Homepage: `src/content/pages/index.md`
- Pages: `src/content/pages/**/*.md`

## Link/Asset Check

```bash
npm run test:links
```

## Decap CMS

CMS lives at `/admin`.

### GitHub OAuth setup

Create a GitHub OAuth App at https://github.com/settings/developers

Use these values:
- Homepage URL: `https://opennorthwest.org` (or your `*.pages.dev` domain during setup)
- Authorization callback URL: `https://opennorthwest.org/api/callback`

Put the **Client ID** in `public/admin/config.yml`.

### Cloudflare Pages Functions (OAuth proxy)

We use Pages Functions to handle OAuth callbacks:
- `functions/api/auth.js`
- `functions/api/callback.js`

Set these in Cloudflare Pages environment variables:
- `GITHUB_CLIENT_ID`
- `GITHUB_CLIENT_SECRET`

## Deployment (Cloudflare Pages)

Suggested build settings:
- Build command: `npm run build`
- Output directory: `dist`

After deploying, visit:
- Site: `https://opennorthwest.org`
- CMS: `https://opennorthwest.org/admin`
