const NASA_API_KEY = "LPfHrQcWkJbGQB9zpF6kMj8rqcKhRJ7jMwPMMcgJ";
const APOD_URL = "https://api.nasa.gov/planetary/apod";
const LAUNCHES_URL = "https://lldev.thespacedevs.com/2.3.0/launches/upcoming/?limit=10";
const PLANET_URL = "https://solar-system-opendata-proxy.vercel.app/api/planets";

const $ = (id) => document.getElementById(id);

const sidebar = $("sidebar");
const sidebarToggle = $("sidebar-toggle");
const navLinks = document.querySelectorAll(".nav-link");
const sections = document.querySelectorAll(".app-section");

const dateInput = $("apod-date-input");
const loadDateBtn = $("load-date-btn");
const todayBtn = $("today-apod-btn");

const launchesGrid = $("launches-grid");
const featuredLaunch = $("featured-launch");

const planetCards = document.querySelectorAll(".planet-card");

const ACTIVE_NAV = ["bg-blue-500/10", "text-blue-400"];
const INACTIVE_NAV = ["text-slate-300", "hover:bg-slate-800"];

function pad(n) {
  return String(n).padStart(2, "0");
}

function toISODate(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function parseISO(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function formatLong(iso) {
  return parseISO(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatShort(iso) {
  return parseISO(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function escapeHTML(str = "") {
  return String(str).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[c]));
}

const FALLBACK_LAUNCH_IMAGES = [
  "https://images.unsplash.com/photo-1517976487492-5750f3195933?auto=format&fit=crop&w=1200&q=85",
  "https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1200&q=85",
  "https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?auto=format&fit=crop&w=1200&q=85",
  "https://images.unsplash.com/photo-1462331940025-496dfbfc7564?auto=format&fit=crop&w=1200&q=85",
];

function getLaunchImage(launch, index = 0) {
  const candidates = [
    launch?.image,
    launch?.image_url,
    launch?.thumbnail_url,
    launch?.media?.[0]?.image_url,
    launch?.media?.[0]?.url,
    launch?.rocket?.configuration?.image_url,
    launch?.rocket?.configuration?.image?.image_url,
    launch?.rocket?.configuration?.image,
    launch?.launch_service_provider?.image_url,
    launch?.launch_service_provider?.logo_url,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && /^https?:\/\//i.test(candidate)) return candidate;
    if (candidate && typeof candidate === "object") {
      const url = candidate.image_url || candidate.thumbnail_url || candidate.url || candidate.original || candidate.large || candidate.medium;
      if (typeof url === "string" && /^https?:\/\//i.test(url)) return url;
    }
  }
  return FALLBACK_LAUNCH_IMAGES[Math.abs(index) % FALLBACK_LAUNCH_IMAGES.length];
}

async function fetchJSON(url, timeout = 20000, retries = 1) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      const res = await fetch(url, { signal: controller.signal });
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      return await res.json();
    } catch (err) {
      console.error(`Fetch failed (attempt ${attempt + 1}):`, url, err);
      if (attempt === retries) throw err;
      await new Promise((r) => setTimeout(r, 1000));
    } finally {
      clearTimeout(timer);
    }
  }
}


let overlay = null;

function openSidebar() {
  sidebar.classList.add("sidebar-open");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.className = "sidebar-overlay lg:hidden";
    overlay.addEventListener("click", closeSidebar);
    document.body.appendChild(overlay);
  }
}

function closeSidebar() {
  sidebar.classList.remove("sidebar-open");
  if (overlay) {
    overlay.remove();
    overlay = null;
  }
}

function showSection(name) {
  sections.forEach((sec) => {
    sec.classList.toggle("hidden", sec.dataset.section !== name);
  });

  navLinks.forEach((link) => {
    const isActive = link.dataset.section === name;
    ACTIVE_NAV.forEach((c) => link.classList.toggle(c, isActive));
    INACTIVE_NAV.forEach((c) => link.classList.toggle(c, !isActive));
  });

  window.scrollTo({ top: 0, behavior: "smooth" });
}

sidebarToggle.addEventListener("click", () => {
  sidebar.classList.contains("sidebar-open") ? closeSidebar() : openSidebar();
});

navLinks.forEach((link) => {
  link.addEventListener("click", (e) => {
    e.preventDefault();
    showSection(link.dataset.section);
    closeSidebar();
  });
});

window.addEventListener("resize", () => {
  if (window.innerWidth >= 1024) closeSidebar();
});

function setApodLoading(isLoading) {
  const loader = $("apod-loading");
  const img = $("apod-image");
  loader.classList.toggle("hidden", !isLoading);
  img.classList.toggle("hidden", isLoading);
}

function syncDateInput(iso) {
  dateInput.value = iso;
  dateInput.nextElementSibling.textContent = formatShort(iso);
}

function renderApodMedia(data) {
  const container = $("apod-image-container");
  const img = $("apod-image");

  container.querySelectorAll(".apod-video").forEach((el) => el.remove());

  if (data.media_type === "video") {
    img.classList.add("hidden");
    const frame = document.createElement("iframe");
    frame.className = "apod-video w-full h-full";
    frame.src = data.url;
    frame.title = data.title;
    frame.allowFullscreen = true;
    frame.style.border = "0";
    container.insertBefore(frame, container.firstChild);
  } else {
    img.src = data.url;
    img.alt = data.title;
    img.classList.remove("hidden");
  }
}

function renderApod(data) {
  renderApodMedia(data);

  $("apod-date").textContent = `Astronomy Picture of the Day - ${formatLong(data.date)}`;
  $("apod-title").textContent = data.title;
  $("apod-date-detail").innerHTML = `<i class="far fa-calendar mr-2"></i>${data.date}`;
  $("apod-explanation").textContent = data.explanation;
  $("apod-copyright").innerHTML = data.copyright
    ? `&copy; ${escapeHTML(data.copyright.replace(/\n/g, " ").trim())}`
    : "Public Domain";
  $("apod-date-info").textContent = data.date;
  $("apod-media-type").textContent =
    data.media_type.charAt(0).toUpperCase() + data.media_type.slice(1);

  syncDateInput(data.date);

  const hd = data.hdurl || data.url;
  const fullResBtn = $("apod-image-container").querySelector("button");
  if (fullResBtn) fullResBtn.onclick = () => window.open(hd, "_blank", "noopener");
}

function renderApodError(message) {
  $("apod-title").textContent = "Couldn't load the image";
  $("apod-explanation").textContent = message;
  $("apod-copyright").textContent = "";
  $("apod-date-info").textContent = "--";
}

async function loadApod(date) {
  setApodLoading(true);
  try {
    const url = `${APOD_URL}?api_key=${NASA_API_KEY}${date ? `&date=${date}` : ""}`;
    const data = await fetchJSON(url);
    renderApod(data);
  } catch (err) {
    console.error(err);
    renderApodError(
      "NASA's servers didn't respond. Please try another date or try again in a moment."
    );
  } finally {
    setApodLoading(false);
  }
}

function initApodControls() {
  const today = toISODate(new Date());
  dateInput.max = today;
  syncDateInput(today);

  loadDateBtn.addEventListener("click", () => {
    if (dateInput.value) loadApod(dateInput.value);
  });

  todayBtn.addEventListener("click", () => {
    syncDateInput(today);
    loadApod();
  });

  dateInput.addEventListener("change", () => {
    if (dateInput.value) syncDateInput(dateInput.value);
  });
}


const STATUS_COLORS = {
  Go: "#22c55e",
  TBC: "#eab308",
  TBD: "#3b82f6",
  Hold: "#ef4444",
  Success: "#22c55e",
  Failure: "#ef4444",
};

const STATUS_ICONS = ["fa-rocket", "fa-space-shuttle", "fa-satellite-dish"];

function statusColor(abbrev) {
  return STATUS_COLORS[abbrev] || "#64748b";
}

function launchDate(launch) {
  const d = new Date(launch.net);
  return {
    date: d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    }),
    longDate: d.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    }),
    time:
      launch.net_precision && ["Month", "Year", "Quarter"].includes(launch.net_precision.name)
        ? "TBD"
        : `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} UTC`,
    daysLeft: Math.ceil((d - new Date()) / 86400000),
  };
}

