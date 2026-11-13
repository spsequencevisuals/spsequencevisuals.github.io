# SP Sequence Visuals — personal owner studio

Implementation status: code and local checks are ready. The personal backend must be deployed and connected before uploads or social publishing work on the live GitHub site.

The public portfolio stays at https://spsequencevisuals.github.io/. Its owner link opens an independently hosted studio. GitHub Pages serves the portfolio; your own Cloudflare Worker handles sign-in, private uploads, portfolio records and Buffer publishing. No ChatGPT account is required to manage the studio.

## 1. Personal hosting

Use a Cloudflare account that you personally control, preferably with spsequencevisuals@gmail.com. R2 requires activation through Cloudflare's checkout; it includes monthly free usage but is billed for usage beyond the included allowances. Review the checkout yourself before accepting it. No subscription or purchase has been made by this code.

From hosting/owner-service, install the pinned Wrangler development dependency and sign in:

    npm install
    npx wrangler login
    npx wrangler d1 create sp-sequence-studio
    npx wrangler r2 bucket create sp-sequence-private-media

Copy the returned D1 database ID into wrangler.jsonc. Keep the R2 bucket private; do not enable a public bucket URL. Apply the included migration:

    node prepare.mjs
    npx wrangler d1 migrations apply sp-sequence-studio --remote

## 2. Owner identity

Create a dedicated GitHub OAuth app in your own GitHub account. It is for public identity verification only, with no repository scopes.

First deploy the locked service to obtain its actual address:

    npx wrangler deploy

Use the returned HTTPS address as the OAuth homepage; use that exact origin followed by /auth/callback as its authorization callback.

Set GITHUB_CLIENT_ID in wrangler.jsonc. Keep OWNER_GITHUB_LOGIN as spsequencevisuals and OWNER_GITHUB_ID as 355808109, the verified immutable public account ID. The server requires both. Set these secrets using Wrangler or Cloudflare's secret settings:

    npx wrangler secret put GITHUB_CLIENT_SECRET
    npx wrangler secret put SESSION_SECRET

Generate SESSION_SECRET locally using a cryptographically random value of at least 32 characters. Do not commit secrets, put them in website JavaScript, or send them in chat. Deploy again after setting the public client ID.

GitHub verification tokens are not retained or delivered to the browser. Owner sessions use signed Secure, HttpOnly cookies and expire after eight hours. Client-supplied identity headers do not grant access.

## 3. Connect the public portfolio

From the repository root:

    node scripts/configure-owner-studio.mjs https://THE-EXACT-DEPLOYED-STUDIO-ADDRESS

Commit the resulting hosting/studio-config.json with the implementation. The existing GitHub Pages workflow republishes it. Published owner records and profile links then load from the studio automatically. New and edited project/review links open the studio's public project pages; private drafts require the owner session.

Verify sign-in with your GitHub account, rejection of another account, a private upload, a new draft, publication on the portfolio, archived project removal, direct full-video playback, review links and profile updates.

The portfolio enquiry form keeps its existing Web3Forms delivery to spsequencevisuals@gmail.com. The owner studio links to Gmail; it does not claim to contain or import those email enquiries.

## 4. Social publishing

Create or use a personal Buffer account. Connect the exact Facebook Page, Instagram, LinkedIn, X and TikTok accounts you want available. Your Buffer plan controls the number of connected channels. Behance and WhatsApp are profile/contact links, not automatic publishing destinations in this composer.

Add your personal Buffer API key only as a Worker secret:

    npx wrangler secret put BUFFER_API_KEY

BUFFER_ORGANIZATION_ID is optional. If your Buffer account has several organizations, choose the correct one in the studio.

Select a published video project, write the caption, choose the exact connected accounts and review the release. Buffer needs a direct public media URL. A private uploaded file must first be used in a published project, or you can provide a public video URL. Facebook, Instagram, LinkedIn and X receive publishing requests. TikTok is saved as a draft so you can finish privacy/commercial disclosures in Buffer or TikTok. No test has posted to real social accounts.

Each account's outcome is shown separately. Provider acceptance or a draft is not reported as publication. Concurrent and repeated submissions cannot resend an already claimed release; uncertain network results must be checked in Buffer rather than retried as another release.

## Uploads and storage

MP4, WebM, JPEG, PNG and WebP are accepted. The new uploader supports up to 500,000,000 bytes per file in 8 MiB chunks, validates actual signatures, checks the completed file length and keeps new uploads private. An interrupted final response can be recovered without duplicating the completed media record.

The application has an 8 GB media admission budget and at most five active uploads. This is not a provider billing cap. Incomplete R2 multipart uploads should retain Cloudflare's automatic expiration. Monitor your own account's usage and configure provider alerts.

## Development and checks

    npm test --prefix hosting/owner-service
    node --test tests/portable-portfolio.test.mjs tests/video-playback.test.mjs tests/order-email.test.mjs tests/studio.test.mjs
    node scripts/export-github-pages.mjs --origin https://spsequencevisuals.github.io --base / --out out

prepare.mjs compiles the existing validated studio modules into an independent Worker bundle. It replaces the old platform identity module with a request-local verified GitHub identity; the old trusted-header authentication is never used by this deployment. Generated assets and modules contain no credentials and are rebuilt before deployment.

preview.mjs is only a local UI demonstration with in-memory fixture data and a visible preview banner. Wrangler's production entry is worker.mjs; the preview server and its test identity are not part of the deployed Worker.

Official references:

- https://developers.cloudflare.com/r2/get-started/
- https://developers.cloudflare.com/r2/pricing/
- https://developers.cloudflare.com/r2/api/workers/workers-multipart-usage/
- https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps
- https://developers.buffer.com/examples/create-video-post.html
- https://developers.buffer.com/examples/create-draft-post.html

