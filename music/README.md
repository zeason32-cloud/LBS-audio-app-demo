# Local Music Sources

Put playable audio files in this folder, then start the backend:

```bash
npm run music-server
```

Supported formats: `.mp3`, `.wav`, `.ogg`, `.m4a`, `.flac`, `.aac`, `.aiff`, `.webm`.

Filename format is optional. `Artist - Title.mp3` will be displayed as artist and title automatically.

Optional metadata overrides can be placed in `music/library.json`:

```json
{
  "Jay Chou - Track.mp3": {
    "title": "Track",
    "artist": "Jay Chou",
    "location": "图书馆北侧",
    "position": { "x": 42, "y": 58 },
    "duration": 215
  }
}
```
