/*
 * Cell payload decoding, ported from the Python client so both produce the
 * same table.
 *
 * The lists are one string of semicolon-separated rows, each row a
 * comma-separated tuple. Huawei varies the tuple between models, so the layout
 * is read from each row:
 *
 *   1450,B3,20MHz,134,-87dBm,-6dB,-59dBm,14dB
 *        ARFCN,Band,BW,PCI,RSRP,RSRQ,RSSI,SINR
 *   1279,B3,70,-82dBm,-9dB,-53dBm,--
 *        ARFCN,Band,PCI,RSRP,RSRQ,RSSI,SINR
 */

const cellData = (() => {
  const COLUMNS = [
    ["rat", "RAT"],
    ["arfcn", "ARFCN"],
    ["band", "Band"],
    ["bandwidth", "Bandwidth"],
    ["pci", "PCI"],
    ["rsrp", "RSRP"],
    ["rsrq", "RSRQ"],
    ["rssi", "RSSI"],
    ["sinr", "SINR"],
  ];

  const TAIL_LAYOUTS = {
    1: ["pci"],
    2: ["pci", "rsrp"],
    3: ["pci", "rsrp", "rsrq"],
    4: ["pci", "rsrp", "rsrq", "rssi"],
    5: ["pci", "rsrp", "rsrq", "rssi", "sinr"],
  };

  const BAND_PATTERN = /^(?:[BbNn]\d{1,3}|\d{1,2}|lte|nr|5g|4g|3g|2g)$/i;

  const ACRONYMS = new Set([
    "PCI", "TAC", "RSRP", "RSRQ", "RSSI", "SINR", "NR", "LTE", "ID",
    "ARFCN", "EARFCN", "NRARFCN", "SCS", "MIMO",
  ]);

  const EMPTY = new Set(["", "--", "-", "n/a", "none", "null"]);

  function isEmpty(value) {
    return value === null || value === undefined ||
      EMPTY.has(String(value).trim().toLowerCase());
  }

  function ratFromKey(key) {
    const lowered = String(key).toLowerCase();
    const table = [
      ["wcdma", "3G"], ["umts", "3G"], ["gsm", "2G"], ["gprs", "2G"],
      ["nr", "NR"], ["lte", "LTE"],
    ];
    for (const [token, label] of table) {
      if (lowered.includes(token)) return label;
    }
    return "";
  }

  function looksLikeBandwidth(rest, parts) {
    if (!rest.length) return false;
    if (rest[0].toLowerCase().endsWith("mhz")) return true;
    if (parts.length < 8) return false;
    const bandwidth = rest[0];
    const following = rest[1] || "";
    return (
      /^\d+$/.test(bandwidth) &&
      /^\d+$/.test(following) &&
      Number(bandwidth) > 0 &&
      Number(bandwidth) <= 400 &&
      Number(following) <= 1007
    );
  }

  function parseCellList(text, rat = "") {
    if (typeof text !== "string") return [];
    const rows = [];

    for (const chunk of text.split(";")) {
      const row = chunk.trim();
      if (!row) continue;
      const parts = row.split(",").map((part) => part.trim());
      if (parts.length < 6) continue;

      const record = { rat };
      const [first, second] = parts;
      if (BAND_PATTERN.test(first) && !BAND_PATTERN.test(second)) {
        record.band = first;
        record.arfcn = second;
      } else {
        record.arfcn = first;
        record.band = second;
      }

      let rest = parts.slice(2);
      if (looksLikeBandwidth(rest, parts)) {
        record.bandwidth = rest[0];
        rest = rest.slice(1);
      }

      // Four signal figures: a value in dB is SINR, in dBm it is RSSI.
      const fourth = rest[3] || "";
      const isSinr = rest.length === 4 &&
        fourth.toLowerCase().endsWith("db") &&
        !fourth.toLowerCase().endsWith("dbm");

      const fields = isSinr
        ? ["pci", "rsrp", "rsrq", "sinr"]
        : TAIL_LAYOUTS[rest.length] || TAIL_LAYOUTS[5];

      fields.forEach((field, index) => {
        if (rest[index] !== undefined) record[field] = rest[index];
      });
      if (rest.length > fields.length) {
        record.extra = rest.slice(fields.length).join(",");
      }
      rows.push(record);
    }
    return rows;
  }

  function fromDict(item, rat) {
    const aliases = {
      arfcn: ["arfcn", "earfcn", "nr_arfcn", "nrarfcn"],
      band: ["band", "bandinfo"],
      bandwidth: ["bandwidth", "bw"],
      pci: ["pci", "nr_pci", "nrpci"],
      rsrp: ["rsrp", "nr_rsrp", "nrrsrp"],
      rsrq: ["rsrq", "nr_rsrq", "nrrsrq"],
      rssi: ["rssi", "nr_rssi", "nrrssi"],
      sinr: ["sinr", "nr_sinr", "nrsinr"],
    };

    const lowered = new Map();
    for (const [key, value] of Object.entries(item || {})) {
      lowered.set(String(key).toLowerCase(), value);
    }

    const record = { rat };
    for (const [field, names] of Object.entries(aliases)) {
      for (const name of names) {
        const value = lowered.get(name);
        if (!isEmpty(value)) {
          record[field] = String(value);
          break;
        }
      }
    }
    return record;
  }

  function parseBlock(block) {
    if (!block || typeof block !== "object") return [];
    const rows = [];

    for (const [key, value] of Object.entries(block)) {
      if (typeof value === "string" && value.includes(",")) {
        rows.push(...parseCellList(value, ratFromKey(key)));
      } else if (Array.isArray(value)) {
        for (const item of value) {
          if (item && typeof item === "object") rows.push(fromDict(item, ratFromKey(key)));
          else if (typeof item === "string") rows.push(...parseCellList(item, ratFromKey(key)));
        }
      } else if (value && typeof value === "object") {
        for (const item of Object.values(value)) {
          if (item && typeof item === "object") rows.push(fromDict(item, ratFromKey(key)));
        }
      }
    }

    return rows.filter((row) => row.arfcn || row.pci || row.band);
  }

  function buildTable(rows) {
    const columns = COLUMNS.filter(([key]) =>
      rows.some((row) => !isEmpty(row[key]))
    );
    return {
      columns: columns.map(([, label]) => label),
      rows: rows.map((row) =>
        columns.map(([key]) => (isEmpty(row[key]) ? "" : String(row[key]).trim()))
      ),
    };
  }

  function prettify(key) {
    return String(key)
      .replace(/(?<=[a-z0-9])(?=[A-Z])|_+/g, " ")
      .trim()
      .split(/\s+/)
      .map((word) => {
        const upper = word.toUpperCase();
        if (ACRONYMS.has(upper) || (word.length <= 4 && word === upper)) return upper;
        return word.charAt(0).toUpperCase() + word.slice(1);
      })
      .join(" ");
  }

  const CELL_ID_KEYS = ["cellinfo", "cell_id", "cellid", "eci", "cell_identity"];
  const TAC_KEYS = ["lac", "tac", "tracking_area_code", "location_area_code"];

  function cellIdText(value) {
    const text = String(value).trim();
    if (!text || /^\d+$/.test(text)) return text;
    const parsed = parseInt(text, 16);
    return Number.isNaN(parsed) ? text : `${text.toUpperCase()} (${parsed})`;
  }

  function servingFields(block) {
    if (!block || typeof block !== "object") return [];
    const lowered = new Map();
    for (const [key, value] of Object.entries(block)) {
      lowered.set(String(key).toLowerCase(), [key, value]);
    }

    const fields = [];
    const used = new Set();

    for (const key of CELL_ID_KEYS) {
      const hit = lowered.get(key);
      if (hit && !isEmpty(hit[1])) {
        used.add(String(hit[0]).toLowerCase());
        fields.push({ label: "Cell ID", value: cellIdText(hit[1]) });
        break;
      }
    }
    for (const key of TAC_KEYS) {
      const hit = lowered.get(key);
      if (hit && !isEmpty(hit[1])) {
        used.add(String(hit[0]).toLowerCase());
        fields.push({ label: "LAC / TAC", value: String(hit[1]).trim() });
        break;
      }
    }
    for (const [key, value] of Object.entries(block)) {
      if (used.has(String(key).toLowerCase()) || isEmpty(value)) continue;
      if (value && typeof value === "object") continue;
      fields.push({ label: prettify(key), value: String(value).trim() });
    }
    return fields;
  }

  /** Turn the three raw payloads into what the page renders. */
  function model(raw) {
    const serving = raw.serving ? servingFields(raw.serving) : [];
    const secondaryRows = raw.secondary ? parseBlock(raw.secondary) : [];
    const neighbourRows = raw.neighbours ? parseBlock(raw.neighbours) : [];

    return {
      serving,
      secondary: buildTable(secondaryRows),
      neighbours: buildTable(neighbourRows),
      unavailable: raw.unavailable || [],
    };
  }

  return { model, parseCellList, parseBlock, buildTable, servingFields, prettify };
})();
