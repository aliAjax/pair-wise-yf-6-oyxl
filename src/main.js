import "./styles.css";
import {
  TECHNICIANS,
  TRAVEL_MINUTES,
  WORK_END,
  WORK_START,
  deadlineOf,
  durationOf,
  moveOrdered,
  orderJobs,
  ruleSortJobs,
  schedule,
  toTime,
  withUrgent
} from "./scheduler.js";
import { createJob, loadJobs, persist, resetJobs } from "./storage.js";

const app = document.querySelector("#app");
let jobs = loadJobs();

function commit(next) {
  jobs = next;
  persist(jobs);
  render();
}

function render() {
  const ordered = orderJobs(jobs);
  const plan = schedule(jobs);

  app.innerHTML = `
    <main class="shell">
      <header class="header">
        <div>
          <p class="eyebrow">当日上门排线台账</p>
          <h1>家庭维修排线</h1>
          <p class="ruleline">${TECHNICIANS.length} 名师傅 · ${toTime(WORK_START)} 开工 · 单间隔 ${TRAVEL_MINUTES} 分钟路程 · ${toTime(WORK_END)} 收工</p>
        </div>
        <section class="stats">
          <div class="stat"><span>检修事项</span><strong>${jobs.length}</strong></div>
          <div class="stat"><span>已排路线</span><strong>${plan.assignedCount}</strong></div>
          <div class="stat ${plan.pendingCount ? "alert" : ""}"><span>待派</span><strong>${plan.pendingCount}</strong></div>
          <div class="stat"><span>全天收工</span><strong>${plan.dayFinishAt ? toTime(plan.dayFinishAt) : "—"}</strong></div>
        </section>
      </header>

      <div class="toolbar">
        <button class="seg" id="auto-sort" type="button">按规则重排（加急优先 · 最晚时刻早者优先）</button>
        <button class="seg" id="reset-seeds" type="button">恢复预置五项</button>
      </div>

      <div class="layout">
        <section class="panel ledger">
          <h2>检修台账（顺序即排线优先级）</h2>
          <div class="rows">
            ${ordered.length ? ordered.map((job, index) => renderRow(job, index, ordered)).join("") : `<div class="empty">台账为空，先在下方登记一项检修</div>`}
          </div>

          <form class="form" id="job-form">
            <h3>登记新检修</h3>
            <label>小区 / 房号<input name="community" required placeholder="例如 翠湖花园 3-501"></label>
            <label>检修事项<input name="title" required placeholder="例如 水管漏水维修"></label>
            <div class="form-grid">
              <label>施工分钟<input name="minutes" type="number" min="1" step="1" value="60" required></label>
              <label>最晚完成<input name="deadline" type="time" value="18:00" required></label>
            </div>
            <label class="check"><input type="checkbox" name="urgent"> <span>加急（尽量早排，占位普通项自动顺延）</span></label>
            <button class="primary" type="submit">登记并重算排线</button>
          </form>
        </section>

        <section class="board">
          ${plan.routes.map((route) => renderRoute(route)).join("")}

          <section class="panel pending ${plan.pendingCount ? "has" : ""}">
            <h2>待派事项 <span class="badge">${plan.pendingCount}</span></h2>
            ${plan.pendingCount
              ? plan.pending.map((item) => `
                <article class="pending-card">
                  <div class="row between">
                    <h3>${escapeHtml(item.job.community)} · ${escapeHtml(item.job.title)}</h3>
                    ${item.job.urgent ? `<span class="urgent-tag">加急</span>` : ""}
                  </div>
                  <p class="conflict">冲突：${escapeHtml(item.reason)}；最晚 ${toTime(deadlineOf(item.job))} 前必须完成。已留待派，请改约或加派人手。</p>
                </article>`).join("")
              : `<div class="empty">暂无待派事项，所有检修当天都能完成</div>`}
          </section>
        </section>
      </div>
    </main>
  `;
}

