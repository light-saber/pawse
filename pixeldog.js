/* Pawse — a tiny Minecraft-style scene with a blocky Labrador.
   Everything is drawn into a 128x112 pixel buffer and upscaled crisp
   (image-rendering: pixelated). Exposes window.PawseDog = { start, feed }. */
(() => {
  "use strict";

  const W = 128, H = 112;
  const GROUND = 86; // y of the grass surface

  const C = {
    skyTop:[140,194,255], skyLow:[183,221,255],
    cloud:[246,248,252], cloudSh:[223,228,238],
    sun:[255,242,150], sunCore:[255,251,210],
    grassA:[126,184,82], grassB:[112,170,70], grassTop:[150,202,96], grassDark:[92,148,56],
    dirt:[140,101,71], dirtDk:[120,84,58], dirtSpk:[104,73,52],
    fur:[228,172,80], furLt:[246,217,160], furSh:[194,134,46], dark:[64,42,24],
    eye:[28,18,11], white:[255,255,255], pink:[233,128,148],
    collar:[79,163,214], collarSh:[54,128,176], tag:[244,196,82],
    heart:[226,58,72], heartDk:[150,28,44],
  };

  let inited = false, canvas, ctx, img, data;
  let t0 = 0, lastNow = 0, feedTime = -999;
  let nextBlink = 1.5, blinkUntil = 0;
  const clouds = [
    { x: 10,  y: 16, s: 4.5 }, { x: 70, y: 26, s: 3.0 }, { x: 110, y: 12, s: 5.5 },
  ];
  const hearts = []; // floating heart particles

  // ---- pixel helpers ----
  const setPx = (x, y, c) => {
    x |= 0; y |= 0;
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const i = (y * W + x) * 4, a = c[3] === undefined ? 255 : c[3];
    if (a >= 255) { data[i]=c[0]; data[i+1]=c[1]; data[i+2]=c[2]; data[i+3]=255; }
    else {
      const ia = a/255, na = 1-ia;
      data[i]=c[0]*ia+data[i]*na; data[i+1]=c[1]*ia+data[i+1]*na;
      data[i+2]=c[2]*ia+data[i+2]*na; data[i+3]=Math.max(data[i+3],a);
    }
  };
  const rect = (x, y, w, h, c) => {
    for (let j=0;j<h;j++) for (let k=0;k<w;k++) setPx(x+k, y+j, c);
  };
  // deterministic per-pixel noise so textures don't shimmer
  const hash = (x, y) => ((x*73856093) ^ (y*19349663)) >>> 0;

  // ---- the Minecraft world ----
  function drawScene(t) {
    // sky gradient
    for (let y = 0; y < GROUND; y++) {
      const f = y / GROUND;
      const c = [
        C.skyTop[0]+(C.skyLow[0]-C.skyTop[0])*f,
        C.skyTop[1]+(C.skyLow[1]-C.skyTop[1])*f,
        C.skyTop[2]+(C.skyLow[2]-C.skyTop[2])*f,
      ];
      for (let x = 0; x < W; x++) setPx(x, y, c);
    }

    // sun (blocky, top-left)
    rect(12, 12, 16, 16, C.sun);
    rect(15, 15, 10, 10, C.sunCore);

    // clouds (drifting)
    clouds.forEach((cl) => {
      const x = Math.round(cl.x);
      rect(x,    cl.y,   22, 6, C.cloud);
      rect(x+4,  cl.y-3, 14, 4, C.cloud);
      rect(x+2,  cl.y+6, 18, 3, C.cloudSh);
    });

    // grass surface (bright top edge)
    for (let x = 0; x < W; x++) {
      setPx(x, GROUND - 1, C.grassTop);
      setPx(x, GROUND, C.grassA);
    }
    // grass + dirt body with block texture
    for (let y = GROUND + 1; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const n = hash(x, y) % 7;
        let c;
        if (y < GROUND + 4) {                  // grass layer
          c = n === 0 ? C.grassDark : (n < 3 ? C.grassB : C.grassA);
        } else {                                // dirt
          c = n === 0 ? C.dirtSpk : (n < 2 ? C.dirtDk : C.dirt);
        }
        // faint 16px block grid lines
        if (x % 16 === 0 || (y - GROUND) % 16 === 0) c = [c[0]*0.92, c[1]*0.92, c[2]*0.92];
        setPx(x, y, c);
      }
    }
  }

  // ---- the blocky Labrador (front view, sitting) ----
  function drawDog(t) {
    const fed = t - feedTime;
    const happy = fed >= 0 && fed < 1.4;
    const oy = happy ? -Math.round(Math.abs(Math.sin(fed * 9)) * 3) : 0; // hop
    const breath = Math.sin(t * 1.9) > 0.4 ? 1 : 0;
    const blinking = t < blinkUntil;
    const earTwitch = Math.sin(t * 0.7) > 0.95 ? -1 : 0;

    const wagSpeed = happy ? 22 : 3;
    const wag = Math.round(Math.sin(t * wagSpeed) * (happy ? 5 : 2));

    const R = (x, y, w, h, c) => rect(x, y + oy, w, h, c); // dog-space rect (applies hop)

    // contact shadow on the grass (stays on ground)
    rect(48, GROUND - 1, 34, 1, C.grassDark);

    // tail (behind body, wags)
    R(80 + wag, 58, 8, 18, C.fur);
    R(80 + wag, 58, 8, 3, C.furLt);

    // body
    R(46, 52, 36, 32, C.fur);
    R(46, 52, 36, 2, C.furLt);          // top light
    R(46, 52, 2, 32, C.furSh);          // side shade
    R(80, 52, 2, 32, C.furSh);
    R(54, 56, 20, 24 - breath, C.furLt); // belly (breathes)

    // hind paws peeking at the sides
    R(44, 80, 10, 4, C.furLt);
    R(74, 80, 10, 4, C.furLt);

    // front legs + paws
    R(54, 72, 8, 12, C.fur);
    R(66, 72, 8, 12, C.fur);
    R(54, 82, 8, 2, C.furLt);
    R(66, 82, 8, 2, C.furLt);

    // collar + tag
    R(46, 50, 36, 4, C.collar);
    R(46, 53, 36, 1, C.collarSh);
    R(62, 54, 4, 4, C.tag);
    setPx(63, 56 + oy, C.dark);

    // ears (behind head, hang at the sides)
    R(40, 26 + earTwitch, 8, 20, C.furSh);
    R(80, 26 - earTwitch, 8, 20, C.furSh);
    R(40, 26 + earTwitch, 8, 2, C.fur);
    R(80, 26 - earTwitch, 8, 2, C.fur);

    // head
    R(48, 22, 32, 28, C.fur);
    R(48, 22, 32, 3, C.furLt);          // forehead light
    R(48, 47, 32, 3, C.furSh);          // chin shade

    // eyes
    if (blinking) {
      R(54, 36, 5, 1, C.dark);
      R(69, 36, 5, 1, C.dark);
    } else {
      R(54, 33, 5, 6, C.eye);
      R(69, 33, 5, 6, C.eye);
      setPx(55, 34 + oy, C.white);
      setPx(70, 34 + oy, C.white);
    }

    // muzzle
    R(56, 40, 16, 11, C.furLt);
    // nose
    R(60, 41, 8, 5, C.eye);
    setPx(61, 42 + oy, C.white);
    // mouth
    R(57, 47, 6, 1, C.dark);
    R(65, 47, 6, 1, C.dark);
    // tongue when fed
    if (happy) {
      R(61, 48, 6, 5, C.pink);
      R(63, 48, 1, 5, [200, 92, 112]);
    }
  }

  // ---- floating Minecraft hearts ----
  const HEART = [
    [0,1,0,1,0],
    [1,1,1,1,1],
    [1,1,1,1,1],
    [0,1,1,1,0],
    [0,0,1,0,0],
  ];
  function spawnHearts() {
    for (let i = 0; i < 4; i++) {
      hearts.push({ x: 56 + Math.random()*16, y: 44, vy: 9 + Math.random()*5,
                    vx: (Math.random()-0.5)*6, life: 1.4 });
    }
  }
  function drawHearts(dt) {
    for (let i = hearts.length - 1; i >= 0; i--) {
      const h = hearts[i];
      h.y -= h.vy * dt; h.x += h.vx * dt; h.life -= dt;
      if (h.life <= 0) { hearts.splice(i, 1); continue; }
      const bx = Math.round(h.x), by = Math.round(h.y);
      for (let r = 0; r < 5; r++) for (let cc = 0; cc < 5; cc++) {
        if (HEART[r][cc]) {
          const edge = (r===0||cc===0||cc===4) ? C.heartDk : C.heart;
          setPx(bx + cc, by + r, edge);
        }
      }
      setPx(bx + 1, by + 1, C.white); // shine
    }
  }

  // ---- loop ----
  function frame() {
    requestAnimationFrame(frame);
    const now = performance.now();
    const t = (now - t0) / 1000;
    const dt = Math.min((now - lastNow) / 1000, 0.05);
    lastNow = now;

    // drift clouds
    clouds.forEach((cl) => { cl.x += cl.s * dt; if (cl.x > W + 24) cl.x = -28; });
    // blink scheduling
    if (t > nextBlink && t > blinkUntil) { blinkUntil = t + 0.12; nextBlink = t + 2.5 + Math.random()*3.5; }

    data.fill(0);
    drawScene(t);
    drawDog(t);
    drawHearts(dt);
    ctx.putImageData(img, 0, 0);
  }

  window.PawseDog = {
    start() {
      if (inited) return;
      const container = document.getElementById("scene");
      if (!container) return;
      inited = true;
      canvas = document.createElement("canvas");
      canvas.width = W; canvas.height = H;
      canvas.className = "pixel-dog";
      container.appendChild(canvas);
      ctx = canvas.getContext("2d");
      img = ctx.createImageData(W, H);
      data = img.data;
      t0 = lastNow = performance.now();
      frame();
    },
    feed() {
      feedTime = (performance.now() - t0) / 1000;
      spawnHearts();
    },
  };
})();
