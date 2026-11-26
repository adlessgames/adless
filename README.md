# Adless Games (Reborn) - Cloudflare Pages

## Deploy (about 5 minutes)
1. Cloudflare dashboard > Workers & Pages > Create > Pages > Upload assets. Name it and drag in THIS whole folder (keep `_worker.js` inside). Deploy.
2. Make storage: Workers & Pages > KV > Create namespace (call it `adless`).
3. Open your Pages project > Settings > Bindings > Add > KV namespace. Variable name must be exactly `SITE`; pick the namespace from step 2.
4. Same page: Settings > Variables and Secrets > Add > Type "Secret", name `ADMIN_PASSWORD`, value = the password you want.
5. Deployments > redeploy (or upload the folder again) so the new settings take effect.
6. Go to https://YOURNAME.pages.dev/admin and log in.

## Using the editor (/admin)
- Games & more: edit any game/app/movie, paste its link, add a picture, pick genres. "Only show ones with no link yet" shows what still needs a link.
- Bulk add links: paste lines like `Slope 2 | https://...` to fill many at once.
- Pictures: upload; pick them when editing a game.
- Press Save (top). Changes go live instantly.

## Many mirrors from one GitHub repo
1. Push this folder to one GitHub repo.
2. For each mirror: Cloudflare > Workers & Pages > Create > Pages > Connect to Git > pick the repo. Build command: leave empty. Output directory: `/`.
3. On EVERY project add the same KV binding `SITE` (same namespace) and the same `ADMIN_PASSWORD` secret. Then one save in /admin updates all mirrors.
4. Pushing to GitHub redeploys all mirrors.