function renderRow(job, index, ordered) {
  const canUp = index > 0 && Boolean(ordered[index - 1].urgent) === Boolean(job.urgent);
  const canDown = index < ordered.length - 1 && Boolean(ordered[index + 1].urgent) === Boolean(job.urgent);
  return `
    <article class="job ${job.urgent ? "is-urgent" : ""}" data-id="${job.id}">
      <div class="reorder">
        <button type="button" class="arrow" data-action="up" ${canUp ? "" : "disabled"} title="在本组内上移">▲</button>
        <span class="orderno">${index + 1}</span>
        <button type="button" class="arrow" data-action="down" ${canDown ? "" : "disabled"} title="在本组内下移">▼</button>
      </div>
      <div class="job-main">
        <div class="row between wrap">
          <input class="input-community" data-field="community" value="${escapeAttr(job.community)}" aria-label="小区">
          ${job.urgent ? `<span class="urgent-tag">加急</span>` : ""}
        </div>
        <input class="input-title" data-field="title" value="${escapeAttr(job.title)}" aria-label="检修事项">
        <div class="row wrap fields">
          <label class="mini">施工 <input type="number" min="1" step="1" data-field="minutes" value="${durationOf(job)}"> 分钟</label>
          <label class="mini">最晚 <input type="time" data-field="deadline" value="${job.deadline}"></label>
          <label class="mini check"><input type="checkbox" data-field="urgent" ${job.urgent ? "checked" : ""}> 加急</label>
          <button type="button" class="ghost" data-action="delete">删除</button>
        </div>
      </div>
    </article>`;
}

function renderRoute(route) {
  return `
    <section class="panel route">
      <h2>${escapeHtml(route.tech)} 的路线
        <span class="chip">${route.count} 单</span>
        <span class="chip">完工 ${route.finishAt ? toTime(route.finishAt) : "—"}</span>
      </h2>
      ${route.stops.length ? `
        <ol class="stops">
          ${route.stops.map((stop, index) => renderStop(stop, index)).join("")}
        </ol>` : `<div class="empty">今天没有派给${escapeHtml(route.tech)}的检修</div>`}
    </section>`;
}

function renderStop(stop, index) {
  const job = stop.job;
  const slack = deadlineOf(job) - stop.finish;
  return `
    <li class="stop">
      <div class="timebox">
        <strong>${toTime(stop.start)}–${toTime(stop.finish)}</strong>
        ${index === 0
          ? `<small>${toTime(WORK_START)} 开工即上门</small>`
          : `<small>路程 ${TRAVEL_MINUTES} 分钟</small>`}
      </div>
      <div class="stop-body">
        <div class="row between wrap">
          <h3>${escapeHtml(job.community)} · ${escapeHtml(job.title)}</h3>
          ${job.urgent ? `<span class="urgent-tag">加急</span>` : ""}
        </div>
        <p class="meta">施工 ${durationOf(job)} 分钟 · 最晚 ${toTime(deadlineOf(job))} 完成 · 提前 ${slack} 分钟完工</p>
      </div>
    </li>`;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  })[char]);
}

function escapeAttr(value) {
  return escapeHtml(value);
}

// 事件统一委托：顺序按钮、编辑、删除、加单、重排、恢复
app.addEventListener("click", (event) => {
  const button = event.target.closest("[data-action]");
  if (!button) return;
  const card = button.closest("[data-id]");
  const id = card ? card.dataset.id : null;

  if (button.dataset.action === "up" || button.dataset.action === "down") {
    commit(moveOrdered(jobs, id, button.dataset.action === "up" ? -1 : 1));
  }
  if (button.dataset.action === "delete" && id) {
    commit(jobs.filter((job) => job.id !== id));
  }
});

app.addEventListener("change", (event) => {
  const field = event.target.closest("[data-field]");
  if (!field) return;
  const card = field.closest("[data-id]");
  if (!card) return;

  const key = field.dataset.field;
  const id = card.dataset.id;
  const value = field.type === "checkbox" ? field.checked : field.value;

  if (key === "urgent") {
    commit(withUrgent(jobs, id, value));
    return;
  }
  commit(jobs.map((job) => (job.id === id ? createJob({ ...job, [key]: value }) : job)));
});

app.addEventListener("submit", (event) => {
  if (event.target.id !== "job-form") return;
  event.preventDefault();
  const data = Object.fromEntries(new FormData(event.target));
  // 新单默认追加到同组末尾，再由规则/手动排序决定先后
  const next = [...jobs, createJob({
    community: data.community,
    title: data.title,
    minutes: Number(data.minutes),
    deadline: data.deadline,
    urgent: Boolean(data.urgent)
  })];
  commit(orderJobs(next));
});

app.addEventListener("click", (event) => {
  if (event.target.id === "auto-sort") {
    commit(ruleSortJobs(jobs));
  }
  if (event.target.id === "reset-seeds") {
    if (window.confirm("恢复预置五项会覆盖当前台账，确定继续？")) {
      commit(resetJobs());
    }
  }
});

render();
