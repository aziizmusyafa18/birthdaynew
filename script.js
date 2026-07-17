/* ============================================================
   Birthday Web - script.js
   - Meteor: canvas-based, ratusan meteor berjatuhan
   - Text: particle effect (bintang berkumpul jadi kata)
   - Alur: Countdown → HBD → Date → Age → Album
   ============================================================ */

// ── Hitung umur ───────────────────────────────────────────────
const BIRTH_DATE = new Date(1996, 6, 19);
function calcAge(birth) {
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

// ── Canvas setup ──────────────────────────────────────────────
const meteorCanvas  = document.getElementById('meteorCanvas');
const mCtx          = meteorCanvas.getContext('2d');
const particleCanvas = document.getElementById('particleCanvas');
const pCtx          = particleCanvas.getContext('2d');

function resizeCanvases() {
  meteorCanvas.width   = particleCanvas.width  = window.innerWidth;
  meteorCanvas.height  = particleCanvas.height = window.innerHeight;
}
resizeCanvases();
window.addEventListener('resize', () => {
  resizeCanvases();
  if (currentParticleLines.length) {
    renderParticleText(currentParticleLines, currentParticleColor, currentFontSize);
  }
});

// ── METEOR SYSTEM ─────────────────────────────────────────────
const meteors = [];
const METEOR_COUNT = 400;

class Meteor {
  constructor() { this.reset(true); }

  reset(initial = false) {
    this.x      = Math.random() * meteorCanvas.width;
    this.y      = initial ? Math.random() * -meteorCanvas.height * 2 : -(10 + Math.random() * 60);
    this.len    = 80 + Math.random() * 140;
    this.speed  = 6 + Math.random() * 12;
    this.width  = 0.8 + Math.random() * 1.8;
    this.alpha  = 0.5 + Math.random() * 0.5;
  }

  update() {
    this.y += this.speed;
    if (this.y > meteorCanvas.height + this.len) this.reset();
  }

  draw(ctx) {
    ctx.save();
    ctx.globalAlpha = this.alpha;
    const grad = ctx.createLinearGradient(this.x, this.y, this.x, this.y - this.len);
    grad.addColorStop(0,   'rgba(255, 245, 210, 1)');
    grad.addColorStop(0.3, 'rgba(230, 180, 100, 0.7)');
    grad.addColorStop(1,   'rgba(200, 120, 60, 0)');
    ctx.strokeStyle = grad;
    ctx.lineWidth   = this.width;
    ctx.beginPath();
    ctx.moveTo(this.x, this.y);
    ctx.lineTo(this.x, this.y - this.len);
    ctx.stroke();
    // bright head
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.width, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 250, 220, 1)';
    ctx.fill();
    ctx.restore();
  }
}

for (let i = 0; i < METEOR_COUNT; i++) meteors.push(new Meteor());

function animateMeteors() {
  mCtx.clearRect(0, 0, meteorCanvas.width, meteorCanvas.height);
  for (const m of meteors) { m.update(); m.draw(mCtx); }
  requestAnimationFrame(animateMeteors);
}
animateMeteors();

// ── PARTICLE TEXT SYSTEM ──────────────────────────────────────
let particles    = [];
let particleRAF  = null;
let currentParticleLines = [];
let currentParticleColor = '#e8c49a';
let currentFontSize      = 72;

const FONT_FACE = '"Outfit", "Montserrat", sans-serif';

