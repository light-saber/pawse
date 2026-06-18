/* Pawse — a tiny Minecraft-style scene with a blocky Labrador.
   Two stacked pixel canvases (128x112): the world scene behind, and a
   transparent dog layer on top that can spin (CSS rotateY) when the dog
   spontaneously morphs into another breed.
   Exposes window.PawseDog = { start, feed, morph, setBreed, breeds }. */
(() => {
  "use strict";

  const W = 128, H = 112;
  const GROUND = 86;

  const C = {
    skyTop:[140,194,255], skyLow:[183,221,255],
    cloud:[246,248,252], cloudSh:[223,228,238],
    sun:[255,242,150], sunCore:[255,251,210],
    grassA:[126,184,82], grassB:[112,170,70], grassTop:[150,202,96], grassDark:[92,148,56],
    dirt:[140,101,71], dirtDk:[120,84,58], dirtSpk:[104,73,52],
    dark:[64,42,24], eye:[28,18,11], white:[255,255,255], pink:[233,128,148],
    collar:[79,163,214], collarSh:[54,128,176], tag:[244,196,82],
    heart:[226,58,72], heartDk:[150,28,44], spot:[38,36,40],
    spark:[255,244,150], sparkLt:[255,255,255],
  };

  // dog breeds — fur trio (fur / light / shade), optional spots
  const BREEDS = [
    { name: "Golden Lab",   fur:[228,172,80],  lt:[246,217,160], sh:[194,134,46] },
    { name: "Chocolate Lab",fur:[124,80,46],   lt:[164,116,72],  sh:[88,55,30] },
    { name: "Black Lab",    fur:[66,64,70],    lt:[106,104,112], sh:[40,38,44] },
    { name: "Husky",        fur:[122,132,144], lt:[228,233,240], sh:[80,88,100] },
    { name: "Dalmatian",    fur:[236,236,240], lt:[255,255,255], sh:[200,202,212],
      spots:[[52,27,4,4],[71,30,3,3],[50,58,5,5],[72,64,4,4],[60,76,3,3],[78,61,4,4]] },
    { name: "Samoyed",      fur:[236,234,228], lt:[255,255,255], sh:[206,204,198] },
    { name: "Shiba",        fur:[216,128,60],  lt:[246,198,150], sh:[176,96,42] },
    { name: "Pink Poodle",  fur:[234,150,172], lt:[250,202,214], sh:[202,112,138] },
  ];

  let inited = false, bgCanvas, bgCtx, bgImg, bgData, fgCanvas, fgCtx, fgImg, fgData;
  let t0 = 0, lastNow = 0, feedTime = -999;
  let nextBlink = 1.5, blinkUntil = 0, breed = 0;
  const clouds = [ { x:10, y:16, s:4.5 }, { x:70, y:26, s:3.0 }, { x:110, y:12, s:5.5 } ];
  const hearts = [];
  const sparks = [];

  // ---- pixel helpers (target a given buffer) ----
  const set = (buf, x, y, c) => {
    x |= 0; y |= 0;
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const i = (y * W + x) * 4, a = c[3] === undefined ? 255 : c[3];
    if (a >= 255) { buf[i]=c[0]; buf[i+1]=c[1]; buf[i+2]=c[2]; buf[i+3]=255; }
    else {
      const ia = a/255, na = 1-ia;
      buf[i]=c[0]*ia+buf[i]*na; buf[i+1]=c[1]*ia+buf[i+1]*na;
      buf[i+2]=c[2]*ia+buf[i+2]*na; buf[i+3]=Math.max(buf[i+3],a);
    }
  };
  const fillRect = (buf, x, y, w, h, c) => {
    for (let j=0;j<h;j++) for (let k=0;k<w;k++) set(buf, x+k, y+j, c);
  };
  const hash = (x, y) => ((x*73856093) ^ (y*19349663)) >>> 0;

  // ---- world scene (background canvas) ----
  function drawScene(t) {
    const b = bgData;
    for (let y = 0; y < GROUND; y++) {
      const f = y / GROUND;
      const c = [ C.skyTop[0]+(C.skyLow[0]-C.skyTop[0])*f,
                  C.skyTop[1]+(C.skyLow[1]-C.skyTop[1])*f,
                  C.skyTop[2]+(C.skyLow[2]-C.skyTop[2])*f ];
      for (let x = 0; x < W; x++) set(b, x, y, c);
    }
    fillRect(b, 12, 12, 16, 16, C.sun);
    fillRect(b, 15, 15, 10, 10, C.sunCore);
    clouds.forEach((cl) => {
      const x = Math.round(cl.x);
      fillRect(b, x,   cl.y,   22, 6, C.cloud);
      fillRect(b, x+4, cl.y-3, 14, 4, C.cloud);
      fillRect(b, x+2, cl.y+6, 18, 3, C.cloudSh);
    });
    for (let x = 0; x < W; x++) { set(b, x, GROUND-1, C.grassTop); set(b, x, GROUND, C.grassA); }
    for (let y = GROUND + 1; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const n = hash(x, y) % 7;
        let c = y < GROUND + 4
          ? (n === 0 ? C.grassDark : (n < 3 ? C.grassB : C.grassA))
          : (n === 0 ? C.dirtSpk : (n < 2 ? C.dirtDk : C.dirt));
        if (x % 16 === 0 || (y - GROUND) % 16 === 0) c = [c[0]*0.92, c[1]*0.92, c[2]*0.92];
        set(b, x, y, c);
      }
    }
    fillRect(b, 48, GROUND-1, 34, 1, C.grassDark); // contact shadow stays on ground
  }

  // ---- the blocky dog (foreground canvas) ----
  function drawDog(t) {
    const f = fgData;
    const BR = BREEDS[breed];
    const fed = t - feedTime;
    const happy = fed >= 0 && fed < 1.4;
    const oy = happy ? -Math.round(Math.abs(Math.sin(fed * 9)) * 3) : 0;
    const breath = Math.sin(t * 1.9) > 0.4 ? 1 : 0;
    const blinking = t < blinkUntil;
    const earTwitch = Math.sin(t * 0.7) > 0.95 ? -1 : 0;
    const wag = Math.round(Math.sin(t * (happy ? 22 : 3)) * (happy ? 5 : 2));
    const R = (x, y, w, h, c) => fillRect(f, x, y + oy, w, h, c);
    const PX = (x, y, c) => set(f, x, y + oy, c);

    // tail
    R(80 + wag, 58, 8, 18, BR.fur);  R(80 + wag, 58, 8, 3, BR.lt);
    // body
    R(46, 52, 36, 32, BR.fur);  R(46, 52, 36, 2, BR.lt);
    R(46, 52, 2, 32, BR.sh);    R(80, 52, 2, 32, BR.sh);
    R(54, 56, 20, 24 - breath, BR.lt);
    // hind paws
    R(44, 80, 10, 4, BR.lt);  R(74, 80, 10, 4, BR.lt);
    // front legs + paws
    R(54, 72, 8, 12, BR.fur);  R(66, 72, 8, 12, BR.fur);
    R(54, 82, 8, 2, BR.lt);    R(66, 82, 8, 2, BR.lt);
    // ears
    R(40, 26 + earTwitch, 8, 20, BR.sh);  R(80, 26 - earTwitch, 8, 20, BR.sh);
    R(40, 26 + earTwitch, 8, 2, BR.fur);  R(80, 26 - earTwitch, 8, 2, BR.fur);
    // head
    R(48, 22, 32, 28, BR.fur);  R(48, 22, 32, 3, BR.lt);  R(48, 47, 32, 3, BR.sh);
    // muzzle
    R(56, 40, 16, 11, BR.lt);
    // breed spots (e.g. Dalmatian)
    if (BR.spots) BR.spots.forEach((s) => R(s[0], s[1], s[2], s[3], C.spot));

    // collar + tag (always)
    R(46, 50, 36, 4, C.collar);  R(46, 53, 36, 1, C.collarSh);
    R(62, 54, 4, 4, C.tag);  PX(63, 56, C.dark);

    // eyes
    if (blinking) { R(54, 36, 5, 1, C.dark); R(69, 36, 5, 1, C.dark); }
    else {
      R(54, 33, 5, 6, C.eye);  R(69, 33, 5, 6, C.eye);
      PX(55, 34, C.white);  PX(70, 34, C.white);
    }
    // nose + mouth
    R(60, 41, 8, 5, C.eye);  PX(61, 42, C.white);
    R(57, 47, 6, 1, C.dark);  R(65, 47, 6, 1, C.dark);
    if (happy) { R(61, 48, 6, 5, C.pink); R(63, 48, 1, 5, [200,92,112]); }
  }

  // ---- floating hearts ----
  const HEART = [[0,1,0,1,0],[1,1,1,1,1],[1,1,1,1,1],[0,1,1,1,0],[0,0,1,0,0]];
  function spawnHearts() {
    for (let i=0;i<4;i++) hearts.push({ x:56+Math.random()*16, y:44, vy:9+Math.random()*5, vx:(Math.random()-0.5)*6, life:1.4 });
  }
  function drawHearts(dt) {
    for (let i = hearts.length-1; i >= 0; i--) {
      const h = hearts[i];
      h.y -= h.vy*dt; h.x += h.vx*dt; h.life -= dt;
      if (h.life <= 0) { hearts.splice(i,1); continue; }
      const bx = Math.round(h.x), by = Math.round(h.y);
      for (let r=0;r<5;r++) for (let cc=0;cc<5;cc++)
        if (HEART[r][cc]) set(fgData, bx+cc, by+r, (r===0||cc===0||cc===4)?C.heartDk:C.heart);
      set(fgData, bx+1, by+1, C.white);
    }
  }

  // ---- morph sparkles ----
  function spawnSparks() {
    for (let i=0;i<16;i++) {
      const a = Math.random()*Math.PI*2, sp = 14+Math.random()*20;
      sparks.push({ x:64, y:48, vx:Math.cos(a)*sp, vy:Math.sin(a)*sp, life:0.7 });
    }
  }
  function drawSparks(dt) {
    for (let i = sparks.length-1; i >= 0; i--) {
      const s = sparks[i];
      s.x += s.vx*dt; s.y += s.vy*dt; s.vy += 14*dt; s.life -= dt;
      if (s.life <= 0) { sparks.splice(i,1); continue; }
      const c = s.life > 0.35 ? C.sparkLt : C.spark;
      const x = Math.round(s.x), y = Math.round(s.y);
      set(fgData, x, y, c); set(fgData, x+1, y, c); set(fgData, x, y+1, c);
    }
  }

  // ---- loop ----
  function frame() {
    requestAnimationFrame(frame);
    const now = performance.now();
    const t = (now - t0) / 1000;
    const dt = Math.min((now - lastNow) / 1000, 0.05);
    lastNow = now;

    clouds.forEach((cl) => { cl.x += cl.s*dt; if (cl.x > W+24) cl.x = -28; });
    if (t > nextBlink && t > blinkUntil) { blinkUntil = t + 0.12; nextBlink = t + 2.5 + Math.random()*3.5; }

    bgData.fill(0); drawScene(t); bgCtx.putImageData(bgImg, 0, 0);
    fgData.fill(0); drawDog(t); drawHearts(dt); drawSparks(dt); fgCtx.putImageData(fgImg, 0, 0);
  }

  function makeCanvas(cls, container) {
    const c = document.createElement("canvas");
    c.width = W; c.height = H; c.className = cls;
    container.appendChild(c);
    return c;
  }

  window.PawseDog = {
    start() {
      if (inited) return;
      const container = document.getElementById("scene");
      if (!container) return;
      inited = true;
      bgCanvas = makeCanvas("pixel-bg", container);
      fgCanvas = makeCanvas("pixel-dog", container);
      bgCtx = bgCanvas.getContext("2d"); bgImg = bgCtx.createImageData(W, H); bgData = bgImg.data;
      fgCtx = fgCanvas.getContext("2d"); fgImg = fgCtx.createImageData(W, H); fgData = fgImg.data;
      t0 = lastNow = performance.now();
      frame();
    },
    feed() {
      feedTime = (performance.now() - t0) / 1000;
      spawnHearts();
    },
    setBreed(i) { if (i >= 0 && i < BREEDS.length) breed = i; },
    // spin the dog and swap to a new breed at the midpoint of the spin
    morph(i) {
      if (!fgCanvas) { this.setBreed(i); return; }
      spawnSparks();
      fgCanvas.classList.remove("spinning");
      void fgCanvas.offsetWidth; // restart the CSS animation
      fgCanvas.classList.add("spinning");
      setTimeout(() => { breed = (i>=0 && i<BREEDS.length) ? i : breed; spawnSparks(); }, 440);
      fgCanvas.addEventListener("animationend", () => fgCanvas.classList.remove("spinning"), { once: true });
    },
    get breeds() { return BREEDS.map((b) => b.name); },
  };
})();
