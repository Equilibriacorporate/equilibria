const API = "";
const demoAccounts = {
  employee: { email: "colaborador@equilibria.demo", password: "demo123" },
  manager: { email: "rh@equilibria.demo", password: "demo123" },
};

let authToken = localStorage.getItem("equilibria_token") || "";
let currentUser = null;
let dashboardState = null;

const navButtons = document.querySelectorAll(".nav-item");
const roleButtons = document.querySelectorAll(".role-button");
const sections = document.querySelectorAll(".workspace-section");
const checkinForm = document.querySelector("#checkinForm");
const assistantForm = document.querySelector("#assistantForm");
const chatPanel = document.querySelector("#chatPanel");
const toast = document.querySelector("#toast");
const employeeCount = document.querySelector("#employeeCount");
const employeeOutput = document.querySelector("#employeeOutput");
const planSelect = document.querySelector("#planSelect");
const monthlyRevenue = document.querySelector("#monthlyRevenue");
const currentUserBadge = document.querySelector("#currentUser");
const logoutButton = document.querySelector("#logoutButton");
const backupButton = document.querySelector("#backupButton");
const authModal = document.querySelector("#authModal");
const loginForm = document.querySelector("#loginForm");
const registerForm = document.querySelector("#registerForm");
const userForm = document.querySelector("#userForm");
const userList = document.querySelector("#userList");

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  window.setTimeout(() => toast.classList.remove("show"), 2800);
}

function switchSection(sectionId) {
  sections.forEach((section) => section.classList.toggle("active", section.id === sectionId));
  navButtons.forEach((button) => button.classList.toggle("active", button.dataset.section === sectionId));
  window.scrollTo({ top: 0, behavior: "smooth" });
}

async function request(path, options = {}) {
  const response = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      ...(options.headers || {}),
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Erro de comunicação");
  return data;
}

function resetClientSession() {
  authToken = "";
  currentUser = null;
  dashboardState = null;
  localStorage.removeItem("equilibria_token");
  updateUserBadge();
  authModal.classList.add("show");
}

function percent(value) {
  return `${Math.round(value)}%`;
}

function decimal(value) {
  return Number(value || 0).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

function formatCurrency(value) {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });
}

function calculateRisk(entry) {
  const exhaustion = (10 - entry.energy) * 4;
  const pressure = entry.pressure * 4;
  const moodDrop = (10 - entry.mood) * 3;
  const lowSupport = (10 - entry.support) * 2;
  return Math.min(100, Math.round(exhaustion + pressure + moodDrop + lowSupport));
}

async function login(kind = "employee") {
  const account = demoAccounts[kind] || demoAccounts.employee;
  await loginWithCredentials(account.email, account.password);
}

