/*
 * Turning a router poll into the values a person reads.
 * Ported from the Python client's display module so both show the same thing.
 */

const display = (() => {
  const NETWORK_TYPES = {
    0: "No Service", 1: "GSM", 2: "GPRS", 3: "EDGE", 4: "WCDMA", 5: "HSDPA",
    6: "HSUPA", 7: "HSPA", 8: "TD-SCDMA", 9: "HSPA+", 10: "EVDO rev. 0",
    11: "EVDO rev. A", 12: "EVDO rev. B", 13: "1xRTT", 14: "UMB", 15: "1xEVDV",
    16: "3xRTT", 17: "HSPA+ 64QAM", 18: "HSPA+ MIMO", 19: "LTE", 21: "IS95A",
    22: "IS95B", 23: "CDMA1x", 24: "EVDO rev. 0", 25: "EVDO rev. A",
    26: "EVDO rev. B", 27: "Hybrid CDMA1x", 28: "Hybrid EVDO rev. 0",
    29: "Hybrid EVDO rev. A", 30: "Hybrid EVDO rev. B", 31: "eHRPD rev. 0",
    32: "eHRPD rev. A", 33: "eHRPD rev. B", 41: "LTE-A", 51: "5G NR NSA",
    52: "5G NR SA", 71: "LTE + 5G NR", 101: "5G",
  };

  const CONNECTION = {
    900: "Connecting", 901: "Connected", 902: "Disconnected",
    903: "Disconnecting", 904: "Connection failed",
  };

  function pick(block, ...keys) {
    if (!block || typeof block !== "object") return null;
    for (const key of keys) {
      const value = block[key];
      if (value !== null && value !== undefined && value !== "" &&
          value !== "N/A" && value !== "--") {
        return value;
      }
    }
    return null;
  }

  function networkType(code) {
    if (code === null || code === undefined || code === "") return null;
    return NETWORK_TYPES[String(code)] || `Unknown (${code})`;
  }

  function connectionStatus(code) {
    if (code === null || code === undefined || code === "") return null;
    return CONNECTION[String(code)] || `Unknown (${code})`;
  }

  function gib(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return null;
    return `${(number / 1024 ** 3).toFixed(2)} GB`;
  }

  function hostsCount(data) {
    for (const key of ["wlan_host_list", "lan_host_info"]) {
      const block = data[key];
      if (!block || typeof block !== "object") continue;
      let hosts = block.Hosts;
      if (hosts && !Array.isArray(hosts) && typeof hosts === "object") {
        hosts = hosts.Host;
      }
      if (Array.isArray(hosts)) return hosts.filter((h) => h && typeof h === "object").length;
      if (hosts && typeof hosts === "object") return 1;
    }
    return null;
  }

  function summarize(data) {
    const info = data.device_information || {};
    const signal = data.device_signal || {};
    const status = data.monitoring_status || {};
    const plmn = data.current_plmn || {};
    const traffic = data.traffic_statistics || {};
    const month = data.month_statistics || {};
    const sms = data.sms_count || {};

    const rows = [
      ["Model", pick(info, "DeviceName")],
      ["Firmware", pick(info, "SoftwareVersion")],
      ["IMEI", pick(info, "Imei", "IMEI")],
      ["Operator", pick(plmn, "FullName", "ShortName")],
      ["Connection", connectionStatus(pick(status, "ConnectionStatus"))],
      ["Network type", networkType(pick(status, "CurrentNetworkType"))],
      ["Signal bars", pick(status, "SignalIcon", "SignalBar")],
      ["RSRP", pick(signal, "rsrp")],
      ["RSRQ", pick(signal, "rsrq")],
      ["SINR", pick(signal, "sinr")],
      ["Band", pick(signal, "band")],
      ["Cell ID", pick(signal, "cell_id")],
      ["Roaming", String(pick(status, "RoamingStatus")) === "1" ? "Yes" : null],
      ["Downloaded", gib(pick(traffic, "TotalDownload"))],
      ["Uploaded", gib(pick(traffic, "TotalUpload"))],
      ["This month down", gib(pick(month, "CurrentMonthDownload"))],
      ["This month up", gib(pick(month, "CurrentMonthUpload"))],
      ["Connected clients", hostsCount(data)],
      ["Inbox", pick(sms, "LocalInbox", "SimInbox")],
      ["Unread", pick(sms, "UnreadInbox")],
    ];

    return rows
      .filter(([, value]) => value !== null && value !== undefined && value !== "")
      .map(([label, value]) => ({ label, value: String(value) }));
  }

  function headline(data) {
    const status = data.monitoring_status || {};
    const signal = data.device_signal || {};
    const month = data.month_statistics || {};
    return {
      connection: connectionStatus(pick(status, "ConnectionStatus")),
      networkType: networkType(pick(status, "CurrentNetworkType")),
      bars: pick(status, "SignalIcon", "SignalBar"),
      rsrp: pick(signal, "rsrp"),
      thisMonth: gib(pick(month, "CurrentMonthDownload")),
      clients: hostsCount(data),
    };
  }

  return { summarize, headline };
})();