function launchInfo(launch) {
  return {
    provider: launch.launch_service_provider?.name || "Unknown",
    rocket: launch.rocket?.configuration?.name || "Unknown",
    pad: launch.pad?.name || "Unknown pad",
    location: launch.pad?.location?.name || "Unknown location",
    country: launch.pad?.location?.country_code || "N/A",
    status: launch.status?.abbrev || "TBD",
  };
}

function renderFeatured(launch) {
  const info = launchInfo(launch);
  const when = launchDate(launch);
  const color = statusColor(info.status);
  const mission = launch.mission?.description || "No mission description available yet.";
  const image = getLaunchImage(launch, 0);

  const countdown =
    when.daysLeft > 0
      ? `<p class="text-2xl font-bold text-blue-400">${when.daysLeft}</p>
         <p class="text-xs text-slate-400">Days Until Launch</p>`
      : `<p class="text-2xl font-bold text-blue-400">Today</p>
         <p class="text-xs text-slate-400">Launch Window Open</p>`;

  featuredLaunch.innerHTML = `
    <div class="relative bg-slate-800/30 border border-slate-700 rounded-3xl overflow-hidden group hover:border-blue-500/50 transition-all">
      <div class="absolute inset-0 bg-linear-to-r from-blue-500/10 via-purple-500/10 to-pink-500/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
      <div class="relative grid grid-cols-1 lg:grid-cols-2 gap-6 p-8">
        <div class="flex flex-col justify-between">
          <div>
            <div class="flex items-center gap-3 mb-4">
              <span class="px-4 py-1.5 bg-blue-500/20 text-blue-400 rounded-full text-sm font-semibold flex items-center gap-2">
                <i class="fas fa-star"></i>
                Featured Launch
              </span>
              <span class="px-4 py-1.5 rounded-full text-sm font-semibold"
                style="background:${color}33;color:${color}">${escapeHTML(info.status)}</span>
            </div>
            <h3 class="text-3xl font-bold mb-3 leading-tight">${escapeHTML(launch.name)}</h3>
            <div class="flex flex-col xl:flex-row xl:items-center gap-4 mb-6 text-slate-400">
              <div class="flex items-center gap-2">
                <i class="fas fa-building"></i>
                <span>${escapeHTML(info.provider)}</span>
              </div>
              <div class="flex items-center gap-2">
                <i class="fas fa-rocket"></i>
                <span>${escapeHTML(info.rocket)}</span>
              </div>
            </div>
            <div class="inline-flex items-center gap-3 px-6 py-3 bg-linear-to-r from-blue-500/20 to-purple-500/20 rounded-xl mb-6">
              <i class="fas fa-clock text-2xl text-blue-400"></i>
              <div>${countdown}</div>
            </div>
            <div class="grid xl:grid-cols-2 gap-4 mb-6">
              <div class="bg-slate-900/50 rounded-xl p-4">
                <p class="text-xs text-slate-400 mb-1 flex items-center gap-2"><i class="fas fa-calendar"></i>Launch Date</p>
                <p class="font-semibold">${when.longDate}</p>
              </div>
              <div class="bg-slate-900/50 rounded-xl p-4">
                <p class="text-xs text-slate-400 mb-1 flex items-center gap-2"><i class="fas fa-clock"></i>Launch Time</p>
                <p class="font-semibold">${when.time}</p>
              </div>
              <div class="bg-slate-900/50 rounded-xl p-4">
                <p class="text-xs text-slate-400 mb-1 flex items-center gap-2"><i class="fas fa-map-marker-alt"></i>Location</p>
                <p class="font-semibold text-sm">${escapeHTML(info.location)}</p>
              </div>
              <div class="bg-slate-900/50 rounded-xl p-4">
                <p class="text-xs text-slate-400 mb-1 flex items-center gap-2"><i class="fas fa-globe"></i>Country</p>
                <p class="font-semibold">${escapeHTML(info.country)}</p>
              </div>
            </div>
            <p class="text-slate-300 leading-relaxed mb-6">${escapeHTML(mission)}</p>
          </div>
          <div class="flex flex-col md:flex-row gap-3">
            <button class="flex-1 self-start md:self-center px-6 py-3 bg-blue-500 rounded-xl hover:bg-blue-600 transition-colors font-semibold flex items-center justify-center gap-2">
              <i class="fas fa-info-circle"></i>
              View Full Details
            </button>
            <div class="icons self-end md:self-center">
              <button class="px-4 py-3 bg-slate-700 rounded-xl hover:bg-slate-600 transition-colors"><i class="far fa-heart"></i></button>
              <button class="px-4 py-3 bg-slate-700 rounded-xl hover:bg-slate-600 transition-colors"><i class="fas fa-bell"></i></button>
            </div>
          </div>
        </div>
        <div class="relative">
          <div class="relative h-full min-h-[400px] rounded-2xl overflow-hidden bg-slate-900/50">
            ${
              image
                ? `<img src="${escapeHTML(image)}" alt="${escapeHTML(launch.name)}" class="w-full h-full object-cover absolute inset-0" onerror="this.onerror=null;this.src='${FALLBACK_LAUNCH_IMAGES[0]}'" />`
                : `<div class="flex items-center justify-center h-full min-h-[400px] bg-slate-800">
                     <i class="fas fa-rocket text-9xl text-slate-700/50"></i>
                   </div>`
            }
            <div class="absolute inset-0 bg-linear-to-t from-slate-900 via-transparent to-transparent"></div>
          </div>
        </div>
      </div>
    </div>`;
}

