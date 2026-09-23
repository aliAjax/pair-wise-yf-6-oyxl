// 页面：登记检修单、调整占位顺序、展示两名师傅的上门路线与待派清单

import "./styles.css";
import { scheduleJobs, formatTime, TRAVEL_MINUTES } from "./scheduler.js";
import { loadState, saveState, resetState } from "./storage.js";

let state = loadState();
const app = document.querySelector("#app");

function render() {
  const { routes, pending } = scheduleJobs(state.jobs);
  const scheduledCount = routes.reduce((total, route) => total + route.stops.length, 0);
  const latestFinish = Math.max(...routes.map((route) => route.finishAt || 0));

  app.innerHTML = `
    <main class="shell">
      <header class="header">
        <div>
          <p class="eyebrow">本地家庭维护台 · 每日派单</p>
          <h1>当日上门排线</h1>
        </div>
        <section class="stats">
          <div class="stat"><span>已排上门</span><strong>${scheduledCount} 单</strong></div>
          <div class="stat"><span>留待派</span><strong>${pending.length} 单</strong></div>
          <div class="stat"><span>最晚收工</span><strong>${latestFinish ? formatTime(latestFinish) : "—"}</strong></div>
        </section>
      </header>

      <section class="layout">
        <aside class="panel">
          <h2>登记检修</h2>
          <form class="form" id="job-form">
            <label>小区<input name="community" required placeholder="例如翠湖花园"></label>
            <label>施工分钟<input name="minutes" type="number" min="15" step="15" value="60" required></label>
            <label>最晚完成时刻<input name="deadline" type="time" min="09:00" max="18:00" value="17:00" required></label>
            <label class="check"><input name="urgent" type="checkbox"> 加急，尽量早排</label>
            <button class="primary" type="submit">加入台账</button>
            <button class="ghost" type="button" id="reset">恢复预置五项</button>
          </form>

          <h2 class="gap">检修台账（占位顺序）</h2>
          <div class="jobs">
            ${state.jobs.length ? state.jobs.map(renderJob).join("") : `<div class="empty small">台账为空，先登记检修</div>`}
          </div>
        </aside>

        <section class="board">
          <div class="routes">
            ${routes.map(renderRoute).join("")}
          </div>
          <section class="panel pending-panel">
            <h2>留待派（${pending.length}）</h2>
            ${
              pending.length
                ? `<ul class="pending-list">${pending
                    .map(
                      ({ job, reason }) => `
                        <li>
                          <strong>${escapeHtml(job.community)}</strong>
                          <span class="chip">施工 ${job.minutes} 分钟</span>
                          <span class="chip">最晚 ${job.deadline}</span>
                          ${job.urgent ? `<span class="tag urgent">加急</span>` : ""}
                          <p class="reason">冲突：${reason}</p>
                        </li>`
                    )
                    .join("")}</ul>`
                : `<div class="empty small">没有冲突，全部排进当天路线</div>`
            }
          </section>
        </section>
      </section>
    </main>
  `;

  bindEvents();
}

function renderJob(job, index) {
  return `
    <article class="job ${job.urgent ? "is-urgent" : ""}">
      <div class="job-main">
        <strong>${index + 1}. ${escapeHtml(job.community)}</strong>
        <span class="chip">施工 ${job.minutes} 分钟</span>
        <span class="chip">最晚 ${job.deadline}</span>
        ${job.urgent ? `<span class="tag urgent">加急</span>` : `<span class="tag">普通</span>`}
      </div>
      <div class="actions">
        <button class="ghost" data-urgent="${job.id}">${job.urgent ? "取消加急" : "设为加急"}</button>
        <button class="ghost" data-move="up" data-id="${job.id}" ${index === 0 ? "disabled" : ""}>上移</button>
        <button class="ghost" data-move="down" data-id="${job.id}" ${index === state.jobs.length - 1 ? "disabled" : ""}>下移</button>
        <button class="ghost danger" data-delete="${job.id}">删除</button>
      </div>
    </article>
  `;
}

function renderRoute(route) {
  const stops = route.stops
    .map((stop, index) => {
      const travel = index > 0 ? `<li class="travel">路程 ${TRAVEL_MINUTES} 分钟</li>` : "";
      return `
        ${travel}
        <li class="stop">
          <span class="time">${formatTime(stop.start)} – ${formatTime(stop.end)}</span>
          <span class="where">${escapeHtml(stop.job.community)}</span>
          <span class="chip">施工 ${stop.job.minutes} 分钟</span>
          ${stop.job.urgent ? `<span class="tag urgent">加急</span>` : ""}
        </li>`;
    })
    .join("");

  return `
    <section class="panel route">
      <h2>${route.name}<span class="finish">${route.finishAt ? `收工 ${formatTime(route.finishAt)}` : "今日无安排"}</span></h2>
      <ol class="timeline">
        <li class="start">09:00 开工</li>
        ${stops || `<li class="idle">暂无上门安排</li>`}
      </ol>
    </section>
  `;
}

function bindEvents() {
  document.querySelector("#job-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.target));
    state.jobs.push({
      id: crypto.randomUUID(),
      community: data.community.trim(),
      minutes: Number(data.minutes),
      deadline: data.deadline,
      urgent: Boolean(data.urgent)
    });
    saveState(state);
    render();
  });

  document.querySelector("#reset").addEventListener("click", () => {
    state = resetState();
    render();
  });

  document.querySelectorAll("[data-urgent]").forEach((button) => {
    button.addEventListener("click", () => {
      const job = state.jobs.find((item) => item.id === button.dataset.urgent);
      job.urgent = !job.urgent;
      saveState(state);
      render();
    });
  });

  document.querySelectorAll("[data-move]").forEach((button) => {
    button.addEventListener("click", () => {
      const index = state.jobs.findIndex((item) => item.id === button.dataset.id);
      const target = button.dataset.move === "up" ? index - 1 : index + 1;
      [state.jobs[index], state.jobs[target]] = [state.jobs[target], state.jobs[index]];
      saveState(state);
      render();
    });
  });

  document.querySelectorAll("[data-delete]").forEach((button) => {
    button.addEventListener("click", () => {
      state.jobs = state.jobs.filter((job) => job.id !== button.dataset.delete);
      saveState(state);
      render();
    });
  });
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char]);
}

render();
