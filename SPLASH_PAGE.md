# Splash Page Setup

This repository contains a splash page for `gluefactoryradio.com` that displays a "coming soon" message with an email signup form.

## Files

- `public/splash.html` - The splash page HTML
- `public/splash-logo.png` - The Glue Factory Radio logo

## Deployment Configuration

The `vercel.json` file is configured to:
- Serve the splash page (`splash.html`) when accessed via `gluefactoryradio.com`
- Serve the main React app for all other domains (including `radio.gluefactorymusic.com`)

## Setting up the Domain in Vercel

1. Go to your Vercel project settings
2. Navigate to "Domains"
3. Add `gluefactoryradio.com` as a domain
4. Configure DNS records as instructed by Vercel:
   - Add a CNAME record pointing to Vercel's domain
   - Or add A records if using apex domain

## How It Works

- When someone visits `gluefactoryradio.com`, Vercel's rewrite rule checks the host header
- If the host is `gluefactoryradio.com`, it serves `/splash.html`
- For all other domains, it serves the main React app (`/index.html`)

## Email List

The splash page is connected to MailChimp:
- List: `gluefactoryradio.us3.list-manage.com`
- Form action is configured in `splash.html`

