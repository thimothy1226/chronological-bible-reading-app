# GF Bible next build commands

After final ZIP contents are applied to the branch, run:

```bash
npm install
npm run final:check
```

Then GitHub Actions:

1. Actions
2. Build GF Bible Android APK
3. Run workflow
4. Branch: gf-bible-v1.3.0-final-source
5. Download artifact: GF-Bible-v1.3.0.apk

Firebase server changes:

```bash
firebase deploy --only functions,firestore:rules
```
