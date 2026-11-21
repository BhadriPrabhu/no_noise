(() => {
  let isBlockingActive = true;
  let scheduled = false;

  async function syncState() {
    const { adsEnabled = true, whitelist = [] } = await chrome.storage.sync.get([
      "adsEnabled",
      "whitelist"
    ]);
    isBlockingActive = adsEnabled && !whitelist.includes(window.location.hostname);
    if (isBlockingActive) scheduleScan();
  }

  function hideElement(el) {
    if (el && el.style.display !== "none") {
      el.style.setProperty("display", "none", "important");
    }
  }

  function scanFeed() {
    scheduled = false;
    if (!isBlockingActive) return;

    const host = window.location.hostname;

    // 1. Instagram: hide <article> containing a "Sponsored" label
    if (host.includes("instagram.com")) {
      document.querySelectorAll("article").forEach((article) => {
        const spans = article.querySelectorAll("span");
        for (const span of spans) {
          if (span.textContent.trim() === "Sponsored") {
            hideElement(article);
            break;
          }
        }
      });
    }

    // 2. LinkedIn: hide feed updates labeled "Promoted"
    else if (host.includes("linkedin.com")) {
      document.querySelectorAll(".feed-shared-update-v2, [data-id^='urn:li:activity']").forEach((post) => {
        const meta = post.querySelectorAll("span.update-components-actor__sub-description, span[aria-hidden='true']");
        for (const el of meta) {
          if (el.textContent.trim() === "Promoted") {
            hideElement(post);
            break;
          }
        }
      });
    }

    // 3. X (Twitter): hide tweets labeled "Ad" or "Promoted"
    else if (host.includes("x.com") || host.includes("twitter.com")) {
      document.querySelectorAll('article[data-testid="tweet"]').forEach((tweet) => {
        const spans = tweet.querySelectorAll("span");
        for (const span of spans) {
          const text = span.textContent.trim();
          if (text === "Ad" || text === "Promoted") {
            hideElement(tweet.closest('[data-testid="cellInnerDiv"]') || tweet);
            break;
          }
        }
      });
    }

    // 4. Reddit: hide promoted posts (New & Old Reddit)
    else if (host.includes("reddit.com")) {
      document.querySelectorAll("shreddit-ad-post, .promotedlink").forEach(hideElement);
    }
  }

  // Debounce scans with requestAnimationFrame so scrolling stays smooth
  function scheduleScan() {
    if (scheduled || !isBlockingActive) return;
    scheduled = true;
    requestAnimationFrame(scanFeed);
  }

  syncState();

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "sync" && (changes.adsEnabled || changes.whitelist)) {
      syncState();
    }
  });

  const observer = new MutationObserver(scheduleScan);
  observer.observe(document.documentElement, { childList: true, subtree: true });
})();