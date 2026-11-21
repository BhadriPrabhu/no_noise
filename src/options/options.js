async function renderWhitelist() {
  const { whitelist = [] } = await chrome.storage.sync.get("whitelist");
  const list = document.getElementById("whitelistList");
  list.innerHTML = whitelist.length ? "" : "<li>No whitelisted sites yet.</li>";

  whitelist.forEach((domain) => {
    const li = document.createElement("li");
    li.textContent = domain;

    const btn = document.createElement("button");
    btn.textContent = "Remove";
    btn.addEventListener("click", async () => {
      await chrome.runtime.sendMessage({ type: "TOGGLE_WHITELIST", domain });
      renderWhitelist();
    });

    li.appendChild(btn);
    list.appendChild(li);
  });
}

renderWhitelist();