// Gunakan canvas terpisah yang benar-benar fresh setiap render
function getTextPixels(lines, fontSize) {
  const W = window.innerWidth;
  const H = window.innerHeight;

  // Buat canvas baru agar tidak ada state scale/transform yang tertinggal
  const c   = document.createElement('canvas');
  c.width   = W;
  c.height  = H;
  const ctx = c.getContext('2d');

  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle    = '#ffffff';
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';

  // Hitung font size yang muat di layar untuk semua baris
  let fSize = fontSize;
  for (const line of lines) {
    ctx.font = `900 ${fSize}px ${FONT_FACE}`;
    while (ctx.measureText(line).width > W * 0.90 && fSize > 18) {
      fSize -= 2;
      ctx.font = `900 ${fSize}px ${FONT_FACE}`;
    }
  }

  // Jika dua baris, pastikan total tinggi tidak overflow layar
  let shrinkH = fSize;
  while (lines.length > 1 && (lines.length * shrinkH * 1.25) > H * 0.88 && shrinkH > 18) {
    shrinkH -= 2;
  }
  if (shrinkH < fSize) fSize = shrinkH;

  const lineHFinal  = fSize * 1.25;
  const totalHFinal = lines.length * lineHFinal;
  const startY      = H / 2 - totalHFinal / 2 + lineHFinal / 2;

  ctx.font = `900 ${fSize}px ${FONT_FACE}`;
  lines.forEach((line, i) => {
    ctx.fillText(line, W / 2, startY + i * lineHFinal);
  });

  // Sampling: ambil koordinat pixel yang terisi
  const data   = ctx.getImageData(0, 0, W, H).data;
  const rawPts = [];

  // STEP berbeda: single char lebih longgar, multi-line lebih rapat
  const isSingle = lines.length === 1 && [...lines[0]].length <= 2;
  const STEP = isSingle ? 5 : 3;

  for (let y = 0; y < H; y += STEP) {
    for (let x = 0; x < W; x += STEP) {
      if (data[(y * W + x) * 4 + 3] > 100) {
        rawPts.push({ x, y });
      }
    }
  }

  // MAX partikel: single char lebih sedikit, multi-line lebih banyak agar padat
  const MAX = isSingle ? 1800 : 4500;

  if (rawPts.length <= MAX) return rawPts;

  // Subsample acak agar distribusi merata di seluruh huruf
  const ratio = MAX / rawPts.length;
  return rawPts.filter(() => Math.random() < ratio);
}

class Particle {
  constructor(tx, ty, color) {
    this.tx = tx;
    this.ty = ty;

    // Spawn acak di seluruh layar
    this.x = Math.random() * particleCanvas.width;
    this.y = Math.random() * particleCanvas.height;

    this.color = color;

    // Partikel cukup besar agar huruf solid
    this.size = 3.2 + Math.random() * 1.6;

    // Alpha langsung visible sejak spawn
    this.maxAlpha = 0.90 + Math.random() * 0.10;
    this.alpha    = 0.5;

    // Ease halus tapi cukup cepat — terbentuk dalam ~25 frame
    this.ease = 0.16 + Math.random() * 0.08;

    // Twinkle setelah settled
    this.twinkleT   = Math.random() * Math.PI * 2;
    this.twinkleSpd = 0.016 + Math.random() * 0.016;
    this.settled    = false;
  }

  update() {
    const dx = this.tx - this.x;
    const dy = this.ty - this.y;

    this.x += dx * this.ease;
    this.y += dy * this.ease;

    if (this.alpha < this.maxAlpha) {
      this.alpha = Math.min(this.maxAlpha, this.alpha + 0.08);
    }

    if (Math.abs(dx) < 1.0 && Math.abs(dy) < 1.0) {
      this.x = this.tx;
      this.y = this.ty;
      this.settled = true;
    }

    if (this.settled) {
      this.twinkleT += this.twinkleSpd;
      this.alpha = this.maxAlpha * (0.80 + 0.20 * Math.sin(this.twinkleT));
    }
  }

  draw(ctx) {
    // Tidak pakai shadowBlur per-partikel — terlalu berat
    // Glow ditangani oleh ctx.shadowBlur di level renderLoop
    ctx.globalAlpha = this.alpha;
    ctx.fillStyle   = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    ctx.fill();

    // Bright core putih
    ctx.globalAlpha = this.alpha * 0.65;
    ctx.fillStyle   = '#ffffff';
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size * 0.40, 0, Math.PI * 2);
    ctx.fill();
  }
}

