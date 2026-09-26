const defaultMovies = [
  "Moana 2",
  "Rogers and Hammerstein's Cinderella",
  "Mulan",
  "The Hunchback of Notre Dame",
  "Descendants",
  "Encanto",
  "How To Train Your Dragon",
  "Mufasa",
  "Sister Act",
  "Big Hero 6",
  "Disney's Beauty and the Beast",
  "Hercules",
  "Disney's Aladdin",
  "Moana",
  "Aladdin",
  "The Little Mermaid",
  "Tangled",
  "Newsies Broadway Musical",
  "A League of Their Own",
  "Inside Out",
  "Atlantis: The Lost Empire",
  "Wish",
  "Brother Bear",
  "Anastasia",
  "The Princess and the Frog",
  "Harry Potter",
  "The Rookie",
  "Wicked",
  "Disney's The Lion King",
  "Beauty and the Beast",
  "Frozen 2",
  "Coco",
  "Frozen",
  "Lion King",
  "The Emperor's New Groove",
  "Lilo and Stitch",
  "Tarzan",
  "Raya and the Last Dragon",
  "The Greatest Showman",
  "Frozen Broadway"
];

const colors = ["#b8dfe0", "#d8c6ea", "#c6d5f2", "#f0cbd8", "#d7d2ed", "#b8d9cf", "#ead6bd", "#c4d0eb", "#e0c5dc", "#b6d4e5"];
const storageKey = "bedtimeMovieWheel.v2";
const lastSpinStorageKey = "bedtimeMovieWheel.lastSpin.v1";
let movies = load();
let lastState = null;
let selectedIndex = null;
let rotation = -Math.PI / 2;
let spinning = false;

const canvas = document.getElementById("wheel");
const ctx = canvas.getContext("2d");
const winnerEl = document.getElementById("winner") || document.querySelector("header .subtitle");
const spinBtn = document.getElementById("spinBtn");
const watchedBtn = document.getElementById("watchedBtn");
const undoBtn = document.getElementById("undoBtn");
const resetBtn = document.getElementById("resetBtn");
const movieList = document.getElementById("movieList");
const totalSlices = document.getElementById("totalSlices");
const newMovie = document.getElementById("newMovie");
const addBtn = document.getElementById("addBtn");
const dialog = document.getElementById("confirmDialog");

function freshDefaults() {
  return defaultMovies.map(title => ({ title, weight: 1 }));
}

function load() {
  try {
    const saved = localStorage.getItem(storageKey);
    if (!saved) return freshDefaults();
    const parsed = JSON.parse(saved);
    if (!Array.isArray(parsed) || parsed.length === 0) return freshDefaults();
    return parsed
      .filter(item => item && typeof item.title === "string" && item.title.trim())
      .map(item => ({ title: item.title.trim(), weight: Math.max(1, Number(item.weight) || 1) }));
  } catch {
    return freshDefaults();
  }
}
function save() { localStorage.setItem(storageKey, JSON.stringify(movies)); }
function totalWeight() { return movies.reduce((sum, m) => sum + m.weight, 0); }

function loadLastSpin() {
  try {
    const saved = localStorage.getItem(lastSpinStorageKey);
    if (!saved) return null;
    const parsed = JSON.parse(saved);
    if (!parsed || typeof parsed.title !== "string") {
      localStorage.removeItem(lastSpinStorageKey);
      return null;
    }

    const exactIndex = Number.isInteger(parsed.index) && movies[parsed.index]?.title === parsed.title
      ? parsed.index
      : movies.findIndex(movie => movie.title === parsed.title);

    if (exactIndex < 0) {
      localStorage.removeItem(lastSpinStorageKey);
      return null;
    }

    return {
      index: exactIndex,
      title: parsed.title,
      rotation: Number.isFinite(parsed.rotation) ? parsed.rotation : -Math.PI / 2
    };
  } catch {
    localStorage.removeItem(lastSpinStorageKey);
    return null;
  }
}

function saveLastSpin() {
  if (selectedIndex == null || !movies[selectedIndex]) return;
  localStorage.setItem(lastSpinStorageKey, JSON.stringify({
    index: selectedIndex,
    title: movies[selectedIndex].title,
    rotation
  }));
}