async function loginWithCredentials(email, password) {
  const data = await request("/api/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  authToken = data.token;
  currentUser = data.user;
  localStorage.setItem("equilibria_token", authToken);
  authModal.classList.remove("show");
  updateUserBadge();
  await loadDashboard();
  await loadPersonalReport();
  await loadUsers();
  setRole(currentUser.role === "employee" ? "employee" : "manager", false);
  showToast(`Conectado como ${currentUser.name}.`);
}

async function registerCompany(formData) {
  const data = await request("/api/register-company", {
    method: "POST",
    body: JSON.stringify({
      companyName: formData.get("companyName"),
      name: formData.get("name"),
      email: formData.get("email"),
      password: formData.get("password"),
      teams: formData.get("teams"),
    }),
  });
  authToken = data.token;
  currentUser = data.user;
  localStorage.setItem("equilibria_token", authToken);
  authModal.classList.remove("show");
  updateUserBadge();
  await loadDashboard();
  await loadPersonalReport();
  await loadUsers();
  setRole("manager", false);
  showToast("Empresa criada. Você entrou como administrador.");
}

function updateUserBadge() {
  if (!currentUser) {
    currentUserBadge.textContent = "Não conectado";
    return;
  }
  const role = currentUser.role === "employee" ? "Colaborador" : "RH/Gestor";
  currentUserBadge.textContent = `${currentUser.name} · ${role}`;
}

function setRole(role, notify = true) {
  roleButtons.forEach((button) => button.classList.toggle("active", button.dataset.role === role));
  document.body.dataset.role = role;
  if (notify) showToast(role === "manager" ? "Visão de RH/Gestor ativada." : "Visão do colaborador ativada.");
}

async function loadDashboard() {
  dashboardState = await request("/api/dashboard");
  renderDashboard(dashboardState);
}

async function loadPersonalReport() {
  const personal = await request("/api/personal-report");
  renderPersonal(personal);
}

async function loadUsers() {
  if (!currentUser || currentUser.role === "employee") {
    userList.innerHTML = "<p>Disponível para RH/Gestor e administradores.</p>";
    return;
  }
  try {
    const data = await request("/api/users");
    renderUsers(data.users);
  } catch (error) {
    userList.innerHTML = `<p>${error.message}</p>`;
  }
}

function renderUsers(users) {
  userList.innerHTML = users
    .map(
      (user) => `
        <div class="user-row">
          <div>
            <strong>${user.name}</strong>
            <small>${user.email} · ${user.team}</small>
          </div>
          <span class="status-pill ${user.role === "employee" ? "private" : "stable"}">${user.role}</span>
        </div>
      `,
    )
    .join("");
}

function renderDashboard(data) {
  const { metrics, teams, alerts, recentEntries } = data;
  document.querySelector("#avgMood").textContent = decimal(metrics.mood);
  document.querySelector("#avgEnergy").textContent = percent(metrics.energy * 10);
  document.querySelector("#burnoutRisk").textContent = percent(metrics.risk);
  document.querySelector("#checkinRate").textContent = percent(metrics.checkinRate);
  document.querySelector("#checkinDetail").textContent = `${metrics.count} respostas registradas`;
  document.querySelector("#riskDetail").textContent = metrics.risk >= 45 ? "atenção prioritária" : "sinais sob monitoramento";
  document.querySelector("#riskSummary").textContent = metrics.risk >= 45 ? "Risco coletivo elevado" : "Risco moderado controlado";
  document.querySelector("#pulseScore").textContent = percent(Math.max(1, 100 - metrics.risk));

  renderAlerts(alerts);
  renderTeams(teams);
  renderInterventions(teams);
  drawPulse(recentEntries);
  drawTrend(recentEntries);
}

function renderAlerts(alerts) {
  const alertList = document.querySelector("#alertList");
  alertList.innerHTML = alerts
    .map(
      (alert) => `
        <article class="alert-item ${alert.level}">
          <strong>${alert.title}</strong>
          <p>${alert.text}</p>
        </article>
      `,
    )
    .join("");
}

function renderTeams(teams) {
  const teamTable = document.querySelector("#teamTable");
  teamTable.innerHTML = teams
    .map((team) => {
      const protectedText = team.sampleProtected ? "Privacidade" : null;
      const action = team.sampleProtected ? "Amostra mínima" : team.risk >= 45 ? "Intervenção prioritária" : team.risk >= 32 ? "Monitorar semana" : "Manter práticas";
      const mood = protectedText || `${team.mood}%`;
      const energy = protectedText || `${team.energy}%`;
      const risk = protectedText || `${team.risk}%`;
      const moodWidth = team.sampleProtected ? 0 : team.mood;
      const energyWidth = team.sampleProtected ? 0 : team.energy;
      const riskWidth = team.sampleProtected ? 0 : team.risk;
      return `
        <article class="team-row">
          <strong>${team.team}</strong>
          <div>
            <small>Humor ${mood}</small>
            <div class="progress"><span style="width:${moodWidth}%"></span></div>
          </div>
          <div>
            <small>Energia ${energy}</small>
            <div class="progress"><span style="width:${energyWidth}%"></span></div>
          </div>
          <div>
            <small>Risco ${risk}</small>
            <div class="progress risk"><span style="width:${riskWidth}%"></span></div>
          </div>
          <span class="status-pill ${team.risk >= 45 ? "danger" : "private"}">${action}</span>
        </article>
      `;
    })
    .join("");
}

function renderPersonal(personal) {
  document.querySelector("#personalReport").innerHTML = personal.items.map((item) => `<li>${item}</li>`).join("");
  document.querySelector("#carePlan").innerHTML = personal.carePlan
    .map(
      (item) => `
        <div class="care-item">
          <strong>${item.title}</strong>
          <p>${item.text}</p>
        </div>
      `,
    )
    .join("");
}

function renderInterventions(teams) {
  const board = document.querySelector("#interventionBoard");
  board.innerHTML = teams
    .slice()
    .sort((a, b) => (b.risk || 0) - (a.risk || 0))
    .map((team) => {
      const priority = team.sampleProtected ? "Privado" : team.risk >= 45 ? "Alta" : team.risk >= 32 ? "Média" : "Baixa";
      const action =
        team.sampleProtected
          ? "Aguardar amostra mínima antes de mostrar indicadores coletivos."
          : team.risk >= 45
          ? "Reunião de escuta, revisão de escala e bloqueio de demandas não essenciais por 7 dias."
          : team.risk >= 32
            ? "Acompanhar carga, reforçar combinados de prioridade e checar apoio da liderança."
            : "Manter rituais de feedback, pausas e reconhecimento.";
      return `
        <article class="intervention-card">
          <div>
            <span class="status-pill ${team.risk >= 45 ? "danger" : "private"}">${priority}</span>
            <h3>${team.team}</h3>
          </div>
          <p>${action}</p>
          <small>Baseado em humor, energia, pressão e apoio agregado.</small>
        </article>
      `;
    })
    .join("");
}

function updateOutputs() {
  ["energy", "pressure", "support"].forEach((name) => {
    const input = document.querySelector(`#${name}Input`);
    const output = document.querySelector(`#${name}Output`);
    output.value = input.value;
    output.textContent = input.value;
  });
}

function updatePricing() {
  const employees = Number(employeeCount.value);
  const price = Number(planSelect.value);
  const total = Math.max(299, employees * price);
  employeeOutput.textContent = employees;
  monthlyRevenue.textContent = formatCurrency(total);
}

function addMessage(text, fromUser = false) {
  const message = document.createElement("div");
  message.className = `message${fromUser ? " user" : ""}`;
  message.textContent = text;
  chatPanel.appendChild(message);
  chatPanel.scrollTop = chatPanel.scrollHeight;
}

async function exportSummary() {
  const data = await request("/api/export");
  const content = JSON.stringify(data.report, null, 2);
  try {
    await navigator.clipboard?.writeText(content);
    showToast("Relatório JSON copiado para a área de transferência.");
  } catch {
    const blob = new Blob([content], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = data.filename || "equilibria-relatorio.json";
    link.click();
    URL.revokeObjectURL(url);
    showToast("Relatório JSON baixado.");
  }
}

async function downloadJson(path, fallbackName) {
  const data = await request(path);
  const payload = data.backup || data.report || data;
  const content = JSON.stringify(payload, null, 2);
  const blob = new Blob([content], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = data.filename || fallbackName;
  link.click();
  URL.revokeObjectURL(url);
}

function drawPulse(entries = []) {
  const canvas = document.querySelector("#pulseCanvas");
  const ctx = canvas.getContext("2d");
  const width = canvas.width;
  const height = canvas.height;
  const values = entries.slice(-18).map((entry) => 100 - calculateRisk(entry));

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#17232d";
  ctx.fillRect(0, 0, width, height);

  for (let i = 0; i < 16; i += 1) {
    ctx.beginPath();
    ctx.strokeStyle = `rgba(255,255,255,${0.04 + i * 0.006})`;
    ctx.arc(width * 0.74, height * 0.5, 18 + i * 15, 0, Math.PI * 2);
    ctx.stroke();
  }

  const safeValues = values.length ? values : [72, 68, 73, 76, 71, 78];
  const stepX = width / Math.max(1, safeValues.length - 1);
  ctx.beginPath();
  ctx.lineWidth = 5;
  ctx.strokeStyle = "#43b581";
  safeValues.forEach((value, index) => {
    const x = index * stepX;
    const y = height - 48 - (value / 100) * (height - 96);
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();

  ctx.fillStyle = "rgba(255,255,255,0.92)";
  ctx.font = "700 20px system-ui";
  ctx.fillText("Pulso emocional em tempo real", 28, 48);
  ctx.fillStyle = "rgba(255,255,255,0.64)";
  ctx.font = "14px system-ui";
  ctx.fillText("humor, energia, pressão e apoio percebido", 28, 72);
}

function drawTrend(entries = []) {
  const canvas = document.querySelector("#trendCanvas");
  const ctx = canvas.getContext("2d");
  const width = canvas.width;
  const height = canvas.height;
  const padding = 38;
  const values = entries.slice(-14).map((entry) => Math.round((entry.mood + entry.energy + entry.support + (10 - entry.pressure)) * 2.5));
  const safeValues = values.length ? values : [72, 68, 71, 74, 66, 63, 69, 73];

  ctx.clearRect(0, 0, width, height);
  ctx.strokeStyle = "#dce3e7";
  ctx.lineWidth = 1;

  for (let i = 0; i < 5; i += 1) {
    const y = padding + (i * (height - padding * 2)) / 4;
    ctx.beginPath();
    ctx.moveTo(padding, y);
    ctx.lineTo(width - padding, y);
    ctx.stroke();
  }

  const stepX = (width - padding * 2) / Math.max(1, safeValues.length - 1);
  ctx.beginPath();
  ctx.lineWidth = 4;
  ctx.strokeStyle = "#14715c";
  safeValues.forEach((value, index) => {
    const x = padding + index * stepX;
    const y = height - padding - (value / 100) * (height - padding * 2);
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();

  safeValues.forEach((value, index) => {
    const x = padding + index * stepX;
    const y = height - padding - (value / 100) * (height - padding * 2);
    ctx.beginPath();
    ctx.fillStyle = value < 60 ? "#a76512" : "#2364aa";
    ctx.arc(x, y, 5, 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.fillStyle = "#66717f";
  ctx.font = "13px system-ui";
  ctx.fillText("baixo", 8, height - padding + 4);
  ctx.fillText("alto", 12, padding + 4);
}

navButtons.forEach((button) => {
  button.addEventListener("click", () => switchSection(button.dataset.section));
});

roleButtons.forEach((button) => {
  button.addEventListener("click", () => setRole(button.dataset.role));
});

document.querySelectorAll("[data-open-checkin]").forEach((button) => {
  button.addEventListener("click", () => switchSection("checkin"));
});

document.querySelectorAll("[data-section-shortcut]").forEach((button) => {
  button.addEventListener("click", () => switchSection(button.dataset.sectionShortcut));
});

document.querySelectorAll("[data-plan]").forEach((button) => {
  button.addEventListener("click", () => {
    const planPrices = { Essencial: "14.9", Profissional: "19.9", Enterprise: "39.9" };
    planSelect.value = planPrices[button.dataset.plan];
    updatePricing();
    document.querySelector(".pricing-simulator").scrollIntoView({ behavior: "smooth", block: "center" });
  });
});

document.querySelectorAll("[data-auth-mode]").forEach((button) => {
  button.addEventListener("click", () => {
    const mode = button.dataset.authMode;
    loginForm.classList.toggle("active", mode === "login");
    registerForm.classList.toggle("active", mode === "register");
  });
});

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(loginForm);
  try {
    await loginWithCredentials(formData.get("email"), formData.get("password"));
  } catch (error) {
    showToast(error.message);
  }
});

registerForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    await registerCompany(new FormData(registerForm));
  } catch (error) {
    showToast(error.message);
  }
});

userForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(userForm);
  try {
    const data = await request("/api/users", {
      method: "POST",
      body: JSON.stringify({
        name: formData.get("name"),
        email: formData.get("email"),
        password: formData.get("password"),
        team: formData.get("team"),
        role: formData.get("role"),
      }),
    });
    renderUsers(data.users);
    userForm.reset();
    showToast("Usuário criado com sucesso.");
  } catch (error) {
    showToast(error.message);
  }
});

document.querySelectorAll('input[type="range"]').forEach((input) => {
  input.addEventListener("input", () => {
    updateOutputs();
    if (input.id === "employeeCount") updatePricing();
  });
});

planSelect.addEventListener("change", updatePricing);

checkinForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(checkinForm);
  try {
    await request("/api/consents", {
      method: "POST",
      body: JSON.stringify({
        type: "checkin-privacy",
        accepted: formData.get("privacy") === "on",
      }),
    });
    const data = await request("/api/checkins", {
      method: "POST",
      body: JSON.stringify({
        team: formData.get("team"),
        moment: formData.get("moment"),
        mood: Number(formData.get("mood")),
        energy: Number(formData.get("energy")),
        pressure: Number(formData.get("pressure")),
        support: Number(formData.get("support")),
        note: formData.get("note").toString().trim(),
      }),
    });
    renderDashboard(data.dashboard);
    renderPersonal(data.personal);
    checkinForm.reset();
    updateOutputs();
    showToast("Check-in salvo no servidor.");
    switchSection("personal");
  } catch (error) {
    showToast(error.message);
  }
});

assistantForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(assistantForm);
  const text = formData.get("message").toString().trim();
  if (!text) return;
  addMessage(text, true);
  assistantForm.reset();
  try {
    const data = await request("/api/assistant", {
      method: "POST",
      body: JSON.stringify({ message: text }),
    });
    addMessage(data.reply);
  } catch (error) {
    addMessage("Não consegui responder agora. Tente novamente em instantes.");
  }
});