function renderParticleText(lines, color, fontSize = 72) {
  currentParticleLines = lines;
  currentParticleColor = color;
  currentFontSize      = fontSize;

  if (particleRAF) cancelAnimationFrame(particleRAF);
  particles = [];

  const points = getTextPixels(lines, fontSize);
  for (const pt of points) particles.push(new Particle(pt.x, pt.y, color));

  particleCanvas.classList.remove('hidden');

  function loop() {
    pCtx.clearRect(0, 0, particleCanvas.width, particleCanvas.height);

    // Pass 1: partikel yang masih bergerak — tanpa shadowBlur (cepat)
    pCtx.shadowBlur = 0;
    for (const p of particles) {
      p.update();
      if (!p.settled) p.draw(pCtx);
    }

    // Pass 2: partikel yang sudah settled — tanpa glow
    pCtx.shadowBlur  = 0;
    pCtx.shadowColor = 'transparent';
    for (const p of particles) {
      if (p.settled) p.draw(pCtx);
    }

    pCtx.shadowBlur  = 0;
    pCtx.globalAlpha = 1;
    particleRAF = requestAnimationFrame(loop);
  }
  loop();
}

function clearParticleText(cb) {
  if (!particles.length) { if (cb) cb(); return; }

  for (const p of particles) {
    p.ease = 0.05;
    p.tx   = p.x + (Math.random() - 0.5) * particleCanvas.width * 1.4;
    p.ty   = p.y + particleCanvas.height * 0.6 + Math.random() * 300;
  }

  let frames = 0;
  function scatter() {
    pCtx.clearRect(0, 0, particleCanvas.width, particleCanvas.height);
    for (const p of particles) {
      p.alpha = Math.max(0, p.alpha - 0.025);
      p.update(); p.draw(pCtx);
    }
    frames++;
    if (frames < 50) requestAnimationFrame(scatter);
    else {
      if (particleRAF) cancelAnimationFrame(particleRAF);
      pCtx.clearRect(0, 0, particleCanvas.width, particleCanvas.height);
      particleCanvas.classList.add('hidden');
      particles = [];
      if (cb) cb();
    }
  }
  if (particleRAF) cancelAnimationFrame(particleRAF);
  scatter();
}

// ── AUDIO ─────────────────────────────────────────────────────
const music = document.getElementById('bgMusic');
const musicToggle = document.getElementById('musicToggle');
let musicStarted = false;
let musicEnabled = true;

function tryPlayMusic() {
  if (!musicEnabled || musicStarted) return;
  musicStarted = true;
  music.muted = false;
  music.volume = 0.5;
  music.play().catch(() => {
    console.log('Autoplay blocked, user can enable via button');
  });
}

// Music toggle button
musicToggle.addEventListener('click', () => {
  musicEnabled = !musicEnabled;
  if (musicEnabled) {
    music.muted = false;
    music.volume = 0.5;
    if (!music.paused) {
      musicToggle.textContent = '🔊';
    } else {
      music.play().catch(() => {
        console.log('Play failed');
      });
      musicToggle.textContent = '🔊';
    }
  } else {
    music.pause();
    musicToggle.textContent = '🔇';
  }
});

// Handle tab visibility: pause saat tab hidden, resume saat visible
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    music.pause();
  } else {
    if (musicStarted && musicEnabled) {
      music.play().catch(() => {
        console.log('Resume musik failed');
      });
    }
  }
});

// ── ALBUM LOGIC (Buku 3D) ─────────────────────────────────────
let currentPage = 0;
const totalPages = 4;
let isFlipping   = false;

// Data halaman
const PAGE_DATA = [
  { caption: 'Selamat ulang tahun kak Jaysyi 🕊️', img: 'img/foto1.jpeg', alt: 'Foto 1' },
  { caption: 'Semoga hari harimu menyenangkan ..',                      img: 'img/foto2.jpeg', alt: 'Foto 2' },
  { caption: 'Dan semua hal baik menyertimu 🙂',                        img: 'img/foto3.jpeg', alt: 'Foto 3' },
  { caption: 'enjoy your special day✨',                                img: 'img/foto4.jpeg', alt: 'Foto 4', isLast: true },
];

