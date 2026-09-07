# GF Bible GitHub upload status

This file records the current upload stage.

- Branch: gf-bible-v1.3.0-final-source
- Current stage: branch prepared, final package waiting for full source application
- Final package name: GF-Bible-work012-final-handoff.zip
- Target app version: 1.3.0
- Target Android versionCode: 14

## Checks completed locally before handoff

- npm run validate
- npm run audit
- npm run release:info
- node --check functions/index.js
- ZIP integrity check

## Remaining before APK build

The final package contents need to be applied to the branch, then the APK build workflow can be run.
