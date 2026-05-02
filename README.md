# Car-cost-calculator

Dutch monthly car-cost calculator (BV vs. private, EV vs. petrol/hybrid). Built with React + Vite.

## Local development

```bash
npm install
npm run dev
```

## Production build

```bash
npm run build
npm run preview
```

## GitHub Pages deployment

This repo includes a workflow at `.github/workflows/deploy.yml` that builds the
site and publishes it to GitHub Pages on every push to `main`.

One-time setup in the GitHub UI:

1. Go to **Settings → Pages**.
2. Under **Build and deployment → Source**, select **GitHub Actions**.

After that, every push to `main` will deploy to:

```
https://<your-username>.github.io/Car-cost-calculator/
```

The base path is configured in `vite.config.js` (`base: "/Car-cost-calculator/"`).
If you rename the repo, update that value to match.
