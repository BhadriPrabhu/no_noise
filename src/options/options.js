const CIRCUMFERENCE = 2 * Math.PI * 46; // r = 46 -> ~289.03

function formatBytes(kb) {
  if (kb < 1024) return `${Math.round(kb)} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  return `${(mb / 1024).toFixed(2)} GB`;
}

function formatTime(seconds) {
  if (seconds < 60) return `~${Math.round(seconds)}s saved`;
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `~${mins}m saved`;
  return `~${(mins / 60).toFixed(1)}h saved`;
}

async function renderWhitelist() {
  const { whitelist = [] } = await chrome.storage.sync.get("whitelist");
  const list = document.getElementById("whitelistList");
  list.textContent = "";

  if (!whitelist.length) {
    const empty = document.createElement("li");
    empty.textContent = "No whitelisted sites yet.";
    list.appendChild(empty);
    return;
  }

  whitelist.forEach((domain) => {
    const li = document.createElement("li");
    const span = document.createElement("span");
    span.textContent = domain;

    const btn = document.createElement("button");
    btn.textContent = "Remove";
    btn.addEventListener("click", async () => {
      await chrome.runtime.sendMessage({ type: "TOGGLE_WHITELIST", domain });
      renderWhitelist();
    });

    li.appendChild(span);
    li.appendChild(btn);
    list.appendChild(li);
  });
}

async function loadAnalytics() {
  const { stats = { total: 0, ads: 0, trackers: 0, annoyances: 0, bySite: {} } } =
    await chrome.storage.local.get("stats");

  const total = stats.total || 0;
  const ads = stats.ads || 0;
  const trackers = stats.trackers || 0;
  const annoyances = stats.annoyances || 0;

  // 1. KPI Cards
  document.getElementById("stat-total").textContent = total.toLocaleString();
  document.getElementById("stat-ads").textContent = ads.toLocaleString();
  document.getElementById("stat-trackers").textContent = trackers.toLocaleString();

  const adsPct = total ? Math.round((ads / total) * 100) : 0;
  const trackersPct = total ? Math.round((trackers / total) * 100) : 0;
  document.getElementById("stat-ads-pct").textContent = `${adsPct}% of total`;
  document.getElementById("stat-trackers-pct").textContent = `${trackersPct}% of total`;

  // Standard ad-blocker estimates: ~45 KB & ~0.05s per blocked request
  document.getElementById("stat-data").textContent = formatBytes(total * 45);
  document.getElementById("stat-time").textContent = formatTime(total * 0.05);

  // 2. SVG Donut Chart
  document.getElementById("donut-total").textContent = total.toLocaleString();
  document.getElementById("leg-ads").textContent = ads.toLocaleString();
  document.getElementById("leg-trackers").textContent = trackers.toLocaleString();
  document.getElementById("leg-annoyances").textContent = annoyances.toLocaleString();

  const catSum = ads + trackers + annoyances;
  const segAds = document.getElementById("seg-ads");
  const segTrackers = document.getElementById("seg-trackers");
  const segAnnoyances = document.getElementById("seg-annoyances");

  if (catSum > 0) {
    const adsLen = (ads / catSum) * CIRCUMFERENCE;
    const trackersLen = (trackers / catSum) * CIRCUMFERENCE;
    const annoyancesLen = (annoyances / catSum) * CIRCUMFERENCE;

    segAds.setAttribute("stroke-dasharray", `${adsLen} ${CIRCUMFERENCE}`);
    segAds.setAttribute("stroke-dashoffset", "0");

    segTrackers.setAttribute("stroke-dasharray", `${trackersLen} ${CIRCUMFERENCE}`);
    segTrackers.setAttribute("stroke-dashoffset", `${-adsLen}`);

    segAnnoyances.setAttribute("stroke-dasharray", `${annoyancesLen} ${CIRCUMFERENCE}`);
    segAnnoyances.setAttribute("stroke-dashoffset", `${-(adsLen + trackersLen)}`);
  } else {
    [segAds, segTrackers, segAnnoyances].forEach((el) => {
      el.setAttribute("stroke-dasharray", `0 ${CIRCUMFERENCE}`);
    });
  }

  // 3. Top Sites Horizontal Bar Chart
  const container = document.getElementById("top-sites-list");
  container.textContent = "";

  const topSites = Object.entries(stats.bySite || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

  if (!topSites.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "Browse the web to start collecting domain analytics.";
    container.appendChild(empty);
    return;
  }

  const maxCount = topSites[0][1];

  topSites.forEach(([site, count]) => {
    const row = document.createElement("div");
    row.className = "domain-row";

    const meta = document.createElement("div");
    meta.className = "domain-meta";

    const nameEl = document.createElement("span");
    nameEl.className = "domain-name";
    nameEl.textContent = site;

    const countEl = document.createElement("span");
    countEl.className = "domain-count";
    countEl.textContent = `${count.toLocaleString()} blocked`;

    meta.appendChild(nameEl);
    meta.appendChild(countEl);

    const track = document.createElement("div");
    track.className = "bar-track";

    const fill = document.createElement("div");
    fill.className = "bar-fill";
    fill.style.width = `${Math.max(4, (count / maxCount) * 100)}%`;

    track.appendChild(fill);
    row.appendChild(meta);
    row.appendChild(track);
    container.appendChild(row);
  });
}

// Reset Stats Button
document.getElementById("resetStatsBtn").addEventListener("click", async () => {
  await chrome.storage.local.set({
    stats: { total: 0, ads: 0, trackers: 0, annoyances: 0, bySite: {} }
  });
  loadAnalytics();
});

// Live-update dashboard whenever background stats or whitelist change
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.stats) loadAnalytics();
  if (area === "sync" && changes.whitelist) renderWhitelist();
});

async function syncEngineReadout() {
  const enabled = await chrome.declarativeNetRequest.getEnabledRulesets();
  const rulesets = ["ads", "trackers", "annoyances"];
  let activeCount = 0;

  rulesets.forEach((id) => {
    const isOn = enabled.includes(id);
    if (isOn) activeCount++;
    document.getElementById(`bar-${id}`).classList.toggle("on", isOn);
  });

  const readout = document.getElementById("engineStatus");
  const label = document.getElementById("engineLabel");

  readout.classList.toggle("is-off", activeCount === 0);
  label.textContent = activeCount === 0 ? "PAUSED" : `${activeCount}/3 ACTIVE`;
}

syncEngineReadout();
renderWhitelist();
loadAnalytics();