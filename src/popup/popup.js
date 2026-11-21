const RULESETS = ["ads", "trackers", "annoyances"];

async function init() {
  // 1. Load ruleset toggle states
  const enabled = await chrome.declarativeNetRequest.getEnabledRulesets();
  RULESETS.forEach((id) => {
    const checkbox = document.getElementById(`toggle-${id}`);
    checkbox.checked = enabled.includes(id);
    checkbox.addEventListener("change", () => {
      chrome.declarativeNetRequest.updateEnabledRulesets(
        checkbox.checked ? { enableRulesetIds: [id] } : { disableRulesetIds: [id] }
      );
    });
  });

  // 2. Setup current-site whitelist button
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const domain = tab?.url ? new URL(tab.url).hostname : null;
  const whitelistBtn = document.getElementById("whitelistBtn");

  if (domain) {
    const { whitelist = [] } = await chrome.storage.sync.get("whitelist");
    updateWhitelistBtn(whitelistBtn, whitelist.includes(domain));

    whitelistBtn.addEventListener("click", async () => {
      const res = await chrome.runtime.sendMessage({ type: "TOGGLE_WHITELIST", domain });
      updateWhitelistBtn(whitelistBtn, res.whitelisted);
      chrome.tabs.reload(tab.id);
    });
  }

  // 3. Activate Element Picker
  document.getElementById("pickerBtn").addEventListener("click", async () => {
    if (!tab?.id) return;
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["src/content/element-picker.js"]
    });
    window.close();
  });

  // 4. Open Options Page
  document.getElementById("optionsBtn").addEventListener("click", () => {
    chrome.runtime.openOptionsPage();
  });
}

function updateWhitelistBtn(btn, isWhitelisted) {
  btn.textContent = isWhitelisted ? "Resume on this site" : "Pause on this site";
}

init();