/*
 * Minimal Huawei router client for the browser.
 *
 * A page served from a normal origin cannot call the router: it sends no CORS
 * headers and rejects preflight with 405. This code runs inside an extension,
 * which may request the router directly because the extension declares
 * `host_permissions`, so the browser skips the same-origin rules.
 *
 * The sequence mirrors `huawei-lte-api`'s Session/User modules, which is what
 * the working Python client uses:
 *
 *   GET  api/webserver/SesTokInfo  -> { SesInfo (cookie), TokInfo (token) }
 *   GET  api/user/state-login      -> State, password_type
 *   POST api/user/login            -> OK, or an error code
 *   any  api/<path>                -> header __RequestVerificationToken
 *
 * Responses are XML; they are parsed into plain objects here.
 */

const router = (() => {
  const DEFAULT_ADDRESS = "http://192.168.8.1";

  const state = {
    base: DEFAULT_ADDRESS,
    token: null,
    username: "",
    signedIn: false,
  };

  class RouterError extends Error {
    constructor(message, code) {
      super(message);
      this.name = "RouterError";
      this.code = code;
    }
  }

  function normalizeAddress(value) {
    let text = String(value || "").trim();
    if (!text) return DEFAULT_ADDRESS;
    if (!/^https?:\/\//i.test(text)) text = "http://" + text;
    return text.replace(/\/+$/, "");
  }

  function setAddress(value) {
    state.base = normalizeAddress(value);
    reset();
    return state.base;
  }

  function reset() {
    state.token = null;
    state.signedIn = false;
    state.username = "";
  }

  /* ---------------------------------------------------------------- XML */

  function elementToValue(element) {
    const children = Array.from(element.children);
    if (!children.length) return element.textContent.trim();

    const grouped = new Map();
    for (const child of children) {
      const name = child.nodeName;
      if (!grouped.has(name)) grouped.set(name, []);
      grouped.get(name).push(child);
    }

    const result = {};
    for (const [name, nodes] of grouped) {
      result[name] = nodes.length === 1
        ? elementToValue(nodes[0])
        : nodes.map(elementToValue);
    }
    return result;
  }

  function parseXml(text) {
    const trimmed = String(text || "").trim();
    if (!trimmed) return {};
    const doc = new DOMParser().parseFromString(trimmed, "text/xml");
    if (doc.querySelector("parsererror")) return null;
    const root = doc.documentElement;
    const value = elementToValue(root);
    // Most routers wrap errors as <response><error>…</error></response>, but
    // some answer with <error> as the root. Normalise both to { error: … }.
    return root.nodeName === "error" ? { error: value } : value;
  }

  function buildXmlRequest(fields) {
    const escape = (value) =>
      String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
    const inner = Object.entries(fields)
      .map(([key, value]) => `<${key}>${escape(value)}</${key}>`)
      .join("");
    return `<?xml version="1.0" encoding="UTF-8"?><request>${inner}</request>`;
  }

  /* ------------------------------------------------------------ requests */

  async function call(path, options = {}) {
    const { method = "GET", body = null } = options;
    const headers = {};
    if (state.token) headers["__RequestVerificationToken"] = state.token;
    if (body) headers["Content-Type"] = "application/xml";

    let response;
    try {
      response = await fetch(`${state.base}/api/${path}`, {
        method,
        headers,
        body,
        credentials: "include",
        cache: "no-store",
      });
    } catch (err) {
      throw new RouterError(
        `Cannot reach the router at ${state.base}. Check the address and that this computer is on its network.`
      );
    }

    // The router hands out fresh tokens in the response headers.
    const nextToken =
      response.headers.get("__RequestVerificationTokenone") ||
      response.headers.get("__RequestVerificationToken") ||
      null;
    if (nextToken) state.token = nextToken;

    const text = await response.text();
    const data = parseXml(text);

    if (data && data.error) {
      const code = Number(data.error.code);
      throw new RouterError(explain(code), code);
    }
    if (!response.ok) {
      throw new RouterError(`The router answered ${response.status}.`);
    }
    return data === null ? { raw: text } : data;
  }

  function explain(code) {
    switch (code) {
      case 100003:
        return "The router needs a login for that. Sign in again.";
      case 100002:
        return "This router does not support that.";
      case 108001:
        return "The router rejected the username.";
      case 108002:
      case 108006:
        return "The router rejected the username or password.";
      case 108003:
        return "Someone is already signed in to the router.";
      case 108007:
        return "Too many failed sign-in attempts. Wait a few minutes.";
      case 115002:
        return "The router wants the password changed before it will sign in.";
      default:
        return `The router refused the request (code ${code}).`;
    }
  }

  /* --------------------------------------------------------------- login */

  function toBase64(text) {
    return btoa(unescape(encodeURIComponent(text)));
  }

  async function sha256Hex(text) {
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
    return Array.from(new Uint8Array(digest))
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
  }

  async function encodePassword(username, password, passwordType) {
    if (!password) return "";
    if (passwordType !== 4) return toBase64(password);

    // type 4: base64(sha256(username + base64(hex(sha256(password))) + token))
    const inner = toBase64(await sha256Hex(password));
    return toBase64(await sha256Hex(username + inner + (state.token || "")));
  }

  async function login(address, username, password) {
    setAddress(address);
    const user = String(username || "").trim() || "admin";

    // Session cookie and the first token.
    const ses = await call("webserver/SesTokInfo");
    state.token = ses && ses.TokInfo ? String(ses.TokInfo) : null;

    let passwordType = 3;
    try {
      const loginState = await call("user/state-login");
      passwordType = Number(loginState.password_type ?? 3);
    } catch (err) {
      // Routers without state-login take the password as-is; keep type 3.
    }

    const body = buildXmlRequest({
      Username: user,
      Password: await encodePassword(user, password, passwordType),
      password_type: passwordType,
    });

    await call("user/login", { method: "POST", body });
    state.username = user;
    state.signedIn = true;
    return { username: user, address: state.base };
  }

  async function logout() {
    try {
      await call("user/logout", { method: "POST", body: buildXmlRequest({}) });
    } finally {
      reset();
    }
  }

  /* --------------------------------------------------------------- reads */

  const OVERVIEW_ENDPOINTS = [
    ["device_information", "device/information"],
    ["device_signal", "device/signal"],
    ["monitoring_status", "monitoring/status"],
    ["traffic_statistics", "monitoring/traffic-statistics"],
    ["month_statistics", "monitoring/month-statistics"],
    ["current_plmn", "net/current-plmn"],
    ["sms_count", "sms/sms-count"],
    ["wlan_host_list", "wlan/host-list"],
    ["lan_host_info", "lan/host-info"],
    ["mobile_dataswitch", "dial-up/mobile-dataswitch"],
    ["start_date", "monitoring/start-date"],
    ["device_basic_information", "device/basic-information"],
  ];

  async function readOverview() {
    const data = {};
    await Promise.all(
      OVERVIEW_ENDPOINTS.map(async ([key, path]) => {
        try {
          data[key] = await call(path);
        } catch (err) {
          // A path this model lacks must not hide the ones it has.
          data[key] = null;
        }
      })
    );
    return data;
  }

  const CELL_PATHS = {
    serving: "net/cell-info",
    secondary: "device/seccellinfo",
    neighbours: "device/nbrcellinfo",
  };

  async function readCells() {
    const out = { serving: null, secondary: null, neighbours: null, unavailable: [] };
    await Promise.all(
      Object.entries(CELL_PATHS).map(async ([label, path]) => {
        try {
          out[label] = await call(path);
        } catch (err) {
          out[label] = null;
          out.unavailable.push({
            what: label,
            reason: err.code === 100003 ? "needs_login" : "unavailable",
          });
        }
      })
    );
    return out;
  }

  /* -------------------------------------------------------------- writes */

  async function setMobileData(enable) {
    await call("dial-up/mobile-dataswitch", {
      method: "POST",
      body: buildXmlRequest({ dataswitch: enable ? 1 : 0 }),
    });
  }

  /**
   * Wi-Fi is one master switch over all radios. The router keeps the block in
   * `wlan/status-switch-settings`, so it is read, every `wifienable` flag is
   * flipped, and the whole block is written back — the same round-trip the
   * Python client performs, because a payload built from scratch leaves fields
   * out and the router rejects it.
   */
  async function setWifi(enable) {
    const block = await call("wlan/status-switch-settings");
    const value = enable ? "1" : "0";
    let changed = 0;

    const flip = (node) => {
      if (!node || typeof node !== "object") return;
      for (const [key, child] of Object.entries(node)) {
        if (key.toLowerCase() === "wifienable") {
          node[key] = value;
          changed += 1;
        } else if (typeof child === "object") {
          flip(child);
        }
      }
    };
    flip(block);

    if (!changed) {
      throw new RouterError("This router does not report a Wi-Fi switch.");
    }
    await call("wlan/status-switch-settings", {
      method: "POST",
      body: buildXmlRequest(block),
    });
  }

  async function reboot() {
    await call("device/control", {
      method: "POST",
      body: buildXmlRequest({ ControlMode: 1 }),
    });
  }

  async function reconnect() {
    await call("net/reconnect", {
      method: "POST",
      body: buildXmlRequest({ ReconnectAction: 1 }),
    });
  }

  return {
    DEFAULT_ADDRESS,
    RouterError,
    normalizeAddress,
    setAddress,
    reset,
    login,
    logout,
    readOverview,
    readCells,
    setMobileData,
    setWifi,
    reboot,
    reconnect,
    get state() {
      return { ...state };
    },
  };
})();