function launchCard(launch, index) {
  const info = launchInfo(launch);
  const when = launchDate(launch);
  const color = statusColor(info.status);
  const icon = STATUS_ICONS[index % STATUS_ICONS.length];

  return `
    <div class="bg-slate-800/50 border border-slate-700 rounded-2xl overflow-hidden hover:border-blue-500/30 transition-all group cursor-pointer">
      <div class="relative h-48 bg-slate-900/50 flex items-center justify-center">
        ${
          getLaunchImage(launch, index)
            ? `<img src="${escapeHTML(getLaunchImage(launch, index))}" alt="${escapeHTML(launch.name)}" class="w-full h-full object-cover" loading="lazy" onerror="this.onerror=null;this.src='${FALLBACK_LAUNCH_IMAGES[(index + 1) % FALLBACK_LAUNCH_IMAGES.length]}'" />`
            : `<i class="fas ${icon} text-5xl text-slate-700"></i>`
        }
        <div class="absolute top-3 right-3">
          <span class="px-3 py-1 text-white backdrop-blur-sm rounded-full text-xs font-semibold"
            style="background:${color}e6">${escapeHTML(info.status)}</span>
        </div>
      </div>
      <div class="p-5">
        <div class="mb-3">
          <h4 class="font-bold text-lg mb-2 line-clamp-2 group-hover:text-blue-400 transition-colors">${escapeHTML(launch.name)}</h4>
          <p class="text-sm text-slate-400 flex items-center gap-2">
            <i class="fas fa-building text-xs"></i>
            ${escapeHTML(info.provider)}
          </p>
        </div>
        <div class="space-y-2 mb-4">
          <div class="flex items-center gap-2 text-sm">
            <i class="fas fa-calendar text-slate-500 w-4"></i>
            <span class="text-slate-300">${when.date}</span>
          </div>
          <div class="flex items-center gap-2 text-sm">
            <i class="fas fa-clock text-slate-500 w-4"></i>
            <span class="text-slate-300">${when.time}</span>
          </div>
          <div class="flex items-center gap-2 text-sm">
            <i class="fas fa-rocket text-slate-500 w-4"></i>
            <span class="text-slate-300">${escapeHTML(info.rocket)}</span>
          </div>
          <div class="flex items-center gap-2 text-sm">
            <i class="fas fa-map-marker-alt text-slate-500 w-4"></i>
            <span class="text-slate-300 line-clamp-1">${escapeHTML(info.pad)}</span>
          </div>
        </div>
        <div class="flex items-center gap-2 pt-4 border-t border-slate-700">
          <button class="flex-1 px-4 py-2 bg-slate-700 rounded-lg hover:bg-slate-600 transition-colors text-sm font-semibold">Details</button>
          <button class="px-3 py-2 bg-slate-700 rounded-lg hover:bg-slate-600 transition-colors"><i class="far fa-heart"></i></button>
        </div>
      </div>
    </div>`;
}

