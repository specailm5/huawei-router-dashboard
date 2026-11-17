/*
 * Dashboard behaviour. Talks to the router through `router.js`; there is no
 * local server and no Python in this path.
 */

"use strict";

const $ = (id) => document.getElementById(id);

const state = {
  view: "overview",
  signedIn: false,
  address: router.DEFAULT_ADDRESS,
  username: "",
  hostTouched: false,
  userTouched: false,
  timers: {},
};

/* ---------------------------------------------------------------- helpers */

function say(text, kind) {
  const msg = $("msg");
  msg.textContent = text || "";
  msg.className = kind || "";
}

function put(id, value, suffix) {
  const node = $(id);
  node.textContent = value === null || value === undefined || value === ""
    ? "–"
    : String(value);
  if (suffix && value) {
    const small = document.createElement("small");
    small.textContent = " " + suffix;
    node.appendChild(small);
  }
}

function keyValueTable(target, rows) {
  const table = $(target);
  table.innerHTML = "";
  const body = document.createElement("tbody");
  for (const row of rows) {
    const tr = document.createElement("tr");
    const key = document.createElement("td");
    key.className = "k";
    key.textContent = row.label;
    const value = document.createElement("td");
    value.textContent = row.value;
    tr.append(key, value);
    body.appendChild(tr);
  }
  table.appendChild(body);
}

function grid(target, columns, rows) {
  const table = $(target);
  table.innerHTML = "";
  if (!columns || !columns.length) return;

  const head = document.createElement("tr");
  columns.forEach((name, index) => {
    const th = document.createElement("th");
    th.textContent = name;
    if (index > 0) th.className = "num";
    head.appendChild(th);
  });
  const thead = document.createElement("thead");
  thead.appendChild(head);
  table.appendChild(thead);

  const body = document.createElement("tbody");
  for (const row of rows) {
    const tr = document.createElement("tr");
    row.forEach((value, index) => {
      const td = document.createElement("td");
      td.textContent = value;
      if (index > 0) td.className = "num";
      tr.appendChild(td);
    });
    body.appendChild(tr);
  }
  table.appendChild(body);
}

/* ------------------------------------------------------------- credentials */

const STORE_KEY = "huawei-dashboard";

async function loadSaved() {
  try {
    const saved = await chrome.storage.local.get(STORE_KEY);
    return saved[STORE_KEY] || null;
  } catch (err) {
    return null;
  }
}

async function saveSettings(value) {
  try {
    await chrome.storage.local.set({ [STORE_KEY]: value });
  } catch (err) {
    /* storage unavailable; the page still works for this visit */
  }
}

async function clearSaved() {
  try {
    await chrome.storage.local.remove(STORE_KEY);
  } catch (err) {
    /* nothing to clear */
  }
}

/* ------------------------------------------------------------------ views */

function setView(view) {
  if (view !== "overview" && view !== "cells") view = "overview";
  state.view = view;
  $("view-overview").hidden = view !== "overview";
  $("view-cells").hidden = view !== "cells";
  for (const tab of document.querySelectorAll(".tab")) {
    tab.classList.toggle("active", tab.dataset.view === view);
  }
  if (location.hash !== "#" + view) history.replaceState(null, "", "#" + view);
  say("");
  if (view === "cells") loadCells();
  else loadOverview();
}

function startTimers() {
  clearInterval(state.timers.overview);
  clearInterval(state.timers.cells);
  state.timers.overview = setInterval(() => {
    if (state.view === "overview" && state.signedIn) loadOverview();
  }, 5000);
  state.timers.cells = setInterval(() => {
    if (state.view === "cells" && state.signedIn) loadCells();
  }, 10000);
}

/* --------------------------------------------------------------- overview */

function renderConnectionState() {
  const holder = $("state");
  holder.innerHTML = "";
  if (state.signedIn) {
    holder.append("Signed in as ");
    const strong = document.createElement("strong");
    strong.textContent = state.username || "admin";
    holder.append(strong, " at " + state.address);
  } else {
    holder.textContent = "Read-only. Sign in to change settings.";
  }

  if (!state.hostTouched) $("host").value = state.address;
  if (!state.userTouched) $("username").value = state.username || "";

  for (const button of document.querySelectorAll("button[data-action]")) {
    button.disabled = !state.signedIn;
  }
  $("disconnect").disabled = !state.signedIn;
  $("controls-note").textContent = state.signedIn
    ? ""
    : "These controls need the router's admin password. Enter it above and press Connect.";
}

async function loadOverview() {
  if (!state.signedIn) {
    keyValueTable("details", []);
    $("details-empty").hidden = false;
    renderConnectionState();
    $("updated").textContent = "Not signed in";
    return;
  }

  try {
    const data = await router.readOverview();
    const head = display.headline(data);
    put("tile-connection", head.connection);
    put("tile-network", head.networkType);
    put("tile-signal", head.bars, head.rsrp || "");
    put("tile-clients", head.clients);

    const rows = display.summarize(data);
    keyValueTable("details", rows);
    $("details-empty").hidden = rows.length > 0;
    $("updated").textContent = "Updated " + new Date().toLocaleTimeString();
  } catch (err) {
    say(err.message, "err");
    $("updated").textContent = "Router not reachable";
  }
}

/* ------------------------------------------------------------------ cells */

