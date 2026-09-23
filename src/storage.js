// 存档：预置检修单与 localStorage 读写，关掉页面再打开数据还在

const STORAGE_KEY = "zfl-14-dispatch";

export const PRESET_JOBS = [
  { id: "preset-1", community: "幸福里小区", minutes: 90, deadline: "12:00", urgent: true },
  { id: "preset-2", community: "阳光100", minutes: 120, deadline: "17:30", urgent: true },
  { id: "preset-3", community: "翠湖花园", minutes: 60, deadline: "15:00", urgent: false },
  { id: "preset-4", community: "江南水岸", minutes: 45, deadline: "10:30", urgent: false },
  { id: "preset-5", community: "金域蓝湾", minutes: 75, deadline: "18:00", urgent: false }
];

export function loadState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && Array.isArray(parsed.jobs)) return parsed;
    }
  } catch (error) {
    // 存档损坏时回退到预置数据
  }
  return { jobs: PRESET_JOBS.map((job) => ({ ...job })) };
}

export function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function resetState() {
  localStorage.removeItem(STORAGE_KEY);
  return loadState();
}