const albumCover  = document.getElementById('album-cover');
const bookOpen    = document.getElementById('book-open');
const bookLeft    = document.getElementById('book-left-inner');
const bookRight   = document.getElementById('book-right-inner');
const flipLayer   = document.getElementById('flip-layer');
const flipPage    = document.getElementById('flip-page');
const flipFront   = document.getElementById('flip-front');
const flipBack    = document.getElementById('flip-back');
const tapPrev     = document.getElementById('tap-prev');
const tapNext     = document.getElementById('tap-next');

// Buat konten HTML untuk satu halaman
function makePageHTML(pageIndex) {
  if (pageIndex < 0 || pageIndex >= totalPages) return '';
  const d = PAGE_DATA[pageIndex];
  const isLast = d.isLast || false;
  return `
    <div class="book-caption">${d.caption}</div>
    <div class="book-photo-frame"><img src="${d.img}" alt="${d.alt}" loading="lazy"></div>
    <div class="book-page-num">${isLast
      ? '<span class="book-lanjut-hint">ketuk kanan untuk lanjut ›</span>'
      : `${pageIndex + 1} / ${totalPages}`
    }</div>
  `;
}

// Render halaman kiri (page sebelumnya) & kanan (halaman aktif) tanpa animasi
function renderBookPages() {
  bookRight.innerHTML = makePageHTML(currentPage);
  bookLeft.innerHTML  = currentPage > 0 ? makePageHTML(currentPage - 1) : '';

  // Sembunyikan tap-prev di halaman pertama
  tapPrev.style.display = currentPage === 0 ? 'none' : 'block';
}

// Buka album — flip cover lalu munculkan buku
function openAlbum() {
  albumCover.onclick = null;
  albumCover.classList.add('flip-open');

  // Sesuai durasi coverFlipOpen 1.1s
  setTimeout(() => {
    albumCover.style.display = 'none';
    albumCover.classList.remove('flip-open');
    currentPage = 0;
    renderBookPages();
    bookOpen.classList.remove('hidden');
  }, 1100);
}

// Flip maju (next): halaman kanan terbang ke kiri, kiri jadi halaman baru
function flipForward() {
  if (isFlipping || currentPage >= totalPages - 1) return;
  isFlipping = true;

  const fromPage = currentPage;
  const toPage   = currentPage + 1;

  flipFront.innerHTML = makePageHTML(fromPage);
  flipBack.innerHTML  = makePageHTML(toPage);

  flipPage.className = 'flip-page';
  flipPage.style.right         = '50%';
  flipPage.style.left          = 'auto';
  flipPage.style.transformOrigin = 'right center';
  flipLayer.classList.remove('hidden');

  void flipPage.offsetWidth;
  flipPage.classList.add('flip-forward');

  // Update konten di titik tengah flip (halaman sudah "terbalik")
  setTimeout(() => {
    currentPage = toPage;
    bookLeft.innerHTML  = makePageHTML(fromPage);
    bookRight.innerHTML = makePageHTML(toPage);
    tapPrev.style.display = 'block';
  }, 380);

  // Selesai animasi 750ms
  setTimeout(() => {
    flipLayer.classList.add('hidden');
    flipPage.className = 'flip-page';
    isFlipping = false;
  }, 760);
}

// Flip mundur (prev)
function flipBackward() {
  if (isFlipping || currentPage <= 0) return;
  isFlipping = true;

  const fromPage = currentPage;
  const toPage   = currentPage - 1;

  flipFront.innerHTML = makePageHTML(toPage);
  flipBack.innerHTML  = makePageHTML(fromPage);

  flipPage.className  = 'flip-page';
  flipPage.style.right         = 'auto';
  flipPage.style.left          = '50%';
  flipPage.style.transformOrigin = 'left center';
  flipLayer.classList.remove('hidden');

  void flipPage.offsetWidth;
  flipPage.classList.add('flip-backward');

  setTimeout(() => {
    currentPage = toPage;
    bookRight.innerHTML = makePageHTML(toPage);
    bookLeft.innerHTML  = toPage > 0 ? makePageHTML(toPage - 1) : '';
    tapPrev.style.display = toPage === 0 ? 'none' : 'block';
  }, 380);

  setTimeout(() => {
    flipLayer.classList.add('hidden');
    flipPage.className = 'flip-page';
    isFlipping = false;
  }, 760);
}

