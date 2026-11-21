// Show blocked request count per tab automatically on the extension badge
chrome.runtime.onInstalled.addListener(() => {
  chrome.declarativeNetRequest.setExtensionActionOptions({
    displayActionCountAsBadgeText: true
  });
});

// Listen for whitelist updates from popup or options page
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "TOGGLE_WHITELIST") {
    toggleSiteWhitelist(message.domain).then(sendResponse);
    return true; // Keeps message channel open for async response
  }
});

async function toggleSiteWhitelist(domain) {
  const { whitelist = [] } = await chrome.storage.sync.get("whitelist");
  const exists = whitelist.includes(domain);
  const updated = exists
    ? whitelist.filter((d) => d !== domain)
    : [...whitelist, domain];

  await chrome.storage.sync.set({ whitelist: updated });
  await rebuildDynamicWhitelistRules(updated);
  return { whitelisted: !exists, whitelist: updated };
}

async function rebuildDynamicWhitelistRules(whitelist) {
  const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
  const removeRuleIds = existingRules.map((r) => r.id);

  const addRules = whitelist.map((domain, index) => ({
    id: 50000 + index,
    priority: 100, // Higher than static block rules
    action: { type: "allowAllRequests" },
    condition: {
      urlFilter: `||${domain}^`,
      resourceTypes: ["main_frame"]
    }
  }));

  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds,
    addRules
  });
}