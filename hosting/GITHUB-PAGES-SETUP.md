# SP Sequence Visuals — personal hosting and backup

Use a GitHub account you personally control, registered with spsequencevisuals@gmail.com. Your website management will then be independent of the company’s ChatGPT account. Free GitHub Pages hosting requires a public repository. Do not upload private client briefs, passwords, environment files, or the order database.

## Publish the supplied ready-to-host website

1. Create a public repository named exactly YOUR-USERNAME.github.io, replacing YOUR-USERNAME with your actual GitHub username. This gives the simplest root-level website address.
2. Extract SP-Sequence-Visuals-GitHub-Pages.zip. Add the CONTENTS of its website folder to the repository root, so index.html is at the root. Upload folders using GitHub Desktop if the browser rejects large videos. Do not upload the ZIP itself as the website.
3. In repository Settings → Pages, select Deploy from a branch, main, /(root), then Save.
4. Open the URL GitHub displays after the deployment succeeds. Verify the project links, landscape/portrait/timeline controls, mobile playback, and contact form. Send a real brief yourself and verify that it arrives in your brand Gmail inbox. If your Web3Forms account restricts allowed domains, add the new GitHub Pages domain there.

All video files in this prepared website are below GitHub’s 100 MiB per-file limit. GitHub’s browser uploader has a separate 25 MiB per-file limit, so GitHub Desktop is the practical upload method for this video portfolio. The website is below the 1 GB published-site limit. Free quotas are provider policies, not a lifetime hosting guarantee.

## Publish from the complete developer source instead

The source includes `.github/workflows/github-pages.yml`. Push the source using GitHub Desktop or Git. In Settings → Pages, select GitHub Actions. The workflow builds a static portfolio on each push to main. It handles both a root user site and a repository subpath. No npm install is needed for this static export; Node 24 is used.

For a local export:

```sh
node scripts/export-github-pages.mjs --origin https://YOUR-USERNAME.github.io --base / --out out
```

For a project repository use `--base /REPOSITORY/`. Upload the resulting `out` contents or let the included workflow deploy them.

## Features in the GitHub Pages copy

- All twenty portfolio projects, including Black Friday as one project with a 16:9 advert, a 4:5 portrait advert and a 9:16 timeline reveal.
- Existing brand/logo and covers. The rejected thumbnail experiments are not installed.
- Desktop hover previews, mobile in-view previews, exclusive video playback, full project/review links, and the long-form preview rule.
- Device light/dark theme and installable portfolio shell.
- Service and session enquiries submitted directly through the owner’s existing Web3Forms identifier to the brand mailbox, with a prefilled email-app alternative. The form reports provider acceptance; it does not claim verified inbox delivery.

GitHub Pages does not run the private studio, R2 uploader, order database/inbox, ChatGPT sign-in or social release service. Those links are removed from the static copy. Existing order records and private uploaded assets are not exported by this package. The public portfolio currently uses the bundled assets included here. Add/edit future work in the source and redeploy, or later move the full application to your own backend hosting with a new independent authentication setup. Never expose the current trusted-header owner authentication directly on another host.

## Protect your work

Keep two copies: your own Google Drive and a local/external disk. GitHub is for the website/source and must not be your only archive of original video exports. All media available in this repository and the personal Drive backup are website exports. They are optimized copies, not editable Premiere/After Effects projects or recovered full-quality original uploads. The two educational lessons are included in full; their grid previews are separate.

The current company-owned ChatGPT hosting remains separate. Publishing this copy does not transfer ownership of the old Site or its address. Use the new GitHub URL once verified. Set up your own GitHub/Google recovery details and two-factor authentication.

Official references checked 12 November 2026:

- https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages
- https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits
- https://docs.github.com/en/repositories/working-with-files/managing-large-files/about-large-files-on-github
