# GF Bible 1.3.23 (37): original data compatibility

Based on 1.3.22 c54cdfc; preserves existing reader, Psalm and sync changes.
- Retains real suffix Strong codes and full definitions up to 200,000 characters.
- Merges Korean/English definitions by language with explicit same-language conflict detection.
- Imports original books and code maps as three separate offline translations.
- Uses a scrollable dictionary with language buttons instead of OS alerts.
- Writes individual private file parts and commits a small manifest only after successful validation/writes. Preserves prior import on failure and reads old v1 snapshots.
- Includes offline SQLite converter code; no user scripture or dictionary corpus is committed to GitHub or bundled in the app.

Local verification: 20 regression/unit tests, JSX parser, full provided corpus import/reload (93,277 verse maps and 14,837 dictionary codes). Native chooser/font/memory checks remain device-dependent. Store-version metadata must only change after confirmed publication. Store submission is not included in this commit.
