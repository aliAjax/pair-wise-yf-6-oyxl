// 排线规则：纯业务逻辑，不操作 DOM，也不读写存档，方便单独验算。

export const WORK_START = 9 * 60; // 师傅九点开工（分钟）
export const WORK_END = 18 * 60; // 晚上六点收工（分钟）
export const TRAVEL_MINUTES = 20; // 前后两单之间留二十分钟路程
export const TECHNICIANS = ["王师傅", "李师傅"];

// "HH:MM" -> 分钟数；无法解析时返回 null
export function toMinutes(value) {
  const parts = String(value ?? "").split(":");
  if (parts.length !== 2) return null;
  const hour = Number(parts[0]);
  const minute = Number(parts[1]);
  if (!Number.isInteger(hour) || !Number.isInteger(minute)) return null;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return hour * 60 + minute;
}

// 分钟数 -> "HH:MM"
export function toTime(value) {
  const total = Math.max(0, Math.round(value));
  const hour = Math.floor(total / 60);
  const minute = total % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

// 施工分钟：非法/缺省按 0 处理，保证排线不中断
export function durationOf(job) {
  const value = Number(job.minutes);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

// 最晚完成时刻；未登记时按收工时刻兜底
export function deadlineOf(job) {
  return toMinutes(job.deadline) ?? WORK_END;
}

// 排线顺序：加急项一律提到普通项前面（原来占位的普通项顺延），
// 组内保持台账里的先后顺序，人工调整的顺序因此可以生效。
export function orderJobs(jobs) {
  return [...jobs.filter((job) => job.urgent), ...jobs.filter((job) => !job.urgent)];
}

// “按规则重排”：加急优先；同组内最晚完成时刻早的在前、施工久的在前，稳定排序
export function ruleSortJobs(jobs) {
  return [...jobs].sort((a, b) => {
    if (Boolean(a.urgent) !== Boolean(b.urgent)) return Number(b.urgent) - Number(a.urgent);
    if (deadlineOf(a) !== deadlineOf(b)) return deadlineOf(a) - deadlineOf(b);
    if (durationOf(a) !== durationOf(b)) return durationOf(b) - durationOf(a);
    return 0;
  });
}

// 在自己的加急分组内上移/下移一位；不允许跨加急分组（加急始终在前）
export function moveOrdered(jobs, id, direction) {
  const ordered = orderJobs(jobs);
  const index = ordered.findIndex((job) => job.id === id);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= ordered.length) return ordered;
  if (Boolean(ordered[index].urgent) !== Boolean(ordered[target].urgent)) return ordered;
  [ordered[index], ordered[target]] = [ordered[target], ordered[index]];
  return ordered;
}

// 切换加急标记后重新按规则归位（进入对应分组的末尾）
export function withUrgent(jobs, id, urgent) {
  const next = jobs.map((job) => (job.id === id ? { ...job, urgent: Boolean(urgent) } : job));
  return orderJobs(next);
}

function conflictReason({ start, finish, deadline }) {
  let reason = `师傅最早 ${toTime(start)} 上门、${toTime(finish)} 才能完工`;
  const conflicts = [];
  if (finish > deadline && deadline < WORK_END) {
    conflicts.push(`晚于最晚完成 ${toTime(deadline)}`);
  }
  if (finish > WORK_END) {
    conflicts.push("超过 18:00 收工时刻");
  }
  return conflicts.length ? `${reason}，${conflicts.join("，且")}` : reason;
}

// 给两名师傅排出当天路线。
// 规则：按 orderJobs 的顺序逐单处理，谁先空出来派给谁（并列时王师傅优先）；
// 每单之间预留路程；完工超过最晚完成时刻或收工时刻则“留待派”，不占用当天路线。
export function schedule(jobs) {
  const routes = TECHNICIANS.map((name, index) => ({
    index,
    tech: name,
    stops: [],
    freeAt: WORK_START
  }));
  const pending = [];

  for (const job of orderJobs(jobs)) {
    const options = routes.map((route) => ({
      route,
      start: route.freeAt + (route.stops.length > 0 ? TRAVEL_MINUTES : 0)
    }));
    options.sort((a, b) => a.start - b.start || a.route.index - b.route.index);
    const best = options[0];
    const finish = best.start + durationOf(job);
    const deadline = deadlineOf(job);

    if (finish > deadline || finish > WORK_END) {
      pending.push({
        job,
        tech: routes[best.route.index].tech,
        start: best.start,
        finish,
        deadline,
        reason: conflictReason({ start: best.start, finish, deadline })
      });
      continue; // 留待派：不顺延后面的单子，也不占用师傅工时
    }

    best.route.stops.push({ job, start: best.start, finish });
    best.route.freeAt = finish;
  }

  const routeViews = routes.map((route) => ({
    tech: route.tech,
    stops: route.stops,
    count: route.stops.length,
    finishAt: route.stops.length ? route.freeAt : null
  }));
  const assignedCount = routeViews.reduce((sum, route) => sum + route.count, 0);
  const finishTimes = routeViews.map((route) => route.finishAt).filter((value) => value !== null);

  return {
    routes: routeViews,
    pending,
    pendingCount: pending.length,
    assignedCount,
    dayFinishAt: finishTimes.length ? Math.max(...finishTimes) : null
  };
}