// Tap handlers
function nextPhoto() {
  if (currentPage === totalPages - 1) {
    goToLove();
  } else {
    flipForward();
  }
}
function prevPhoto() { flipBackward(); }

window.nextPhoto = nextPhoto;
window.prevPhoto = prevPhoto;



// ── LOVE SCENE ────────────────────────────────────────────────
const sceneLove    = document.getElementById('scene-love');

const LOVE_LINES = [];

function goToLove() {
  // sembunyikan album
  sceneAlbum.classList.add('hidden');
  sceneLove.classList.remove('hidden');

  // mulai partikel love: tampilkan ♥ dulu, lalu kata-kata
  step6_love();
}
window.goToLove = goToLove;

function step6_love() {
  if (particleRAF) { cancelAnimationFrame(particleRAF); particleRAF = null; }
  pCtx.clearRect(0, 0, particleCanvas.width, particleCanvas.height);
  particles = [];

  const W = particleCanvas.width;
  const H = particleCanvas.height;

  // Render outline hati ke canvas offscreen sebagai pixel target partikel
  const heartSize = Math.min(W, H) * 0.70;
  const cx = W / 2;
  const cy = H / 2 - heartSize * 0.03;
  const scale = heartSize / 34;

  // Buat canvas offscreen bersih
  const oc  = document.createElement('canvas');
  oc.width  = W;
  oc.height = H;
  const octx = oc.getContext('2d');

  // Gambar outline hati ke offscreen — stroke tebal agar banyak pixel terambil
  octx.strokeStyle = '#ffffff';
  octx.lineWidth   = 6;
  octx.lineCap     = 'round';
  octx.lineJoin    = 'round';
  octx.beginPath();
  const PATH_STEPS = 400;
  for (let i = 0; i <= PATH_STEPS; i++) {
    const a  = (i / PATH_STEPS) * Math.PI * 2;
    const hx = cx + scale * 16 * Math.pow(Math.sin(a), 3);
    const hy = cy - scale * (13 * Math.cos(a) - 5 * Math.cos(2*a) - 2 * Math.cos(3*a) - Math.cos(4*a));
    if (i === 0) octx.moveTo(hx, hy); else octx.lineTo(hx, hy);
  }
  octx.closePath();
  octx.stroke();

  // Ambil pixel yang terisi sebagai koordinat target partikel
  const imgData = octx.getImageData(0, 0, W, H).data;
  const points  = [];
  const STEP    = 3;
  for (let y = 0; y < H; y += STEP) {
    for (let x = 0; x < W; x += STEP) {
      if (imgData[(y * W + x) * 4 + 3] > 80) points.push({ x, y });
    }
  }

  // Buat partikel — warna merah muda / pink
  const HEART_COLOR = '#e87a7a';
  for (const pt of points) particles.push(new Particle(pt.x, pt.y, HEART_COLOR));

  particleCanvas.classList.remove('hidden');

  let wordsShown = false;

  function loop() {
    pCtx.clearRect(0, 0, W, H);
    let allSettled = true;
    for (const p of particles) {
      p.update();
      p.draw(pCtx);
      if (!p.settled) allSettled = false;
    }
    particleRAF = requestAnimationFrame(loop);

    // Setelah mayoritas partikel settled, munculkan tombol restart
    if (allSettled && !wordsShown) {
      wordsShown = true;
      setTimeout(showLoveWords, 600);
    }
  }
  loop();
}

function showLoveWords() {
  let container = document.getElementById('love-words-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'love-words-container';
    container.className = 'love-words';
    document.body.appendChild(container);
  }
  container.innerHTML = '';
  container.classList.remove('hidden');

  // Susun baris kata
  LOVE_LINES.forEach((line) => {
    const el = document.createElement('div');
    el.className  = 'love-word-line';
    el.textContent = line.text;
    el.style.fontSize = line.size;
    container.appendChild(el);
  });

  // Tambah tombol restart
  let restartBtn = document.getElementById('love-restart-btn');
  if (!restartBtn) {
    restartBtn = document.createElement('button');
    restartBtn.id        = 'love-restart-btn';
    restartBtn.className = 'love-restart';
    restartBtn.textContent = '↺ Ulangi dari awal';
    restartBtn.onclick   = restartAll;
    document.body.appendChild(restartBtn);
  }
  restartBtn.classList.remove('visible');

  // Munculkan tiap baris berurutan
  const lineEls = container.querySelectorAll('.love-word-line');
  lineEls.forEach((el, i) => {
    setTimeout(() => el.classList.add('visible'), i * 750);
  });

  setTimeout(() => {
    restartBtn.classList.add('visible');
  }, lineEls.length * 750 + 700);
}

