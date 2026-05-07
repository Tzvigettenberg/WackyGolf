# Wacky Golf

Mobile-first 3D golf roguelike. Three.js + Vite, runs in iOS Safari and Chrome Android.

See [GDD.md](./GDD.md) for design and [BUILDPLAN.md](./BUILDPLAN.md) for the build plan.

## Run locally

```bash
npm install
npm run dev
```

Vite serves on `http://localhost:5173`. To test from your phone on the same Wi-Fi, look for the **Network** URL Vite prints (something like `http://192.168.x.x:5173/`) and open that on your phone.

## Build

```bash
npm run build      # outputs to dist/
npm run preview    # serves dist/ locally for a final smoke test
```

## Deploy

Auto-deploys to GitHub Pages on every push to `main` via `.github/workflows/deploy.yml`.

After your first push, in the repo go to **Settings → Pages** and set **Source** to **GitHub Actions**.

URL will be: `https://<your-username>.github.io/wackygolf/`
