import type { Config } from "@react-router/dev/config";

export default {
  // Every route loads its data in a `clientLoader` and no loader touches the
  // server, so the app is deployed as a static SPA on Vercel: `react-router
  // build` emits `build/client` (with `index.html`) and Vercel rewrites all
  // paths to it. Set this back to `true` to serve the app with
  // `react-router-serve` instead.
  ssr: false,
} satisfies Config;