function restartAll() {
  // bersihkan love scene
  const container = document.getElementById('love-words-container');
  if (container) {
    container.querySelectorAll('.love-word-line').forEach(el => el.classList.remove('visible'));
    container.classList.add('hidden');
  }
  const btn = document.getElementById('love-restart-btn');
  if (btn) btn.classList.remove('visible');

  // hentikan loop canvas
  if (particleRAF) { cancelAnimationFrame(particleRAF); particleRAF = null; }
  pCtx.clearRect(0, 0, particleCanvas.width, particleCanvas.height);
  particleCanvas.classList.add('hidden');
  particles = [];

  sceneLove.classList.add('hidden');
  step1_countdown();
}
window.restartAll = restartAll;

// ── SCENE MANAGER ─────────────────────────────────────────────
const sceneAlbum = document.getElementById('scene-album');

function showAlbumScene() {
  sceneAlbum.classList.remove('hidden');
  albumCover.style.display = 'flex';
  albumCover.classList.remove('flip-open');
  bookOpen.classList.add('hidden');
  currentPage = 0;
  albumCover.onclick = openAlbum;
}

function hideAlbumScene() {
  sceneAlbum.classList.add('hidden');
}
// Each step: render particle text → wait → scatter → next

const AGE = calcAge(BIRTH_DATE);

const BROWN_BRIGHT = '#ffd98a';
const BROWN_WARM   = '#e8a060';
const BROWN_SOFT   = '#f5deb3';

function step1_countdown() {
  const nums = ['3', '2', '1'];
  let i = 0;
  const fs  = Math.round(window.innerWidth * 0.38);
  const fsStar = Math.round(window.innerWidth * 0.28);

  function nextNum() {
    if (i < nums.length) {
      if (i === 0) tryPlayMusic();
      renderParticleText([nums[i]], BROWN_BRIGHT, fs);
      i++;
      setTimeout(() => clearParticleText(nextNum), 2400);
    } else {
      renderParticleText(['\u2726'], '#ffeaa0', fsStar);
      setTimeout(() => clearParticleText(step1b_hbd), 2000);
    }
  }
  nextNum();
}

function step1b_hbd() {
  const fs = Math.round(window.innerWidth * 0.18);
  renderParticleText(['Happy', 'Birthday'], BROWN_SOFT, fs);
  setTimeout(() => clearParticleText(step2_hbd), 5500);
}

function step2_hbd() {
  const fsName = Math.round(window.innerWidth * 0.16);
  renderParticleText(['Kak Jaysyi ~'], BROWN_BRIGHT, fsName);
  setTimeout(() => clearParticleText(step3_date), 4000);
}

function step3_date() {
  const fs = Math.round(window.innerWidth * 0.13);
  renderParticleText(['19 Juli 1996'], BROWN_WARM, fs);
  setTimeout(() => clearParticleText(step4_age), 4500);
}

function step4_age() {
  // Langsung lanjut ke love scene
  step5_album();
}

function step5_album() {
  step6_love();
}

// ── BOOT ──────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  // Pasang tap listeners album
  tapNext.addEventListener('click', nextPhoto);
  tapPrev.addEventListener('click', prevPhoto);

  // Tunggu font selesai dimuat sebelum memulai animasi partikel
  document.fonts.ready.then(() => {
    const warmup = document.createElement('canvas');
    const wCtx   = warmup.getContext('2d');
    wCtx.font    = `900 10px ${FONT_FACE}`;
    wCtx.fillText('3', 0, 0);
    setTimeout(step1_countdown, 300);
  });
});
