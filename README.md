# PPC Summit 2026 · stage bundles (hosted copy)

This repo is generated. Don't edit it by hand.

- **Source:** `business/ppc-summit/programming/stage/` in the OS repo. There, run `node build.mjs --zip`, then `node publish.mjs`.
- **Deploy:** Vercel project `ppc-summit-stage` deploys every push to `main`.
- **Access:** every path is behind Basic Auth (`middleware.js`) and nothing is indexed. Any username works; the password is known to the team.
- **Offline use:** AV uses the zip from `programming/stage/release/`. See `AV-README.md`.
