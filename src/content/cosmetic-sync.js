(() => {
  async function syncCosmeticState() {
    const { adsEnabled = true, whitelist = [] } = await chrome.storage.sync.get([
      "adsEnabled",
      "whitelist"
    ]);
    const active = adsEnabled && !whitelist.includes(window.location.hostname);

    if (active) {
      document.documentElement.setAttribute("data-nonoise-ads", "true");
    } else {
      document.documentElement.removeAttribute("data-nonoise-ads");
    }
  }

  syncCosmeticState();
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "sync" && (changes.adsEnabled || changes.whitelist)) {
      syncCosmeticState();
    }
  });
})();