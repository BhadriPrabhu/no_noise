const tabBlockedLogs = {}; // { tabId: [{ domain, url, category, time }] }
let cosmeticRulesCache = null;

// 1. Show blocked request count per tab on the extension badge
chrome.runtime.onInstalled.addListener(() => {
  chrome.declarativeNetRequest.setExtensionActionOptions({
    displayActionCountAsBadgeText: true
  });
});

// 2. Log every blocked request & update lifetime analytics
if (chrome.declarativeNetRequest.onRuleMatchedDebug) {
  chrome.declarativeNetRequest.onRuleMatchedDebug.addListener(async (info) => {
    const tabId = info.request.tabId;
    if (tabId < 0) return;

    const category = info.rule.rulesetId; // "ads", "trackers", or "annoyances"
    const domain = new URL(info.request.url).hostname;

    if (!tabBlockedLogs[tabId]) tabBlockedLogs[tabId] = [];
    tabBlockedLogs[tabId].unshift({
      domain,
      url: info.request.url,
      category,
      time: new Date().toLocaleTimeString()
    });
    if (tabBlockedLogs[tabId].length > 50) tabBlockedLogs[tabId].pop();

    // Update lifetime stats for the Analytics page
    const { stats = { total: 0, ads: 0, trackers: 0, annoyances: 0, bySite: {} } } =
      await chrome.storage.local.get("stats");

    stats.total += 1;
    if (stats[category] !== undefined) stats[category] += 1;

    try {
      const tab = await chrome.tabs.get(tabId);
      const site = new URL(tab.url).hostname;
      stats.bySite[site] = (stats.bySite[site] || 0) + 1;
    } catch {}

    await chrome.storage.local.set({ stats });
  });
}

// 3. Handle messages from popup.js and options.js
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "TOGGLE_WHITELIST") {
    toggleSiteWhitelist(message.domain).then(sendResponse);
    return true; // Keep channel open for async response
  }

  if (message.type === "GET_TAB_LOGS") {
    sendResponse(tabBlockedLogs[message.tabId] || []);
    return true;
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

// 4. Per-site cosmetic CSS injection
async function getCosmeticRules() {
  if (cosmeticRulesCache) return cosmeticRulesCache;
  try {
    const url = chrome.runtime.getURL("rules/cosmetic-rules.json");
    const res = await fetch(url);
    cosmeticRulesCache = await res.json();
  } catch {
    cosmeticRulesCache = {};
  }
  return cosmeticRulesCache;
}

chrome.tabs.onRemoved.addListener((tabId) => delete tabBlockedLogs[tabId]);

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status !== "loading") return;

  // Reset per-tab blocked log on reload
  tabBlockedLogs[tabId] = [];

  if (!tab.url || !tab.url.startsWith("http")) return;

  const { adsEnabled = true, whitelist = [] } = await chrome.storage.sync.get([
    "adsEnabled",
    "whitelist"
  ]);
  const hostname = new URL(tab.url).hostname.toLowerCase();
  if (!adsEnabled || whitelist.includes(hostname)) return;

  const rules = await getCosmeticRules();
  const selectors = [];

  const parts = hostname.split(".");
  for (let i = 0; i <= parts.length - 2; i++) {
    const candidate = parts.slice(i).join(".");
    if (rules[candidate]) {
      selectors.push(...rules[candidate]);
    }
  }

  if (selectors.length > 0) {
    const css = `${selectors.join(", ")} { display: none !important; }`;
    chrome.scripting.insertCSS({ target: { tabId }, css }).catch(() => {});
  }
});