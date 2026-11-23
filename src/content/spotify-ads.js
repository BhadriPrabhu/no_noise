(() => {
  let isBlockingActive = true;
  let savedMutedState = null;

  async function syncBlockingState() {
    const { adsEnabled = true, whitelist = [] } = await chrome.storage.sync.get([
      "adsEnabled",
      "whitelist"
    ]);
    isBlockingActive = adsEnabled && !whitelist.includes(window.location.hostname);
  }

  function isSpotifyAdPlaying() {
    const titleIsAd =
      document.title.toLowerCase().includes("advertisement") ||
      document.title.toLowerCase().includes("spotify – ad");
    const adBadge = document.querySelector(
      '[data-testid="ad-slot-container"], [data-testid="context-item-info-ad-subtitle"], a[href*="adclick.g.doubleclick.net"]'
    );
    return titleIsAd || Boolean(adBadge);
  }

  function handleSpotifyAds() {
    if (!isBlockingActive) return;

    const adActive = isSpotifyAdPlaying();
    const mediaElements = document.querySelectorAll("audio, video");

    mediaElements.forEach((media) => {
      if (adActive) {
        if (savedMutedState === null) savedMutedState = media.muted;
        media.muted = true;
        if (isFinite(media.duration) && media.duration > 0) {
          media.playbackRate = 16;
          media.currentTime = media.duration;
        }
      } else if (savedMutedState !== null) {
        media.muted = savedMutedState;
        media.playbackRate = 1;
        savedMutedState = null;
      }
    });
  }

  syncBlockingState();
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "sync" && (changes.adsEnabled || changes.whitelist)) {
      syncBlockingState();
    }
  });

  const observer = new MutationObserver(handleSpotifyAds);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  setInterval(handleSpotifyAds, 500);
})();