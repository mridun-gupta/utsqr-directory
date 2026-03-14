(function () {
  "use strict";

  const FAVORITES_KEY = "utsqr_favorites";
  const manifest = window.UTS_MANIFEST;
  if (!manifest || !Array.isArray(manifest.states)) {
    const result = document.getElementById("result");
    result.className = "result-missing";
    result.textContent = "Data manifest not found. Please check data/manifest.js.";
    return;
  }

  const stateInput = document.getElementById("state-input");
  const stationInput = document.getElementById("station-input");
  const stateOptions = document.getElementById("state-options");
  const stationOptions = document.getElementById("station-options");
  const searchForm = document.getElementById("search-form");
  const result = document.getElementById("result");
  const metaInfo = document.getElementById("meta-info");
  const actionStatus = document.getElementById("action-status");
  const shareBtn = document.getElementById("share-btn");
  const favoriteBtn = document.getElementById("favorite-btn");
  const favoritesList = document.getElementById("favorites-list");
  const clearFavoritesBtn = document.getElementById("clear-favorites-btn");
  const installBtn = document.getElementById("install-btn");

  let deferredInstallPrompt = null;

  const states = manifest.states
    .map((state) => ({
      code: state.code,
      name: state.name,
      stationCount: state.stationCount || 0,
      stations: Array.isArray(state.stations) ? state.stations : []
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const stateByCode = new Map(states.map((state) => [state.code, state]));
  const allStations = [];
  let favorites = loadFavorites();

  states.forEach((state) => {
    state.stations.forEach((station) => {
      allStations.push({
        stateCode: state.code,
        stateName: state.name,
        code: station.code,
        file: station.file,
        status: station.status
      });
    });
  });

  const uniqueAllStations = allStations
    .slice()
    .sort((a, b) => {
      const byCode = a.code.localeCompare(b.code);
      if (byCode !== 0) {
        return byCode;
      }
      return a.stateCode.localeCompare(b.stateCode);
    });

  function normalize(value) {
    return String(value || "").trim().replace(/\s+/g, " ");
  }

  function setActionStatus(text) {
    actionStatus.textContent = text || "";
  }

  function parseStateCode(inputValue) {
    const raw = normalize(inputValue).toUpperCase();
    if (!raw) {
      return "";
    }

    const codePrefix = raw.split("-")[0].trim();
    if (stateByCode.has(codePrefix)) {
      return codePrefix;
    }

    if (stateByCode.has(raw)) {
      return raw;
    }

    const byName = states.find((state) => state.name.toUpperCase() === raw);
    return byName ? byName.code : "";
  }

  function parseStationCode(inputValue) {
    const raw = normalize(inputValue).toUpperCase();
    if (!raw) {
      return "";
    }

    const match = raw.match(/^[A-Z0-9]+/);
    return match ? match[0] : "";
  }

  function setInputLabels(stateCode, stationCode) {
    const state = stateByCode.get(stateCode);
    if (state) {
      stateInput.value = `${state.code} - ${state.name} (${state.stationCount})`;
    }
    if (stationCode) {
      stationInput.value = `${stationCode}${stateCode ? ` (${stateCode})` : ""}`;
    }
  }

  function stateOptionLabel(state) {
    return `${state.code} - ${state.name} (${state.stationCount})`;
  }

  function stationOptionLabel(entry) {
    return `${entry.code} (${entry.stateCode}) - ${entry.status}`;
  }

  function setStateOptions() {
    stateOptions.innerHTML = "";
    states.forEach((state) => {
      const opt = document.createElement("option");
      opt.value = stateOptionLabel(state);
      stateOptions.appendChild(opt);
    });
  }

  function setStationOptions(stateCode) {
    stationOptions.innerHTML = "";
    const source = stateCode
      ? (stateByCode.get(stateCode)?.stations || []).map((station) => ({
          code: station.code,
          stateCode,
          status: station.status
        }))
      : uniqueAllStations;

    source.forEach((entry) => {
      const opt = document.createElement("option");
      opt.value = stationOptionLabel(entry);
      stationOptions.appendChild(opt);
    });
  }

  function setMetaText(stateCode) {
    if (!stateCode) {
      metaInfo.textContent =
        `Loaded ${states.length} states/UTs and ${uniqueAllStations.length} station entries.`;
      return;
    }

    const state = stateByCode.get(stateCode);
    if (!state) {
      metaInfo.textContent = "";
      return;
    }

    const available = state.stations.filter((station) => station.status === "available").length;
    const missing = state.stations.filter((station) => station.status === "missing").length;

    metaInfo.textContent = `${state.code} - ${state.name}: ${state.stationCount} total, ${available} available, ${missing} missing.`;
  }

  function getShareUrl(stateCode, stationCode) {
    const url = new URL(window.location.href);
    if (stateCode) {
      url.searchParams.set("state", stateCode);
    } else {
      url.searchParams.delete("state");
    }

    if (stationCode) {
      url.searchParams.set("station", stationCode);
    } else {
      url.searchParams.delete("station");
    }

    return url.toString();
  }

  function pushShareState(stateCode, stationCode) {
    const url = getShareUrl(stateCode, stationCode);
    window.history.replaceState({}, "", url);
  }

  function loadFavorites() {
    try {
      const raw = localStorage.getItem(FAVORITES_KEY);
      const parsed = JSON.parse(raw || "[]");
      if (!Array.isArray(parsed)) {
        return [];
      }
      return parsed.filter((item) => typeof item?.stateCode === "string" && typeof item?.stationCode === "string");
    } catch (error) {
      return [];
    }
  }

  function saveFavorites() {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
  }

  function favoriteExists(stateCode, stationCode) {
    return favorites.some((item) => item.stateCode === stateCode && item.stationCode === stationCode);
  }

  function renderFavorites() {
    favoritesList.innerHTML = "";

    if (!favorites.length) {
      const p = document.createElement("p");
      p.className = "fav-empty";
      p.textContent = "No favorites yet. Add common routes for one-tap access.";
      favoritesList.appendChild(p);
      return;
    }

    favorites.forEach((fav, index) => {
      const pill = document.createElement("div");
      pill.className = "fav-pill";

      const open = document.createElement("button");
      open.type = "button";
      open.textContent = `${fav.stationCode} (${fav.stateCode})`;
      open.addEventListener("click", () => {
        const state = stateByCode.get(fav.stateCode);
        if (!state) {
          return;
        }
        setInputLabels(fav.stateCode, fav.stationCode);
        runSearch();
      });

      const remove = document.createElement("button");
      remove.type = "button";
      remove.textContent = "Remove";
      remove.addEventListener("click", () => {
        favorites.splice(index, 1);
        saveFavorites();
        renderFavorites();
        setActionStatus("Favorite removed.");
      });

      pill.appendChild(open);
      pill.appendChild(remove);
      favoritesList.appendChild(pill);
    });
  }

  function updateFavoriteButtonState(stateCode, stationCode) {
    const valid = !!stateCode && !!stationCode;
    favoriteBtn.disabled = !valid;
    if (!valid) {
      return;
    }
    favoriteBtn.textContent = favoriteExists(stateCode, stationCode) ? "Saved in Favorites" : "Add to Favorites";
  }

  function renderMissing(state, stationCode) {
    result.className = "result-missing";
    result.innerHTML = `
      <div>
        <p class="result-title">${stationCode} (${state.code})</p>
        <p class="result-subtitle">${state.name}</p>
        <p class="status-missing">QR not uploaded yet (.png.missing).</p>
      </div>
    `;
  }

  function renderNotFound(stateCode, stationCode) {
    result.className = "result-missing";

    if (!stateCode) {
      result.innerHTML = "<p>Please select a valid state or UT first.</p>";
      return;
    }

    const state = stateByCode.get(stateCode);
    const stateLabel = state ? `${state.code} - ${state.name}` : stateCode;
    result.innerHTML = `
      <div>
        <p class="result-title">No entry found</p>
        <p class="result-subtitle">State: ${stateLabel}</p>
        <p class="result-subtitle">Station: ${stationCode || "-"}</p>
      </div>
    `;
  }

  function renderAvailable(state, station) {
    result.className = "result-card";
    result.innerHTML = `
      <p class="result-title">${station.code} (${state.code})</p>
      <p class="result-subtitle">${state.name}</p>
      <img id="qr-img" src="${station.file}" alt="QR code for ${station.code} in ${state.name}" loading="lazy" />
      <p class="status-ok">QR ready for scan</p>
    `;

    const qrImg = document.getElementById("qr-img");
    qrImg.addEventListener("error", () => {
      const msg = document.createElement("p");
      msg.className = "status-error";
      msg.textContent = "Image file is unavailable right now.";
      qrImg.replaceWith(msg);
    });
  }

  function runSearch() {
    const stateCode = parseStateCode(stateInput.value);
    const stationCode = parseStationCode(stationInput.value);

    setStationOptions(stateCode);
    setMetaText(stateCode);

    pushShareState(stateCode, stationCode);
    updateFavoriteButtonState(stateCode, stationCode);

    if (!stateCode || !stationCode) {
      renderNotFound(stateCode, stationCode);
      return;
    }

    const state = stateByCode.get(stateCode);
    if (!state) {
      renderNotFound(stateCode, stationCode);
      return;
    }

    const station = state.stations.find((entry) => entry.code === stationCode);
    if (!station) {
      renderNotFound(stateCode, stationCode);
      return;
    }

    if (station.status === "missing") {
      renderMissing(state, station.code);
      return;
    }

    renderAvailable(state, station);
  }

  function applySearchFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const stateCode = parseStateCode(params.get("state") || "");
    const stationCode = parseStationCode(params.get("station") || "");

    if (!stateCode && !stationCode) {
      return;
    }

    if (stateCode) {
      setStationOptions(stateCode);
      setMetaText(stateCode);
    }

    setInputLabels(stateCode, stationCode);
    runSearch();
  }

  function copyShareLink() {
    const stateCode = parseStateCode(stateInput.value);
    const stationCode = parseStationCode(stationInput.value);
    const url = getShareUrl(stateCode, stationCode);

    if (!navigator.clipboard || typeof navigator.clipboard.writeText !== "function") {
      setActionStatus("Clipboard is not available in this browser.");
      return;
    }

    navigator.clipboard
      .writeText(url)
      .then(() => {
        setActionStatus("Share link copied.");
      })
      .catch(() => {
        setActionStatus("Could not copy share link.");
      });
  }

  function addCurrentToFavorites() {
    const stateCode = parseStateCode(stateInput.value);
    const stationCode = parseStationCode(stationInput.value);

    if (!stateCode || !stationCode) {
      setActionStatus("Select both state and station to add favorites.");
      return;
    }

    if (favoriteExists(stateCode, stationCode)) {
      setActionStatus("This station is already in favorites.");
      updateFavoriteButtonState(stateCode, stationCode);
      return;
    }

    favorites.unshift({ stateCode, stationCode });
    if (favorites.length > 16) {
      favorites = favorites.slice(0, 16);
    }
    saveFavorites();
    renderFavorites();
    updateFavoriteButtonState(stateCode, stationCode);
    setActionStatus("Added to favorites.");
  }

  function clearFavorites() {
    favorites = [];
    saveFavorites();
    renderFavorites();
    const stateCode = parseStateCode(stateInput.value);
    const stationCode = parseStationCode(stationInput.value);
    updateFavoriteButtonState(stateCode, stationCode);
    setActionStatus("All favorites cleared.");
  }

  function setupPwaInstall() {
    window.addEventListener("beforeinstallprompt", (event) => {
      event.preventDefault();
      deferredInstallPrompt = event;
      installBtn.hidden = false;
    });

    installBtn.addEventListener("click", async () => {
      if (!deferredInstallPrompt) {
        return;
      }

      deferredInstallPrompt.prompt();
      await deferredInstallPrompt.userChoice;
      deferredInstallPrompt = null;
      installBtn.hidden = true;
      setActionStatus("Install prompt shown.");
    });
  }

  function setupServiceWorker() {
    if (!("serviceWorker" in navigator)) {
      return;
    }

    const isSecure = window.isSecureContext || location.hostname === "localhost" || location.hostname === "127.0.0.1";
    if (!isSecure) {
      return;
    }

    navigator.serviceWorker.register("sw.js").catch(() => {
      setActionStatus("Service worker could not be registered.");
    });
  }

  setStateOptions();
  setStationOptions("");
  setMetaText("");
  renderFavorites();
  setupPwaInstall();
  setupServiceWorker();
  applySearchFromUrl();

  stateInput.addEventListener("input", () => {
    const stateCode = parseStateCode(stateInput.value);
    setStationOptions(stateCode);
    setMetaText(stateCode);
    const stationCode = parseStationCode(stationInput.value);
    updateFavoriteButtonState(stateCode, stationCode);
    setActionStatus("");
  });

  stationInput.addEventListener("input", () => {
    const stateCode = parseStateCode(stateInput.value);
    const stationCode = parseStationCode(stationInput.value);
    updateFavoriteButtonState(stateCode, stationCode);
    setActionStatus("");
  });

  searchForm.addEventListener("submit", (event) => {
    event.preventDefault();
    runSearch();
  });

  shareBtn.addEventListener("click", copyShareLink);
  favoriteBtn.addEventListener("click", addCurrentToFavorites);
  clearFavoritesBtn.addEventListener("click", clearFavorites);
})();
