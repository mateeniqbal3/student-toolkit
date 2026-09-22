# Deploy

The app is a Next.js build with no server routes at all: every page is static
and every tool runs in the browser. That makes it free to host and portable
between providers.

## Vercel (primary)

1. Sign up at [vercel.com](https://vercel.com) with **Continue with GitHub**.
   The Hobby plan is free and does not ask for a card.
2. **Add New, then Project**, and import `mateeniqbal3/student-toolkit`.
3. Framework preset is detected as Next.js. Leave the build settings alone:
   build `npm run build`, output `.next`, install `npm ci`.
4. Add environment variables (Settings, Environment Variables) for Production
   and Preview both. See the table below.
5. Deploy. Every push to `main` ships to production; every pull request gets its
   own preview URL.

Enable **Web Analytics** under the project's Analytics tab. It is free, uses no
cookies, and therefore needs no consent banner.

## Cloudflare Pages (fallback)

Kept as a drop-in alternative so a Vercel policy change can never strand the
project.

1. Cloudflare dashboard, then Workers and Pages, Create, Pages, Connect to Git.
2. Build command `npx @cloudflare/next-on-pages@1`, output directory
   `.vercel/output/static`, Node version `22`.
3. There is nothing to set under Settings, Environment variables.

With no server route left in the project, this is a plain static deployment
wherever it goes.

## Environment variables

There are none. Every tool runs in the browser, and the AI assistant uses the
student's own Gemini key, kept in their browser and sent straight to Google.
The app builds and runs with an empty environment, in development and in
production alike.

That is also what keeps the hosting bill at zero: there is no server to run,
no key of ours to protect, and no quota of ours to exhaust.

## Custom domain

Optional and not required for launch, since `student-toolkit.vercel.app` is a
fine address. If a domain is added later: Vercel project, Settings, Domains, add
the name, then point a `CNAME` for `www` at `cname.vercel-dns.com` and the apex
`A` record at `76.76.21.21`. Vercel issues the TLS certificate automatically.
Note that domain registration is the one thing in this project that costs money,
so it stays optional.
