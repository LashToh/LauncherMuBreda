# Launcher update manifest

The launcher checks:

```http
GET https://api.mubreda.net/api/launcher/manifest
```

Expected JSON (CMS-style envelope supported):

```json
{
  "success": true,
  "data": {
    "version": "1.0.1",
    "mandatory": false,
    "changelog": "Balance patch + bugfixes",
    "files": [
      {
        "path": "Data/Local/some.file",
        "url": "https://api.mubreda.net/patches/1.0.1/some.file",
        "sha256": "hex-digest",
        "size": 12345
      }
    ]
  }
}
```

## Rules

- Updates **client files only** (not the launcher executable in v1).
- `path` is relative to the game root (folder with `main.exe`).
- If the API is unreachable, the launcher **still allows Play**.
- Local version is stored at `Data/Launcher/version.json`.

## Related public endpoints already used

- `GET /api/server` — status / rates
- `GET /api/news` — news list
