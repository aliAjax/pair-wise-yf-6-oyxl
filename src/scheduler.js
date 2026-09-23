// 排线规则：师傅作息、路程耗时、加急优先与冲突判定

export const DAY_START = 9 * 60; // 09:00 开工
export const DAY_END = 18 * 60; // 18:00 收工
export const TRAVEL_MINUTES = 20; // 前后两单之间路程 20 分钟
export const TECHNICIANS = ["王师傅", "李师傅"];

export function toMinutes(time) {
  const [hours, minutes] = String(time).split(":").map(Number);
  return hours * 60 + minutes;
}

export function formatTime(minutes) {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}

// 加急项尽量早排，普通项保持原有占位顺序往后顺延
export function orderJobs(jobs) {
  return [...jobs.filter((job) => job.urgent), ...jobs.filter((job) => !job.urgent)];
}

// 逐项派单：每位师傅都试算最早完工时刻，能赶上最晚完成时刻且不超过收工时间的，
// 交给完工最早的师傅；两位都赶不上就留待派并给出冲突说明。
export function scheduleJobs(jobs) {
  const techs = TECHNICIANS.map((name) => ({ name, stops: [], availableAt: DAY_START }));
  const pending = [];

  for (const job of orderJobs(jobs)) {
    const deadline = toMinutes(job.deadline);
    const latest = Math.min(deadline, DAY_END);

    const plans = techs.map((tech) => {
      const start = tech.availableAt + (tech.stops.length ? TRAVEL_MINUTES : 0);
      return { tech, start, end: start + Number(job.minutes) };
    });

    const feasible = plans.filter((plan) => plan.end <= latest);
    if (!feasible.length) {
      const best = plans.reduce((a, b) => (a.end <= b.end ? a : b));
      const reason =
        deadline < DAY_END
          ? `两位师傅最早 ${formatTime(best.start)} 才能上门，预计 ${formatTime(best.end)} 完工，超过最晚完成时刻 ${formatTime(deadline)}`
          : `两位师傅最早 ${formatTime(best.start)} 才能上门，预计 ${formatTime(best.end)} 完工，赶不上 18:00 收工`;
      pending.push({ job, reason });
      continue;
    }

    const chosen = feasible.reduce((a, b) => (a.end <= b.end ? a : b));
    chosen.tech.stops.push({ job, start: chosen.start, end: chosen.end });
    chosen.tech.availableAt = chosen.end;
  }

  return {
    routes: techs.map((tech) => ({
      name: tech.name,
      stops: tech.stops,
      finishAt: tech.stops.length ? tech.stops[tech.stops.length - 1].end : null
    })),
    pending
  };
}
