# SP Sequence Visuals

Personal portfolio for SP Sequence Visuals, owned by **spsequencevisuals**.

Website: https://spsequencevisuals.github.io/

## Publish and update

The GitHub Pages workflow exports the portfolio when changes are pushed to `main`.
Repository Settings → Pages uses **GitHub Actions**.

Build the static site locally with Node 24:

```sh
node scripts/export-github-pages.mjs --origin https://spsequencevisuals.github.io --base / --out out
```

Edit the portfolio catalogue in `lib/portfolio-defaults.mjs` (with the original artwork collections in `lib/design-projects.mjs`), add assets under
`public/assets`, and commit updates to `main`. See `hosting/GITHUB-PAGES-SETUP.md`.
Long lesson media is stored in chunks; the exporter verifies and restores the
complete videos automatically.

## Hosting scope

The static copy contains all 43 portfolio projects, exclusive scroll/hover video
previews, full project links, light/dark themes, and Web3Forms email enquiries.
Private owner upload tools, the order database and social publishing need a
separately hosted backend. No private enquiry records or environment credentials
are included. The old company hosting identity is intentionally excluded.

Media here are website exports. Original-quality uploads and editable video/design
projects are not included. Keep the personal Google Drive backup as well.

## Independent personal owner studio

The GitHub portfolio now includes an owner-entry route and live portfolio/profile support. `hosting/owner-service` contains a separate Cloudflare Worker with GitHub owner sign-in, private chunked uploads up to 500 MB and the existing protected social composer. It requires deployment in the owner’s personal Cloudflare account and a Buffer connection before it is active. See `hosting/OWNER-STUDIO-SETUP.md` for the exact setup and verification steps. This does not transfer or depend on the old company-owned Site.
