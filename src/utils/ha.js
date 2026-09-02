export const normalizeBase = (u) => (u || "").trim().replace(/\/+$/, "");

export const SUPPORTED_DOMAINS = [
  "light",
  "switch",
  "fan",
  "climate",
  "input_boolean",
  "automation",
  "script",
  "scene",
  "cover",
  "media_player",
  "vacuum",
];

export const DOMAIN_META = {
  light: { label: "灯具", icon: "ri-lightbulb-line", iconOn: "ri-lightbulb-fill" },
  switch: { label: "开关", icon: "ri-toggle-line", iconOn: "ri-toggle-fill" },
  fan: { label: "风扇", icon: "ri-fan-line", iconOn: "ri-fan-fill" },
  climate: { label: "温控", icon: "ri-temp-cold-line", iconOn: "ri-temp-hot-line" },
  input_boolean: { label: "辅助开关", icon: "ri-toggle-line", iconOn: "ri-toggle-fill" },
  automation: { label: "自动化", icon: "ri-magic-line", iconOn: "ri-magic-fill" },
  script: { label: "脚本", icon: "ri-file-code-line", iconOn: "ri-file-code-line" },
  scene: { label: "场景", icon: "ri-movie-2-line", iconOn: "ri-movie-2-fill" },
  cover: { label: "窗帘", icon: "ri-curtains-line", iconOn: "ri-curtains-fill" },
  media_player: { label: "播放器", icon: "ri-speaker-line", iconOn: "ri-speaker-fill" },
  vacuum: { label: "扫地机", icon: "ri-robot-line", iconOn: "ri-robot-fill" },
};

export const domainOf = (entityId) => String(entityId || "").split(".")[0];
export const metaOf = (entityId) =>
  DOMAIN_META[domainOf(entityId)] || { label: "设备", icon: "ri-device-line", iconOn: "ri-device-fill" };

const authHeaders = (token) => ({
  Authorization: `Bearer ${token}`,
  "Content-Type": "application/json",
});

const request = async (base, path, token, options = {}) => {
  const res = await fetch(`${normalizeBase(base)}${path}`, {
    ...options,
    headers: { ...authHeaders(token), ...(options.headers || {}) },
  });
  if (res.status === 401) throw new Error("令牌无效或已过期（401）");
  if (res.status === 403) throw new Error("被拒绝访问，请检查 HA 的 CORS 设置（403）");
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText || ""}`.trim());
  if (res.status === 204) return null;
  return res.json();
};

export const testConnection = async (base, token) => {
  const data = await request(base, "/api/", token);
  return data?.message || "连接成功";
};

export const fetchStates = async (base, token) => request(base, "/api/states", token);

export const filterSupported = (states) =>
  (Array.isArray(states) ? states : []).filter((s) =>
    SUPPORTED_DOMAINS.includes(domainOf(s.entity_id))
  );

const SERVICE_MAP = {
  cover: { on: "open_cover", off: "close_cover" },
  vacuum: { on: "start", off: "return_to_base" },
};

export const isActive = (entity) => {
  if (!entity) return false;
  const d = domainOf(entity.entity_id);
  if (d === "cover") return entity.state === "open";
  if (d === "vacuum") return entity.state === "cleaning" || entity.state === "docked";
  return entity.state === "on" || entity.state === "home";
};

export const callService = async (base, token, entityId, turnOn) => {
  const domain = domainOf(entityId);
  const svc = SERVICE_MAP[domain]?.[turnOn ? "on" : "off"] || (turnOn ? "turn_on" : "turn_off");
  return request(base, `/api/services/${domain}/${svc}`, token, {
    method: "POST",
    body: JSON.stringify({ entity_id: entityId }),
  });
};

export const detailOf = (entity) => {
  if (!entity) return "";
  const a = entity.attributes || {};
  const d = domainOf(entity.entity_id);
  if (d === "climate") {
    const t = a.current_temperature != null ? `${a.current_temperature}°` : "";
    const target = a.temperature != null ? ` / 设定 ${a.temperature}°` : "";
    return `${t}${target}`.trim();
  }
  if (d === "light" && a.brightness != null) return `${Math.round((a.brightness / 255) * 100)}%`;
  if (d === "fan" && a.percentage != null) return `${a.percentage}%`;
  if (d === "cover" && a.current_position != null) return `${a.current_position}%`;
  const map = { cleaning: "清扫中", docked: "已回充", idle: "待机", home: "在家", standby: "待机" };
  return map[entity.state] || "";
};
