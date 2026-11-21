(() => {
  let isBlockingActive = true;
  let savedMutedState = null;

  async function syncBlockingState() {
    const { adsEnabled = true, whitelist = [] } = await chrome.storage.sync.get([
      "adsEnabled",
      "whitelist"
    ]);
    const isWhitelisted = whitelist.includes(window.location.hostname);
    isBlockingActive = adsEnabled && !isWhitelisted;

    if (isBlockingActive) {
      document.documentElement.setAttribute("data-nonoise-ads", "true");
    } else {
      document.documentElement.removeAttribute("data-nonoise-ads");
    }
  }

  function handleYouTubeAds() {
    if (!isBlockingActive) return;

    const player = document.querySelector("#movie_player");
    const video = document.querySelector("video.html5-main-video");
    if (!player || !video) return;

    const isAdPlaying =
      player.classList.contains("ad-showing") ||
      player.classList.contains("ad-interrupting");

    if (isAdPlaying) {
      if (savedMutedState === null) {
        savedMutedState = video.muted;
      }

      video.muted = true;
      if (isFinite(video.duration) && video.duration > 0) {
        video.currentTime = video.duration;
      } else {
        video.playbackRate = 16;
      }

      const skipBtn = document.querySelector(
        ".ytp-ad-skip-button, .ytp-ad-skip-button-modern, .ytp-skip-ad-button"
      );
      if (skipBtn) {
        skipBtn.click();
      }
    } else if (savedMutedState !== null) {
      video.muted = savedMutedState;
      video.playbackRate = 1;
      savedMutedState = null;
    }
  }

  // Initialize state and react immediately when toggled in the popup
  syncBlockingState();
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "sync" && (changes.adsEnabled || changes.whitelist)) {
      syncBlockingState();
    }
  });

  const observer = new MutationObserver(handleYouTubeAds);
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["class"]
  });

  setInterval(handleYouTubeAds, 500);
})();