function updateLaunchCount(n) {
  const desktop = $("launches-count");
  const mobile = $("launches-count-mobile");
  if (desktop) desktop.textContent = `${n} Launches`;
  if (mobile) mobile.textContent = String(n);
}

function showLaunchesLoading() {
  const spinner = `
    <div class="col-span-full text-center py-12">
      <i class="fas fa-spinner fa-spin text-4xl text-blue-400 mb-4"></i>
      <p class="text-slate-400">Loading launches...</p>
    </div>`;
  launchesGrid.innerHTML = spinner;
  featuredLaunch.innerHTML = "";
}

async function loadLaunches() {
  showLaunchesLoading();
  try {
    const data = await fetchJSON(LAUNCHES_URL);
    const launches = data.results || data.launches || [];

    if (!launches.length) throw new Error("No launches returned");

    updateLaunchCount(launches.length);
    renderFeatured(launches[0]);
    launchesGrid.innerHTML = launches.slice(1).map(launchCard).join("");
  } catch (err) {
    console.error(err);
    featuredLaunch.innerHTML = "";
    launchesGrid.innerHTML = `
      <div class="col-span-full text-center py-12">
        <i class="fas fa-triangle-exclamation text-4xl text-yellow-400 mb-4"></i>
        <p class="text-slate-300 mb-1">Couldn't load upcoming launches</p>
        <p class="text-slate-400 text-sm">The launch API is rate limited, please try again in a few minutes.</p>
      </div>`;
  }
}
const PLANET_TEXT = {
  mercury:
    "Mercury is the smallest planet in the Solar System and the closest to the Sun. Its orbit around the Sun takes 87.97 Earth days, the shortest of all the planets in the Solar System.",
  venus:
    "Venus is the second planet from the Sun. It is named after the Roman goddess of love and beauty. As the second-brightest natural object in the night sky after the Moon, Venus can cast shadows.",
  earth:
    "Earth is the third planet from the Sun and the only astronomical object known to harbor life. About 29% of Earth's surface is land consisting of continents and islands. The remaining 71% is covered with water.",
  mars:
    "Mars is the fourth planet from the Sun and the second-smallest planet in the Solar System. Named after the Roman god of war, it is often referred to as the \"Red Planet\" due to its reddish appearance.",
  jupiter:
    "Jupiter is the fifth planet from the Sun and the largest in the Solar System. It is a gas giant with a mass one-thousandth that of the Sun, but two-and-a-half times that of all the other planets combined.",
  saturn:
    "Saturn is the sixth planet from the Sun and the second-largest in the Solar System. It is a gas giant with an average radius about nine times that of Earth, and is best known for its extensive ring system.",
  uranus:
    "Uranus is the seventh planet from the Sun. It has the third-largest planetary radius and fourth-largest planetary mass in the Solar System. Uranus is unique in that it rotates on its side.",
  neptune:
    "Neptune is the eighth and farthest known planet from the Sun in the Solar System. It is the fourth-largest planet by diameter and the third-most-massive planet.",
};

