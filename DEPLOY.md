# Deploy

The app is a static-leaning Next.js build with exactly one server route
(`/api/ai`). That makes it cheap to host and portable between providers.

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
3. Set the same environment variables under Settings, Environment variables.
4. Under Settings, Functions, set the compatibility flag `nodejs_compat`.

The one constraint this imposes on the code: `/api/ai` must stay compatible with
the edge runtime, meaning `fetch` only and no Node-native modules. The provider
adapters are written that way already, so this stays a five-minute switch rather
than a rewrite.

## Environment variables

| Name                       | Required | Where  | Notes                                                                                                |
| -------------------------- | -------- | ------ | ---------------------------------------------------------------------------------------------------- |
| `AI_PROVIDER`              | no       | server | `gemini` (default), `groq`, `cloudflare`                                                             |
| `GEMINI_API_KEY`           | no       | server | Free from [AI Studio](https://aistudio.google.com/apikey). Omit it and the assistant runs BYOK-only. |
| `AI_MAX_OUTPUT_TOKENS`     | no       | server | Default 1024. Hard ceiling per request.                                                              |
| `AI_RATE_LIMIT_PER_MINUTE` | no       | server | Default 8, per IP.                                                                                   |
| `AI_DAILY_TOKEN_BUDGET`    | no       | server | Shared-key tokens per UTC day before BYOK-only kicks in.                                             |
| `NEXT_PUBLIC_BYOK_ONLY`    | no       | client | `true` disables the shared key entirely.                                                             |

None of these are needed for tools 1-8. The app builds and runs with an empty
environment.

**The shared key must never appear in client code.** Only variables prefixed
`NEXT_PUBLIC_` are exposed to the browser, and `GEMINI_API_KEY` deliberately is
not one of them. `.env.local` is gitignored; `.env.example` is the committed
template and holds no real values.

## Custom domain

Optional and not required for launch, since `student-toolkit.vercel.app` is a
fine address. If a domain is added later: Vercel project, Settings, Domains, add
the name, then point a `CNAME` for `www` at `cname.vercel-dns.com` and the apex
`A` record at `76.76.21.21`. Vercel issues the TLS certificate automatically.
Note that domain registration is the one thing in this project that costs money,
so it stays optional.
