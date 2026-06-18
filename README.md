# Pawse 🐾

A calm little corner of the internet where you give your dog a treat.

No score. No levels. No timers nagging you. Just a sitting Labrador, your dog's
name, and as many treats as you feel like giving. **Pawse** is a play on *paws* +
*pause* — it's meant to be a tiny break in your day.

## Features

- **Name your dog** on the first screen, so it feels like *yours*.
- A blocky **Minecraft-style Labrador** sitting in a little pixel world — drifting
  clouds, a pixel sun, and grass + dirt blocks — rendered on a tiny canvas and
  upscaled crisp (nearest-neighbour). No image files for the dog at all.
- **Animated:** the dog breathes, blinks, twitches its ears and wags its tail,
  and does a happy hop with its tongue out (plus floating Minecraft hearts) every
  time you give it a treat.
- Treats are **instant** — give your dog as many as you like, whenever you like.
- Full **Minecraft GUI look** — pixel font, beveled stone buttons and panels, and
  the classic darkened dirt menu background.
- Everything is saved in your browser (`localStorage`) — your dog and treat
  count are waiting when you come back.
- Soft sound effects you can mute, and a little options menu to rename or start
  fresh.
- 100% static + offline-friendly (the pixel font is vendored locally).
  **No backend, no database, no tracking, no CDN calls.**

## Run it locally

It's a handful of static files (`index.html`, `style.css`, `script.js`,
`pixeldog.js`, and the `fonts/` folder). Any static server works:

```bash
# Python (already on most machines)
python3 -m http.server 8080

# or Node
npx serve .
```

Then open <http://localhost:8080>.

## Host it on your VPS

Because everyone gets their *own* dog (saved in their own browser), you can host
one copy and any number of people can run their own version. Pick whichever fits
your setup:

### Option A — Docker (easiest)

```bash
docker compose up -d --build
# now serving on http://your-vps-ip:8080
```

### Option B — Plain nginx / Apache

Copy `index.html`, `style.css`, and `script.js` into your web root
(e.g. `/var/www/pawse`) and point a server block at it:

```nginx
server {
    listen 80;
    server_name pawse.example.com;
    root /var/www/pawse;
    index index.html;
}
```

### Option C — Anything that serves static files

Caddy, Netlify, GitHub Pages, an S3 bucket — drop the three files in and you're
done.

### Add a domain + HTTPS

Put a reverse proxy in front. With **Caddy** it's a one-liner that also handles
the TLS certificate for you:

```caddy
pawse.example.com {
    reverse_proxy localhost:8080
}
```

## Make it your own

- **Dog & world colors:** edit the `C` palette at the top of `pixeldog.js`
  (try a chocolate or black Lab by changing `fur` / `furLt` / `furSh`).
- **What your dog says:** edit `IDLE_LINES` and `FED_LINES` in `script.js`.

## License

Do whatever you like with it. Go pet some dogs. 🐶