function clearLastSpin() {
  localStorage.removeItem(lastSpinStorageKey);
}

function weightedPick() {
  const total = totalWeight();
  let r = Math.random() * total;
  for (let i = 0; i < movies.length; i++) {
    r -= movies[i].weight;
    if (r < 0) return i;
  }
  return movies.length - 1;
}

function segmentCenter(index) {
  const total = totalWeight();
  let start = 0;
  for (let i = 0; i < index; i++) start += movies[i].weight / total * Math.PI * 2;
  const arc = movies[index].weight / total * Math.PI * 2;
  return start + arc / 2;
}

function normalizedAngle(angle) {
  const fullTurn = Math.PI * 2;
  return ((angle % fullTurn) + fullTurn) % fullTurn;
}

function movieIndexAtPointer(wheelRotation = rotation) {
  const pointerAngle = -Math.PI / 2;
  const wheelAngle = normalizedAngle(pointerAngle - wheelRotation);
  const total = totalWeight();
  let end = 0;

  for (let i = 0; i < movies.length; i++) {
    end += movies[i].weight / total * Math.PI * 2;
    if (wheelAngle < end) return i;
  }

  return movies.length - 1;
}

function finishSpin(index) {
  if (index == null || !movies[index]) return;
  selectedIndex = index;
  spinning = false;
  winnerEl.textContent = movies[index].title;
  winnerEl.setAttribute?.("aria-live", "polite");
  spinBtn.disabled = false;
  if (watchedBtn) watchedBtn.disabled = false;
  saveLastSpin();
  drawWheel();
}

function spin() {
  if (spinning || !movies.length) return;

  selectedIndex = weightedPick();

  const center = segmentCenter(selectedIndex);
  const pointerAngle = -Math.PI / 2;
  const normalizedRotation = rotation % (Math.PI * 2);
  const desiredRotation = pointerAngle - center;

  let change = desiredRotation - normalizedRotation;

  while (change < 0) change += Math.PI * 2;

  change += Math.PI * 2 * 6;

  const start = rotation;
  const targetRotation = start + change;
  const duration = 4300;
  const startTime = performance.now();

  spinning = true;
  spinBtn.disabled = true;
  if (watchedBtn) watchedBtn.disabled = true;
  winnerEl.textContent = "Spinning...";

  function animate(now) {
    const t = Math.min(1, (now - startTime) / duration);
    const eased = 1 - Math.pow(1 - t, 4);

    rotation = start + change * eased;
    drawWheel();

    if (t < 1) {
      requestAnimationFrame(animate);
    } else {
      rotation = targetRotation % (Math.PI * 2);
      finishSpin(selectedIndex);
    }
  }

  requestAnimationFrame(animate);
}

function markWatched() {
  if (selectedIndex == null) return;
  lastState = JSON.stringify(movies);
  // 5% increase multiplier on unwatched movies; the watched one resets to 1.
  movies = movies.map((m, i) => ({ ...m, weight: i === selectedIndex ? 1 : m.weight * 1.05 }));
  selectedIndex = null;
  clearLastSpin();
  watchedBtn.disabled = true;
  save();
  render();
}

function undo() {
  if (!lastState) return;
  movies = JSON.parse(lastState);
  lastState = null;
  selectedIndex = null;
  winnerEl.textContent = "Undone";
  watchedBtn.disabled = true;
  save();
  render();
}