document.querySelector("#exportReport").addEventListener("click", async () => {
  try {
    await exportSummary();
  } catch (error) {
    showToast(error.message);
  }
});

backupButton.addEventListener("click", async () => {
  try {
    await downloadJson("/api/admin/backup", "equilibria-backup.json");
    showToast("Backup gerado.");
  } catch (error) {
    showToast(error.message);
  }
});

logoutButton.addEventListener("click", async () => {
  try {
    await request("/api/logout", { method: "POST", body: "{}" });
  } catch {
    // Mesmo se o servidor não responder, a sessão local deve ser encerrada.
  }
  resetClientSession();
  showToast("Sessão encerrada.");
});

async function boot() {
  updateOutputs();
  updatePricing();
  addMessage("Olá. Sou uma primeira escuta de apoio. Não faço diagnóstico e não substituo cuidado profissional, mas posso ajudar a organizar o próximo passo com calma.");
  try {
    if (authToken) {
      const data = await request("/api/me");
      currentUser = data.user;
      updateUserBadge();
      await loadDashboard();
      await loadPersonalReport();
      await loadUsers();
      setRole(currentUser.role === "employee" ? "employee" : "manager", false);
    } else {
      authModal.classList.add("show");
    }
  } catch {
    authToken = "";
    localStorage.removeItem("equilibria_token");
    authModal.classList.add("show");
    updateUserBadge();
  }
}

boot();
