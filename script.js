(() => {
  "use strict";

  // ---- Persistence ----
  const STORE_KEY = "pawse.save.v1";
  const load = () => {
    try { return JSON.parse(localStorage.getItem(STORE_KEY)) || {}; }
    catch { return {}; }
  };
  const save = (data) => {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(data)); } catch {}
  };
  let state = Object.assign({ name: "", treats: 0, sound: true, breed: 0, toMorph: 0 }, load());

  // random treats-until-next-morph, always fewer than 10
  const rollMorph = () => 1 + Math.floor(Math.random() * 9);

  // ---- Elements ----
  const $ = (id) => document.getElementById(id);
  const startScreen = $("start-screen");
  const playScreen = $("play-screen");
  const nameForm = $("name-form");
  const nameInput = $("pet-name");
  const suggestionsBox = $("suggestions");
  const dogNameEl = $("dog-name");
  const treatBtn = $("treat-btn");
  const cooldownEl = $("cooldown");
  const moodEl = $("mood");
  const countEl = $("treat-count");
  const heartsLayer = $("hearts-layer");

  // Boot the pixel dog once the play screen is visible (its script may still be loading).
  const startDog = () => {
    if (window.PawseDog) {
      window.PawseDog.start();
      window.PawseDog.setBreed(state.breed || 0);
    } else setTimeout(startDog, 50);
  };

  // ---- Tunables ----
  const COOLDOWN_MS = 9000; // a treat becomes available "once in a while"

  // ---- Name suggestions ----
  const NAME_IDEAS = ["Biscuit", "Marley", "Cooper", "Nala", "Goldie", "Waffles", "Mango"];
  NAME_IDEAS.forEach((n) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "suggestion";
    b.textContent = n;
    b.addEventListener("click", () => { nameInput.value = n; nameInput.focus(); });
    suggestionsBox.appendChild(b);
  });

  // ---- Idle / mood messages ----
  const IDLE_LINES = [
    "%s is happily sitting with you.",
    "%s watches the room, content.",
    "%s lets out a soft, sleepy sigh.",
    "%s wags gently, just glad you're here.",
    "A calm afternoon with %s.",
    "%s tilts their head at you. So curious.",
  ];
  const FED_LINES = [
    "Nom nom! %s loved that.",
    "%s gobbles it up. Tail going wild!",
    "Good dog, %s. 💛",
    "%s does a happy little wiggle.",
    "%s gives you the most grateful eyes.",
  ];
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const fill = (line) => line.replace("%s", state.name);

  let idleTimer = null;
  const scheduleIdle = () => {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      setMood(fill(pick(IDLE_LINES)));
      scheduleIdle();
    }, 6000 + Math.random() * 4000);
  };
  const setMood = (text) => {
    moodEl.style.opacity = 0;
    setTimeout(() => { moodEl.textContent = text; moodEl.style.opacity = 1; }, 180);
  };

  // ---- Sound (Web Audio, no asset files) ----
  let audioCtx = null;
  const playNom = () => {
    if (!state.sound) return;
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      const t = audioCtx.currentTime;
      [0, 0.12].forEach((delay, i) => {
        const o = audioCtx.createOscillator();
        const g = audioCtx.createGain();
        o.type = "sine";
        o.frequency.setValueAtTime(i ? 360 : 300, t + delay);
        g.gain.setValueAtTime(0.0001, t + delay);
        g.gain.exponentialRampToValueAtTime(0.18, t + delay + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t + delay + 0.14);
        o.connect(g).connect(audioCtx.destination);
        o.start(t + delay);
        o.stop(t + delay + 0.16);
      });
    } catch {}
  };

  // ---- Hearts ----
  const spawnHearts = () => {
    const emojis = ["💛", "✨", "💖", "🐾"];
    for (let i = 0; i < 5; i++) {
      const h = document.createElement("span");
      h.className = "heart";
      h.textContent = pick(emojis);
      h.style.left = 35 + Math.random() * 30 + "%";
      h.style.top = 30 + Math.random() * 20 + "%";
      h.style.animationDelay = Math.random() * 0.25 + "s";
      heartsLayer.appendChild(h);
      setTimeout(() => h.remove(), 2000);
    }
  };

  // ---- Cooldown ----
  let readyAt = 0;
  let cooldownTimer = null;
  const refreshCooldown = () => {
    const remaining = readyAt - Date.now();
    if (remaining <= 0) {
      treatBtn.disabled = false;
      treatBtn.classList.add("ready");
      cooldownEl.textContent = "A treat is ready!";
      clearInterval(cooldownTimer);
      cooldownTimer = null;
    } else {
      treatBtn.disabled = true;
      treatBtn.classList.remove("ready");
      cooldownEl.textContent = `${state.name} is still munching… ${Math.ceil(remaining / 1000)}s`;
    }
  };
  const startCooldown = () => {
    readyAt = Date.now() + COOLDOWN_MS;
    clearInterval(cooldownTimer);
    refreshCooldown();
    cooldownTimer = setInterval(refreshCooldown, 250);
  };

  // ---- Feed ----
  const feed = () => {
    if (treatBtn.disabled) return;

    state.treats += 1;
    countEl.textContent = state.treats;
    save(state);

    // dog reacts: happy hop, tail wag, tongue + floating hearts (drawn in the canvas)
    if (window.PawseDog) window.PawseDog.feed();
    setMood(fill(pick(FED_LINES)));
    playNom();

    // meta layer: every random (<10) treats, the dog spontaneously becomes another breed
    state.toMorph -= 1;
    if (state.toMorph <= 0) {
      const breeds = (window.PawseDog && window.PawseDog.breeds) || [];
      let next = state.breed || 0;
      if (breeds.length > 1) {
        while (next === (state.breed || 0)) next = Math.floor(Math.random() * breeds.length);
      }
      state.breed = next;
      state.toMorph = rollMorph();
      // let the happy munch read for a beat, then spin + transform
      setTimeout(() => {
        if (window.PawseDog) window.PawseDog.morph(next);
        setMood(`✨ ${state.name} magically turned into a ${breeds[next] || "mystery dog"}! ✨`);
        scheduleIdle();
      }, 520);
    }
    save(state);

    startCooldown();
    scheduleIdle();
  };

  // ---- Screen flow ----
  const startPlaying = (name) => {
    state.name = name;
    if (!state.toMorph) state.toMorph = rollMorph();
    save(state);
    dogNameEl.textContent = name;
    countEl.textContent = state.treats;
    startScreen.classList.add("hidden");
    playScreen.classList.remove("hidden");
    setMood(`Say hello to ${name}! 🐾`);
    startCooldown();
    scheduleIdle();
    startDog();
    updateSoundLabel();
  };

  nameForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const name = nameInput.value.trim();
    if (name) startPlaying(name);
  });

  treatBtn.addEventListener("click", feed);

  // ---- Options menu ----
  const menu = $("menu");
  const soundToggle = $("sound-toggle");
  const updateSoundLabel = () => {
    soundToggle.textContent = state.sound ? "🔊 Sound: On" : "🔇 Sound: Off";
  };
  $("menu-btn").addEventListener("click", () => menu.classList.remove("hidden"));
  $("close-menu").addEventListener("click", () => menu.classList.add("hidden"));
  menu.addEventListener("click", (e) => { if (e.target === menu) menu.classList.add("hidden"); });

  soundToggle.addEventListener("click", () => {
    state.sound = !state.sound;
    save(state);
    updateSoundLabel();
    if (state.sound) playNom();
  });

  $("rename-btn").addEventListener("click", () => {
    const newName = prompt("What's your dog's name?", state.name);
    if (newName && newName.trim()) {
      state.name = newName.trim();
      save(state);
      dogNameEl.textContent = state.name;
      setMood(`${state.name} likes the new name!`);
    }
    menu.classList.add("hidden");
  });

  $("new-dog-btn").addEventListener("click", () => {
    if (confirm("Start over with a brand new dog? This clears your treat count.")) {
      state = { name: "", treats: 0, sound: state.sound, breed: 0, toMorph: rollMorph() };
      save(state);
      if (window.PawseDog) window.PawseDog.setBreed(0);
      nameInput.value = "";
      playScreen.classList.add("hidden");
      startScreen.classList.remove("hidden");
    }
    menu.classList.add("hidden");
  });

  // ---- Resume or start fresh ----
  if (state.name) {
    startPlaying(state.name);
  } else {
    nameInput.focus();
  }
})();
