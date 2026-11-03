# Lothel Eddie Site

Static site and Cloudflare Pages Functions project for Lothel Eddie.

## Project Structure

- `public/index.html`, `public/styles.css`, `public/script.js`: main site (everything under `public/` is served)
- `success.html`: Stripe return/confirmation page (noindex)
- `functions/api/create-donation-session.js`: creates Stripe Checkout session
- `functions/api/session-status.js`: verifies Stripe session status
- `public/assets/`: static images used by the site

## Local Development

```
npm install
npm run dev        # http://127.0.0.1:8788  (add ?edit=1 or visit /admin/)
```

`npm run dev` runs `wrangler pages dev` with local in-memory KV and R2 storage. `.dev.vars` (gitignored, never deployed) sets `DEV_EDITOR_EMAIL`, which signs you in as an editor on `localhost` only. Delete `.wrangler/state` to reset local drafts and uploads.

Only `public/` is served to the web. Source, `functions/`, `package.json` and secrets are never public.

## Content Management (Customer Editing)

Open `https://lotheleddie.org/admin/` to edit text and photos in place. Each text block shows **Edit**, each photo shows **Replace**; the bottom bar has **Save Draft**, **Publish**, **Restore Previous Version**, and section show/hide toggles. The page structure is never changed.

- `site-content.json`: shipped defaults (text, photos, section visibility). Published edits override it.
- `content.js`: applies content to elements marked `data-text`, `data-img`, `data-section`.
- `edit.js` / `edit.css`: editor, loaded only with `?edit=1`.
- `functions/api/content.js`, `functions/api/media/[[key]].js`: public read of published content and uploaded photos.
- `functions/api/admin/*`: draft, upload, publish/restore. Each verifies the Cloudflare Access JWT.

### One-time Cloudflare setup

1. **Storage (done):** KV namespace `lotheleddie-content` and R2 bucket `lothel-eddie-public` (photos live under the `img/` prefix). Both are bound in `wrangler.jsonc` as `CONTENT_KV` and `MEDIA_BUCKET`; with a Pages `wrangler.jsonc` those bindings apply to every Git deploy, and dashboard-set bindings and variables are ignored.
2. **Access:** Zero Trust > Access > Applications > Add self-hosted application for `lotheleddie.org` with paths `/admin/*` and `/api/admin/*`. Policy: Allow, Include > Emails (the approved editors). Login method: One-time PIN.
3. **Variables:** because `wrangler.jsonc` is the source of truth, add `ACCESS_TEAM_DOMAIN` (e.g. `yourteam.cloudflareaccess.com`) and `ACCESS_AUD` (the application's Audience tag) under `vars` in `wrangler.jsonc` and push. Without them every admin call is rejected.
4. Deploy, open `/admin/`, sign in with an allowed email.

Photos upload as JPEG (the browser converts JPG, PNG, WebP, GIF and BMP and resizes to 2000 px max).

## Deployment Target

- Platform: Cloudflare Pages + Pages Functions
- Wrangler config: `wrangler.jsonc` (`pages_build_output_dir: ./public`; set the Pages project's build output directory to `public`)
- Required secret: `STRIPE_SECRET_KEY`

## Canonical Host Strategy

Canonical host is apex domain:

- `https://lotheleddie.org/`

Use a permanent redirect from `www` to apex in Cloudflare.

### Cloudflare Redirect Rule

Expression:

```txt
(http.host eq "www.lotheleddie.org")
```

Destination URL:

```txt
https://lotheleddie.org${uri}
```

Status code:

- `301`

## Notes

- `robots.txt` points to `https://lotheleddie.org/sitemap.xml`.
- `sitemap.xml` contains only canonical crawlable page URLs.
