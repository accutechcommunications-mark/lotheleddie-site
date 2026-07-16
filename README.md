# Lothel Eddie Site

Static site and Cloudflare Pages Functions project for Lothel Eddie.

## Project Structure

- `index.html`, `styles.css`, `script.js`: main site
- `success.html`: Stripe return/confirmation page (noindex)
- `functions/api/create-donation-session.js`: creates Stripe Checkout session
- `functions/api/session-status.js`: verifies Stripe session status
- `assets/`: static images used by the site

## Deployment Target

- Platform: Cloudflare Pages + Pages Functions
- Wrangler config: `wrangler.jsonc`
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
