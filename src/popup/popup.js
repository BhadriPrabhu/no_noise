const RULESETS = ["ads", "trackers", "annoyances"];

async function init() {
    // 1. Load ruleset toggle states
    const enabled = await chrome.declarativeNetRequest.getEnabledRulesets();
    RULESETS.forEach((id) => {
        const checkbox = document.getElementById(`toggle-${id}`);
        checkbox.checked = enabled.includes(id);
        checkbox.addEventListener("change", async () => {
            await chrome.declarativeNetRequest.updateEnabledRulesets(
                checkbox.checked ? { enableRulesetIds: [id] } : { disableRulesetIds: [id] }
            );
            if (id === "ads") {
                await chrome.storage.sync.set({ adsEnabled: checkbox.checked });
            }
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

    // 5. Toggle Blocked Requests List
    const logBtn = document.getElementById("logBtn");
    const logPanel = document.getElementById("logPanel");
    const logList = document.getElementById("logList");
    const logCount = document.getElementById("logCount");

    logBtn.addEventListener("click", async () => {
        const isHidden = logPanel.hidden;
        logPanel.hidden = !isHidden;

        if (isHidden && tab?.id) {
            const logs = await chrome.runtime.sendMessage({ type: "GET_TAB_LOGS", tabId: tab.id });
            logCount.textContent = logs.length;
            logList.innerHTML = logs.length
                ? logs.map((item) => `
            <li class="log-item">
              <span title="${item.url}">${item.domain}</span>
              <span class="log-cat">${item.category}</span>
            </li>`).join("")
                : `<li class="log-item">No requests blocked yet.</li>`;
        }
    });
}

function updateWhitelistBtn(btn, isWhitelisted) {
    btn.textContent = isWhitelisted ? "Resume on this site" : "Pause on this site";
}

init();