function drawWheel() {
  const size = canvas.width;
  const cx = size / 2;
  const cy = size / 2;
  const radius = size * .46;
  ctx.clearRect(0, 0, size, size);

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rotation);
  ctx.translate(-cx, -cy);

  let start = 0;
  const total = totalWeight();
  movies.forEach((movie, i) => {
    const arc = movie.weight / total * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, radius, start, start + arc);
    ctx.closePath();
    ctx.fillStyle = colors[i % colors.length];
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,.55)";
    ctx.lineWidth = 2;
    ctx.stroke();

    if (arc > 0.035) {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(start + arc / 2);
      ctx.textAlign = "right";
      ctx.fillStyle = "#393346";
      ctx.font = '600 18px Quicksand, "Avenir Next", ui-rounded, -apple-system, sans-serif';
      const label = movie.title.length > 24 ? movie.title.slice(0, 23) + "…" : movie.title;
      ctx.fillText(label, radius - 18, 7);
      ctx.restore();
    }
    start += arc;
  });
  ctx.restore();

  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.clip();
  const sheen = ctx.createRadialGradient(
    size * .28, size * .22, size * .03,
    size * .52, size * .52, radius
  );
  sheen.addColorStop(0, "rgba(255,255,255,.34)");
  sheen.addColorStop(.34, "rgba(255,255,255,.09)");
  sheen.addColorStop(.72, "rgba(231,225,243,.04)");
  sheen.addColorStop(1, "rgba(74,65,97,.13)");
  ctx.fillStyle = sheen;
  ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);
  ctx.restore();

  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.lineWidth = 5;
  ctx.strokeStyle = "rgba(255,255,255,.72)";
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(cx, cy, size * .13, 0, Math.PI * 2);
  const hub = ctx.createRadialGradient(
    cx - size * .035, cy - size * .045, size * .01,
    cx, cy, size * .13
  );
  hub.addColorStop(0, "rgba(255,255,255,.98)");
  hub.addColorStop(.55, "rgba(248,246,250,.94)");
  hub.addColorStop(1, "rgba(225,223,235,.94)");
  ctx.fillStyle = hub;
  ctx.fill();
  ctx.lineWidth = 12;
  ctx.strokeStyle = "#ddd9df";
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy, size * .055, 0, Math.PI * 2);
  ctx.strokeStyle = "#c9c4cb";
  ctx.lineWidth = 8;
  ctx.stroke();
}

function renderList() {
  movieList.innerHTML = "";
  const total = totalWeight();
totalSlices.textContent = `${movies.length} movies`;
  movies.forEach((movie, index) => {
    const row = document.createElement("div");
    row.className = "movie-row";
    const pct = Math.round(movie.weight / total * 100);
    row.innerHTML = `<div class="movie-title">${escapeHtml(movie.title)} <span class="tiny">${pct}%</span></div><div class="weight">${movie.weight}</div><button class="remove" aria-label="Remove ${escapeHtml(movie.title)}">Remove</button>`;
    row.querySelector(".remove").onclick = () => {
      lastState = JSON.stringify(movies);
      const removedSelectedMovie = index === selectedIndex;
      movies.splice(index, 1);
      if (removedSelectedMovie) {
        selectedIndex = null;
        winnerEl.textContent = "Tap Spin";
        if (watchedBtn) watchedBtn.disabled = true;
        clearLastSpin();
      } else if (selectedIndex != null && index < selectedIndex) {
        selectedIndex -= 1;
        saveLastSpin();
      }
      save();
      render();
    };
    movieList.appendChild(row);
  });
}
function escapeHtml(text) {
  return text.replace(/[&<>'"]/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;"
  }[c]));
}
function render() { drawWheel(); renderList(); }

spinBtn.onclick = spin;
if (watchedBtn) watchedBtn.onclick = markWatched;
undoBtn.onclick = undo;
resetBtn.onclick = () => dialog.showModal();
document.getElementById("cancelReset").onclick = () => dialog.close();
document.getElementById("confirmReset").onclick = () => {
  lastState = JSON.stringify(movies);
  movies = freshDefaults();
  selectedIndex = null;
  clearLastSpin();
  winnerEl.textContent = "Reset";
  watchedBtn.disabled = true;
  save();
  render();
  dialog.close();
};
addBtn.onclick = () => {
  const title = newMovie.value.trim();
  if (!title) return;
  lastState = JSON.stringify(movies);
  movies.push({ title, weight: 1 });
  newMovie.value = "";
  save();
  render();
};
newMovie.addEventListener("keydown", e => { if (e.key === "Enter") addBtn.click(); });

const restoredSpin = loadLastSpin();
if (restoredSpin) {
  selectedIndex = restoredSpin.index;
  rotation = restoredSpin.rotation;
  winnerEl.textContent = restoredSpin.title;
  if (watchedBtn) watchedBtn.disabled = false;
}

render();
document.fonts?.ready.then(drawWheel);