function renderCellsNotice(data) {
  const box = $("cells-notice");
  box.innerHTML = "";
  const unavailable = data.unavailable || [];
  if (!unavailable.length) return;

  const warn = document.createElement("div");
  warn.className = "warn";
  if (unavailable.some((item) => item.reason === "needs_login" || item.reason === "unavailable")) {
    warn.textContent =
      "Cell details need the router's login. Sign in on the Overview tab, then come back.";
  } else {
    warn.textContent =
      "This router did not answer for: " + unavailable.map((item) => item.what).join(", ") + ".";
  }
  box.appendChild(warn);
}

async function loadCells() {
  if (!state.signedIn) {
    const box = $("cells-notice");
    box.innerHTML = "";
    const warn = document.createElement("div");
    warn.className = "warn";
    warn.textContent = "Cell details need the router's login. Sign in on the Overview tab, then come back.";
    box.appendChild(warn);
    $("serving").innerHTML = "";
    $("secondary-section").hidden = true;
    $("neighbours").innerHTML = "";
    $("neighbours-empty").hidden = false;
    $("serving-empty").hidden = false;
    $("updated").textContent = "Not signed in";
    return;
  }

  try {
    const raw = await router.readCells();
    const model = cellData.model(raw);
    renderCellsNotice(model);

    keyValueTable("serving", model.serving);
    $("serving-empty").hidden = model.serving.length > 0;

    $("secondary-section").hidden = model.secondary.rows.length === 0;
    if (model.secondary.rows.length) {
      grid("secondary", model.secondary.columns, model.secondary.rows);
    }

    if (model.neighbours.rows.length) {
      grid("neighbours", model.neighbours.columns, model.neighbours.rows);
      $("neighbours-empty").hidden = true;
    } else {
      $("neighbours").innerHTML = "";
      $("neighbours-empty").hidden = false;
    }

    $("updated").textContent = "Updated " + new Date().toLocaleTimeString();
  } catch (err) {
    say(err.message, "err");
    $("updated").textContent = "Router not reachable";
  }
}

/* ------------------------------------------------------------- connection */

$("connect-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const address = $("host").value.trim() || router.DEFAULT_ADDRESS;
  const username = $("username").value.trim();
  const password = $("password").value;
  const remember = $("remember").checked;

  say("Connecting…");
  $("connect").disabled = true;
  try {
    const result = await router.login(address, username, password);
    state.signedIn = true;
    state.address = result.address;
    state.username = result.username;
    $("password").value = "";
    state.hostTouched = false;
    state.userTouched = false;

    if (remember) {
      await saveSettings({ address: result.address, username: result.username, password });
      say("Signed in. The password is remembered on this computer until you press Forget password.", "ok");
    } else {
      await clearSaved();
      say("Signed in. The password is not saved.", "ok");
    }
    await loadOverview();
  } catch (err) {
    say(err.message, "err");
  } finally {
    $("connect").disabled = false;
  }
});

$("disconnect").addEventListener("click", async () => {
  say("Signing out…");
  try {
    await router.logout();
  } catch (err) {
    /* an expired session logs out the same way for us */
  }
  state.signedIn = false;
  state.username = "";
  await clearSaved();
  $("password").value = "";
  say("Password forgotten. The page is read-only.", "ok");
  await loadOverview();
});

for (const id of ["host", "username"]) {
  $(id).addEventListener("input", () => {
    if (id === "host") state.hostTouched = true;
    else state.userTouched = true;
  });
}

/* ---------------------------------------------------------------- controls */

const ACTIONS = {
  "wifi-on": [() => router.setWifi(true), "Wi-Fi turned on."],
  "wifi-off": [() => router.setWifi(false), "Wi-Fi turned off."],
  "mobile-on": [() => router.setMobileData(true), "Mobile data turned on."],
  "mobile-off": [() => router.setMobileData(false), "Mobile data turned off."],
  reconnect: [() => router.reconnect(), "Reconnecting the mobile data session."],
  reboot: [() => router.reboot(), "Restarting the router. This page will reconnect when it is back."],
};

for (const button of document.querySelectorAll("button[data-action]")) {
  button.addEventListener("click", async () => {
    const name = button.dataset.action;
    const action = ACTIONS[name];
    if (!action) return;
    if (name === "reboot" &&
        !confirm("Restart the router? Everyone connected will lose their connection.")) {
      return;
    }

    button.disabled = true;
    say("Sending…");
    try {
      await action[0]();
      say(action[1], "ok");
      if (name !== "reboot") await loadOverview();
    } catch (err) {
      say(err.message, "err");
    } finally {
      button.disabled = !state.signedIn;
    }
  });
}

/* -------------------------------------------------------------------- boot */

for (const tab of document.querySelectorAll(".tab")) {
  tab.addEventListener("click", () => setView(tab.dataset.view));
}
window.addEventListener("hashchange", () => {
  setView(location.hash.replace("#", ""));
});

async function boot() {
  const saved = await loadSaved();
  if (saved && saved.password) {
    $("host").value = saved.address || router.DEFAULT_ADDRESS;
    $("username").value = saved.username || "";
    try {
      const result = await router.login(saved.address, saved.username, saved.password);
      state.signedIn = true;
      state.address = result.address;
      state.username = result.username;
    } catch (err) {
      state.signedIn = false;
      state.address = router.normalizeAddress(saved.address);
      say("Could not sign in with the remembered password. Enter it again.", "err");
    }
  } else {
    state.address = router.DEFAULT_ADDRESS;
    $("host").value = state.address;
  }

  renderConnectionState();
  setView(location.hash.replace("#", "") || "overview");
  startTimers();
}

boot();
