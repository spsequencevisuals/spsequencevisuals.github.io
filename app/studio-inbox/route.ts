import html from "../../site/inbox.html?raw";
import { getChatGPTUser, chatGPTSignInPath, chatGPTSignOutPath } from "../chatgpt-auth";
import { isOwner, BRAND_STUDIO_EMAIL } from "../../lib/request-data.mjs";

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await getChatGPTUser();
  const headers = { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" };
  if (!user || !isOwner(user)) {
    const title = user ? "Use your studio account." : "Your studio, behind the scenes.";
    const detail = "Sign in with an approved SPSequence Visuals account to review service orders and session requests. Client details stay private.";
    return new Response(`<!doctype html><html lang="en"><head><meta name="color-scheme" content="dark"><meta name="theme-color" content="#0c0d0f"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Studio inbox · SPSequence Visuals</title><link rel="stylesheet" href="/inbox.css"></head><body class="studio-auth"><main class="auth-card"><a href="/"><img class="inbox-logo" src="/assets/sp-sequence-logo.png" alt="SPSequence Visuals"></a><p class="eyebrow">PRIVATE STUDIO INBOX</p><h1>${title}</h1><p>${detail}</p><p class="auth-account">Brand account<br><strong>${BRAND_STUDIO_EMAIL}</strong></p><p>Use the ChatGPT account registered with this email. Your approved backup account also works.</p><a class="button" href="${chatGPTSignInPath('/studio-inbox')}" target="_top">Sign in with ChatGPT ↗</a>${user?`<a class="back-link" href="${chatGPTSignOutPath('/studio-inbox')}" target="_top">Sign out of this account ↗</a>`:''}<p class="auth-help">If another account opens automatically, use a private browser window to sign in with your brand account.</p><a class="back-link" href="/">← Back to portfolio</a></main></body></html>`, { status: user ? 403 : 200, headers });
  }
  return new Response(html, { headers });
}