const AU_KM = 149597870.7;
const EARTH_MASS_KG = 5.97237e24;
const PLANET_IDS = ["mercury", "venus", "earth", "mars", "jupiter", "saturn", "uranus", "neptune"];

const PLANETS_URL = PLANET_URL;

const PLANET_TYPES = {
  mercury: "Terrestrial",
  venus: "Terrestrial",
  earth: "Terrestrial",
  mars: "Terrestrial",
  jupiter: "Gas Giant",
  saturn: "Gas Giant",
  uranus: "Ice Giant",
  neptune: "Ice Giant",
};

const TYPE_BADGES = {
  Terrestrial: "bg-orange-500/50 text-orange-200",
  "Gas Giant": "bg-purple-500/50 text-purple-200",
  "Ice Giant": "bg-cyan-500/50 text-cyan-200",
};

const planetCache = {}; 
let activePlanet = null;

function fmt(value, digits = 2) {
  if (value === undefined || value === null || Number.isNaN(Number(value))) return "N/A";
  return Number(value).toLocaleString("en-US", { maximumFractionDigits: digits });
}

function sci(value, exponent) {
  if (!value && value !== 0) return "N/A";
  return `${fmt(value, 3)} × 10${toSuperscript(exponent)}`;
}

function toSuperscript(num) {
  const map = { "-": "⁻", 0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴", 5: "⁵", 6: "⁶", 7: "⁷", 8: "⁸", 9: "⁹" };
  return String(num).split("").map((c) => map[c]).join("");
}

function millionKm(km) {
  if (!km) return "N/A";
  return `${fmt(km / 1e6, 1)}M km`;
}

function orbitalPeriod(days) {
  if (!days) return "N/A";
  return days >= 730
    ? `${fmt(days, 0)} days (${fmt(days / 365.25, 1)} yrs)`
    : `${fmt(days, 2)} days`;
}

function rotationPeriod(hours) {
  if (!hours && hours !== 0) return "N/A";
  const abs = Math.abs(hours);
  return `${fmt(abs, 2)} hours${hours < 0 ? " (retrograde)" : ""}`;
}

function discoverer(body) {
  return body.discoveredBy ? body.discoveredBy : "Known since antiquity";
}

function discoveryDate(body) {
  return body.discoveryDate ? body.discoveryDate : "Ancient";
}

function setText(id, value) {
  const el = $(id);
  if (el) el.textContent = value;
}

const AVG_TEMP_FALLBACK_K = { mercury: 440 };

const PLANET_FIELD_IDS = [
  "planet-distance", "planet-radius", "planet-mass", "planet-density",
  "planet-orbital-period", "planet-rotation", "planet-moons", "planet-gravity",
  "planet-discoverer", "planet-discovery-date", "planet-body-type", "planet-volume",
  "planet-perihelion", "planet-aphelion", "planet-eccentricity", "planet-inclination",
  "planet-axial-tilt", "planet-temp", "planet-escape",
];

function resetPlanetPanel() {
  PLANET_FIELD_IDS.forEach((fid) => setText(fid, "—"));
  const facts = $("planet-facts");
  if (facts) facts.innerHTML = "";
}

function renderPlanet(id, body) {
  const card = document.querySelector(`.planet-card[data-planet-id="${id}"]`);
  const img = card.querySelector("img");

  $("planet-detail-image").src = img.src;
  $("planet-detail-image").alt = `${id} planet`;

  setText("planet-detail-name", body.englishName || id);
  setText("planet-detail-description", PLANET_TEXT[id] || "");

  setText("planet-distance", millionKm(body.semimajorAxis));
  setText("planet-radius", `${fmt(body.meanRadius, 1)} km`);
  setText("planet-mass", body.mass ? sci(body.mass.massValue, body.mass.massExponent) + " kg" : "N/A");
  setText("planet-density", `${fmt(body.density, 2)} g/cm³`);
  setText("planet-orbital-period", orbitalPeriod(body.sideralOrbit));
  setText("planet-rotation", rotationPeriod(body.sideralRotation));
  setText("planet-moons", body.moons ? body.moons.length : 0);
  setText("planet-gravity", `${fmt(body.gravity, 2)} m/s²`);

  setText("planet-discoverer", discoverer(body));
  setText("planet-discovery-date", discoveryDate(body));
  setText("planet-body-type", body.bodyType || "Planet");
  setText(
    "planet-volume",
    body.vol ? `${fmt(body.vol.volValue, 3)} × 10${toSuperscript(body.vol.volExponent)} km³` : "N/A"
  );

  setText("planet-perihelion", millionKm(body.perihelion));
  setText("planet-aphelion", millionKm(body.aphelion));
  setText("planet-eccentricity", fmt(body.eccentricity, 4));
  setText("planet-inclination", `${fmt(body.inclination, 2)}°`);
  setText("planet-axial-tilt", `${fmt(body.axialTilt, 2)}°`);
  const avgTempK = body.avgTemp || AVG_TEMP_FALLBACK_K[id];
  setText("planet-temp", avgTempK ? `${fmt(avgTempK - 273.15, 0)}°C` : "N/A");
  setText("planet-escape", `${fmt((body.escape || 0) / 1000, 1)} km/s`);

  const facts = [
    ["Mass", body.mass ? `${sci(body.mass.massValue, body.mass.massExponent)} kg` : "N/A"],
    ["Surface gravity", `${fmt(body.gravity, 2)} m/s²`],
    ["Density", `${fmt(body.density, 4)} g/cm³`],
    ["Axial tilt", `${fmt(body.axialTilt, 2)}°`],
  ];
  $("planet-facts").innerHTML = facts
    .map(
      ([label, value]) => `
      <li class="flex items-start">
        <i class="fas fa-check text-green-400 mt-1 mr-2"></i>
        <span class="text-slate-300">${label}: ${escapeHTML(value)}</span>
      </li>`
    )
    .join("");
}

function highlightPlanet(id) {
  planetCards.forEach((card) => {
    const selected = card.dataset.planetId === id;
    const color = getComputedStyle(card).getPropertyValue("--planet-color").trim();
    card.style.borderColor = selected ? color : "#334155";
    card.style.boxShadow = selected ? `0 0 0 1px ${color}66` : "none";
  });
}

function planetColor(id) {
  const card = document.querySelector(`.planet-card[data-planet-id="${id}"]`);
  return (card && card.style.getPropertyValue("--planet-color").trim()) || "#64748b";
}

function decimals(value, min, max) {
  return Number(value).toLocaleString("en-US", {
    minimumFractionDigits: min,
    maximumFractionDigits: max,
  });
}

function periodLabel(days) {
  if (!days) return "N/A";
  return days >= 730 ? `${fmt(days / 365.25, 1)} years` : `${fmt(days, 1)} days`;
}

function massInEarths(mass) {
  if (!mass) return "N/A";
  const ratio = (mass.massValue * 10 ** mass.massExponent) / EARTH_MASS_KG;
  return ratio < 10 ? decimals(ratio, 3, 3) : decimals(ratio, 1, 1);
}

function renderPlanetCards(bodies) {
  bodies.forEach((b) => {
    const card = document.querySelector(`.planet-card[data-planet-id="${b.key}"]`);
    const label = card && card.querySelector("p");
    if (label && b.semimajorAxis) label.textContent = `${decimals(b.semimajorAxis / AU_KM, 2, 2)} AU`;
  });
}

function showComparisonLoading() {
  const tbody = $("planet-comparison-tbody");
  if (!tbody) return;
  tbody.innerHTML = `
    <tr>
      <td colspan="7" class="px-6 py-10 text-center text-slate-400">
        <i class="fas fa-spinner fa-spin text-2xl text-blue-400 mb-3"></i>
        <p>Loading planet data...</p>
      </td>
    </tr>`;
}

function showComparisonError() {
  const tbody = $("planet-comparison-tbody");
  if (!tbody) return;
  tbody.innerHTML = `
    <tr>
      <td colspan="7" class="px-6 py-10 text-center">
        <i class="fas fa-triangle-exclamation text-2xl text-yellow-400 mb-3"></i>
        <p class="text-slate-300 mb-3">Couldn't load planet data right now.</p>
        <button id="planets-retry-btn" class="px-4 py-2 bg-blue-500 rounded-lg hover:bg-blue-600 transition-colors text-sm font-semibold">
          <i class="fas fa-rotate-right mr-2"></i>Try again
        </button>
      </td>
    </tr>`;
  $("planets-retry-btn").addEventListener("click", loadPlanets);
}

function comparisonRow(b) {
  const type = PLANET_TYPES[b.key] || "Planet";
  const badge = TYPE_BADGES[type] || "bg-slate-500/50 text-slate-200";
  const highlight = b.key === "earth" ? " bg-blue-500/5" : "";
  const cell = "px-4 md:px-6 py-3 md:py-4 text-slate-300 text-sm md:text-base whitespace-nowrap";

  return `
    <tr class="hover:bg-slate-800/30 transition-colors${highlight}">
      <td class="px-4 md:px-6 py-3 md:py-4 sticky left-0 bg-slate-800 z-10">
        <div class="flex items-center space-x-2 md:space-x-3">
          <div class="w-6 h-6 md:w-8 md:h-8 rounded-full flex-shrink-0" style="background-color: ${planetColor(b.key)}"></div>
          <span class="font-semibold text-sm md:text-base whitespace-nowrap">${escapeHTML(b.englishName)}</span>
        </div>
      </td>
      <td class="${cell}">${b.semimajorAxis ? decimals(b.semimajorAxis / AU_KM, 2, 2) : "N/A"}</td>
      <td class="${cell}">${b.meanRadius ? fmt(b.meanRadius * 2, 0) : "N/A"}</td>
      <td class="${cell}">${massInEarths(b.mass)}</td>
      <td class="${cell}">${periodLabel(b.sideralOrbit)}</td>
      <td class="${cell}">${b.moons ? b.moons.length : 0}</td>
      <td class="px-4 md:px-6 py-3 md:py-4 whitespace-nowrap">
        <span class="px-2 py-1 rounded text-xs ${badge}">${type}</span>
      </td>
    </tr>`;
}

function renderComparisonTable(bodies) {
  const tbody = $("planet-comparison-tbody");
  if (tbody) tbody.innerHTML = bodies.map(comparisonRow).join("");
}

async function loadPlanets() {
  showComparisonLoading();
  try {
    const data = await fetchJSON(PLANETS_URL);

    const rawBodies = Array.isArray(data)
      ? data
      : (data.bodies || data.planets || data.results || data.data || []);

    const bodies = rawBodies
      .map((b) => {
        const englishName = b.englishName || b.name || b.planetName || "";
        const key = englishName.toLowerCase();
        return {
          ...b,
          englishName,
          key,
          semimajorAxis: b.semimajorAxis ?? b.distanceFromSun ?? b.distance_from_sun,
          meanRadius: b.meanRadius ?? b.radius ?? b.mean_radius,
          mass: b.mass ?? (b.massValue != null
            ? { massValue: b.massValue, massExponent: b.massExponent ?? 0 }
            : undefined),
          sideralOrbit: b.sideralOrbit ?? b.orbitalPeriod ?? b.orbital_period,
          sideralRotation: b.sideralRotation ?? b.rotationPeriod ?? b.rotation_period,
          moons: b.moons ?? (Number.isFinite(b.moonCount) ? Array(b.moonCount).fill(null) : []),
          bodyType: b.bodyType || b.type || "Planet",
          vol: b.vol,
          avgTemp: b.avgTemp ?? b.averageTemperature ?? b.average_temperature,
          perihelion: b.perihelion,
          aphelion: b.aphelion,
          eccentricity: b.eccentricity,
          inclination: b.inclination,
          axialTilt: b.axialTilt ?? b.axial_tilt,
          gravity: b.gravity,
          density: b.density,
          discoverer: b.discoverer,
          discoveryDate: b.discoveryDate ?? b.discovery_date,
          escape: b.escape,
        };
      })
      .filter((b) => PLANET_IDS.includes(b.key))
      .sort((a, b) => (a.semimajorAxis || 0) - (b.semimajorAxis || 0));

    if (!bodies.length) throw new Error("No planets returned");

    bodies.forEach((b) => (planetCache[b.key] = b));
    renderPlanetCards(bodies);
    renderComparisonTable(bodies);

    if (activePlanet && planetCache[activePlanet]) renderPlanet(activePlanet, planetCache[activePlanet]);
  } catch (err) {
    console.error(err);
    showComparisonError();
  }
}

function highlightPlanet(id) {
  planetCards.forEach((card) => {
    const selected = card.dataset.planetId === id;
    const color = getComputedStyle(card).getPropertyValue("--planet-color").trim();
    card.style.borderColor = selected ? color : "#334155";
    card.style.boxShadow = selected ? `0 0 0 1px ${color}66` : "none";
  });
}

async function selectPlanet(id) {
  activePlanet = id;
  highlightPlanet(id);

  const card = document.querySelector(`.planet-card[data-planet-id="${id}"]`);
  $("planet-detail-image").src = card.querySelector("img").src;
  $("planet-detail-image").alt = `${id} planet`;
  setText("planet-detail-name", card.querySelector("h4").textContent);
  setText("planet-detail-description", PLANET_TEXT[id] || "");

  if (planetCache[id]) {
    renderPlanet(id, planetCache[id]);
    return;
  }

  resetPlanetPanel();
  try {
    const allData = await fetchJSON(PLANETS_URL);
    const allBodies = Array.isArray(allData)
      ? allData
      : (allData.bodies || allData.planets || allData.results || allData.data || []);
    const body = allBodies.find((item) =>
      (item.englishName || item.name || item.planetName || "").toLowerCase() === id
    );
    if (!body) throw new Error("Planet not found in API response");
    planetCache[id] = body;
    if (activePlanet === id) renderPlanet(id, body);
  } catch (err) {
    console.error(err);
    if (activePlanet === id) {
      setText("planet-detail-description", "Couldn't load planet data right now. Click the planet again to retry.");
    }
  }
}

function initPlanets() {
  planetCards.forEach((card) => {
    const id = card.dataset.planetId;
    card.addEventListener("click", () => selectPlanet(id));

    card.onmouseover = () => {
      card.style.borderColor = `${planetColor(id)}80`;
    };
    card.onmouseout = () => {
      card.style.borderColor = id === activePlanet ? planetColor(id) : "#334155";
    };
  });

  activePlanet = "earth";
  highlightPlanet("earth");
  loadPlanets().then(() => {
    if (!planetCache[activePlanet]) selectPlanet(activePlanet);
  });
}

document.addEventListener("DOMContentLoaded", () => {
  initApodControls();
  loadApod();
  loadLaunches();
  initPlanets();
  showSection("today-in-space");
});
