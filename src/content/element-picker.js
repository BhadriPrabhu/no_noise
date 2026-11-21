(() => {
  if (window.__noNoisePickerActive) return;
  window.__noNoisePickerActive = true;

  let lastEl = null;

  const onMove = (e) => {
    if (lastEl) lastEl.style.outline = "";
    lastEl = e.target;
    lastEl.style.outline = "2px solid #ef4444";
  };

  const onClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    e.target.style.display = "none";
    cleanup();
  };

  const onKeyDown = (e) => {
    if (e.key === "Escape") cleanup();
  };

  function cleanup() {
    if (lastEl) lastEl.style.outline = "";
    document.removeEventListener("mouseover", onMove, true);
    document.removeEventListener("click", onClick, true);
    document.removeEventListener("keydown", onKeyDown, true);
    window.__noNoisePickerActive = false;
  }

  document.addEventListener("mouseover", onMove, true);
  document.addEventListener("click", onClick, true);
  document.addEventListener("keydown", onKeyDown, true);
})();