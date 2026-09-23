// 存档：台账数据落 localStorage；关掉页面再打开仍在。
// localStorage 不可用（隐私模式等）时退化为内存存档，页面当前会话仍可用。

import { deadlineOf, durationOf, ruleSortJobs } from "./scheduler.js";

const STORAGE_KEY = "zfl-14-home-repair-v2";

// 预置五项检修：小区、施工分钟、最晚完成时刻、加急标记
export function seedJobs() {
  return [
    { id: "seed-1", community: "翠湖花园 3-501", title: "燃气检漏", minutes: 120, deadline: "11:00", urgent: true },
    { id: "seed-2", community: "翠湖花园 6-202", title: "电路跳闸检修", minutes: 90, deadline: "13:00", urgent: true },
    { id: "seed-3", community: "梧桐里 8-1103", title: "水管漏水维修", minutes: 120, deadline: "15:00", urgent: false },
    { id: "seed-4", community: "海棠公寓 2-1701", title: "空调不制冷", minutes: 60, deadline: "11:00", urgent: false },
    { id: "seed-5", community: "金桂苑 12-303", title: "门锁更换", minutes: 60, deadline: "18:00", urgent: false }
  ];
}

function normalize(job) {
  return {
    id: String(job.id || crypto.randomUUID()),
    community: String(job.community ?? "").trim(),
    title: String(job.title ?? "").trim(),
    minutes: durationOf(job),
    deadline: toStoredDeadline(job.deadline),
    urgent: Boolean(job.urgent)
  };
}

function toStoredDeadline(value) {
  // 只存 "HH:MM"；无法识别（含空值）统一记为收工时刻
  const minutes = typeof value === "number" && Number.isFinite(value) ? value : deadlineOf({ deadline: value });
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

const memoryStore = new Map();
const driver = (() => {
  try {
    const key = "__repair_storage_probe__";
    localStorage.setItem(key, "1");
    localStorage.removeItem(key);
    return {
      get(key) {
        return localStorage.getItem(key);
      },
      set(key, value) {
        localStorage.setItem(key, value);
      }
    };
  } catch {
    return {
      get(key) {
        return memoryStore.has(key) ? memoryStore.get(key) : null;
      },
      set(key, value) {
        memoryStore.set(key, value);
      }
    };
  }
})();

// 首次打开写入预置五项（已按排线规则排序：加急优先、最晚时刻早的在前）
export function loadJobs() {
  try {
    const raw = driver.get(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.map(normalize);
    }
  } catch {
    // 存档损坏时回到预置数据，不白屏
  }
  const seeds = ruleSortJobs(seedJobs()).map(normalize);
  persist(seeds);
  return seeds;
}

export function createJob(input) {
  return normalize({ ...input, id: input.id || crypto.randomUUID() });
}

export function persist(jobs) {
  driver.set(STORAGE_KEY, JSON.stringify(jobs.map(normalize)));
}

export function resetJobs() {
  const seeds = ruleSortJobs(seedJobs()).map(normalize);
  persist(seeds);
  return seeds;
}
