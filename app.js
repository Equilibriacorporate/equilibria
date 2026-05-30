const API = "";
const demoAccounts = {
  employee: { email: "colaborador@equilibria.demo", password: "demo123" },
  manager: { email: "rh@equilibria.demo", password: "demo123" },
};

let authToken = localStorage.getItem("equilibria_token") || "";
let currentUser = null;
let dashboardState = null;
document.body.dataset.authenticated = "false";

const navButtons = document.querySelectorAll(".nav-item");
const roleButtons = document.querySelectorAll(".role-button");
const sections = document.querySelectorAll(".workspace-section");
const checkinForm = document.querySelector("#checkinForm");
const assistantForm = document.querySelector("#assistantForm");
const chatPanel = document.querySelector("#chatPanel");
const aiStatusBar = document.querySelector("#aiStatusBar");
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
const feedbackForm = document.querySelector("#feedbackForm");
const anonymousList = document.querySelector("#anonymousList");
const meetingPlan = document.querySelector("#meetingPlan");
const teamForm = document.querySelector("#teamForm");
const teamChipList = document.querySelector("#teamChipList");
const hseForm = document.querySelector("#hseForm");
const hseQuestionsContainer = document.querySelector("#hseQuestions");
const hseStatus = document.querySelector("#hseStatus");
const hseSummaryPanel = document.querySelector("#hseSummaryPanel");
const actionPlanBoard = document.querySelector("#actionPlanBoard");
const refreshActionPlan = document.querySelector("#refreshActionPlan");
const companyPlanSelect = document.querySelector("#companyPlanSelect");
const saveCompanyPlan = document.querySelector("#saveCompanyPlan");
const platformAdminPanel = document.querySelector("#platformAdminPanel");
const platformCompanyList = document.querySelector("#platformCompanyList");
const refreshPlatformCompanies = document.querySelector("#refreshPlatformCompanies");
const nr1Board = document.querySelector("#nr1Board");
const nr1Matrix = document.querySelector("#nr1Matrix");
const nr1Evidence = document.querySelector("#nr1Evidence");
const nr1ActionForm = document.querySelector("#nr1ActionForm");
const nr1RiskKey = document.querySelector("#nr1RiskKey");
const nr1ExportButton = document.querySelector("#nr1ExportButton");
const passwordForm = document.querySelector("#passwordForm");
const resetPasswordForm = document.querySelector("#resetPasswordForm");
const resetPasswordUser = document.querySelector("#resetPasswordUser");
const governanceForm = document.querySelector("#governanceForm");
const retentionDaysInput = document.querySelector("#retentionDaysInput");
const governanceCounts = document.querySelector("#governanceCounts");
const applyRetentionButton = document.querySelector("#applyRetentionButton");
const purgeDataForm = document.querySelector("#purgeDataForm");
const auditLogList = document.querySelector("#auditLogList");
const refreshAuditButton = document.querySelector("#refreshAuditButton");
const onboardingChecklist = document.querySelector("#onboardingChecklist");
const onboardingProgress = document.querySelector("#onboardingProgress");
const onboardingStatus = document.querySelector("#onboardingStatus");
const copyOnboardingMessage = document.querySelector("#copyOnboardingMessage");
const onboardingMessage = document.querySelector("#onboardingMessage");
const roleSwitcher = document.querySelector(".role-switcher");
const rhChatList = document.querySelector("#rhChatList");
const rhChatForm = document.querySelector("#rhChatForm");
const rhChatStatus = document.querySelector("#rhChatStatus");
const rhChatThreadSelect = document.querySelector("#rhChatThreadSelect");
const rhChatThreadLabel = document.querySelector("#rhChatThreadLabel");
const rhChatAnonymousLine = document.querySelector("#rhChatAnonymousLine");

let hseQuestions = [];
let nr1ReportState = null;
let rhChatThreads = [];

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  window.setTimeout(() => toast.classList.remove("show"), 2800);
}

function switchSection(sectionId) {
  if (currentUser && !allowedSections().includes(sectionId)) {
    sectionId = defaultSection();
  }
  sections.forEach((section) => section.classList.toggle("active", section.id === sectionId));
  navButtons.forEach((button) => button.classList.toggle("active", button.dataset.section === sectionId));
  document.body.dataset.activeSection = sectionId;
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function isPlatformAdmin() {
  return currentUser?.role === "admin" && currentUser?.email === "admin@equilibria.demo";
}

function planFeatures() {
  return dashboardState?.plan || {};
}

function hasFeature(feature) {
  return Boolean(planFeatures()[feature]);
}

function allowedSections() {
  if (!currentUser) return ["dashboard"];
  if (isPlatformAdmin()) {
    return ["dashboard", "checkin", "hse", "personal", "teams", "interventions", "actionplan", "nr1", "assistant", "feedback", "rhchat", "commercial", "onboarding", "governance", "admin"];
  }
  if (currentUser.role === "manager" || currentUser.role === "admin") {
    return [
      "dashboard",
      "hse",
      "teams",
      "interventions",
      "actionplan",
      "nr1",
      ...(hasFeature("hasAssistant") ? ["assistant"] : []),
      ...(hasFeature("hasFeedback") ? ["feedback"] : []),
      ...(hasFeature("hasRhChat") ? ["rhchat"] : []),
    ];
  }
  return [
    "checkin",
    ...(hasFeature("hasHse") ? ["hse"] : []),
    "personal",
    ...(hasFeature("hasAssistant") ? ["assistant"] : []),
    ...(hasFeature("hasFeedback") ? ["feedback"] : []),
    ...(hasFeature("hasRhChat") ? ["rhchat"] : []),
  ];
}

function defaultSection() {
  return allowedSections()[0] || "checkin";
}

function applyAccessControl() {
  const allowed = allowedSections();
  roleSwitcher?.classList.add("is-hidden");
  document.body.dataset.userRole = currentUser?.role || "guest";
  document.body.dataset.platformAdmin = isPlatformAdmin() ? "true" : "false";
  navButtons.forEach((button) => {
    const visible = allowed.includes(button.dataset.section);
    button.classList.toggle("is-hidden", !visible);
  });
  sections.forEach((section) => section.classList.toggle("is-hidden", !allowed.includes(section.id)));
  if (!allowed.includes(document.body.dataset.activeSection)) switchSection(defaultSection());
}

async function loadAppData() {
  await loadDashboard();
  applyAccessControl();
  await loadPersonalReport();
  await loadHseStatus();
  await loadAssistantStatus();
  if (isPlatformAdmin()) {
    await loadUsers();
    await loadPlatformCompanies();
    await loadGovernance();
    await loadAuditLogs();
  }
  if (currentUser?.role !== "employee") {
    await loadTeams();
    await loadFeedback();
    await loadActionPlan();
    await loadNr1Report();
  } else if (hasFeature("hasFeedback")) {
    await loadFeedback();
  }
  if (hasFeature("hasRhChat")) await loadRhChat();
  applyAccessControl();
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
  document.body.dataset.authenticated = "false";
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
  await loginWithCredentials(account.email, account.password, true);
}

async function loginWithCredentials(email, password, acceptedLegal = false) {
  const data = await request("/api/login", {
    method: "POST",
    body: JSON.stringify({ email, password, acceptedLegal }),
  });
  authToken = data.token;
  currentUser = data.user;
  localStorage.setItem("equilibria_token", authToken);
  authModal.classList.remove("show");
  document.body.dataset.authenticated = "true";
  updateUserBadge();
  await loadAppData();
  setRole(currentUser.role === "employee" ? "employee" : "manager", false);
  switchSection(defaultSection());
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
      acceptedTerms: formData.get("acceptedTerms") === "on",
      acceptedSensitiveData: formData.get("acceptedSensitiveData") === "on",
    }),
  });
  authToken = data.token;
  currentUser = data.user;
  localStorage.setItem("equilibria_token", authToken);
  authModal.classList.remove("show");
  document.body.dataset.authenticated = "true";
  updateUserBadge();
  await loadAppData();
  setRole("manager", false);
  switchSection(defaultSection());
  showToast("Empresa criada. Você entrou como administrador.");
}

function updateUserBadge() {
  if (!currentUser) {
    document.body.dataset.authenticated = "false";
    currentUserBadge.textContent = "Não conectado";
    return;
  }
  document.body.dataset.authenticated = "true";
  const role = isPlatformAdmin() ? "Admin Equilibria" : currentUser.role === "employee" ? "Colaborador" : "RH/Gestor";
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
  if (!userList) return;
  if (!isPlatformAdmin()) {
    userList.innerHTML = "<p>Área restrita à administração Equilibria.</p>";
    return;
  }
  try {
    const data = await request("/api/users");
    renderUsers(data.users);
  } catch (error) {
    userList.innerHTML = `<p>${error.message}</p>`;
  }
}

async function loadFeedback() {
  if (!anonymousList) return;
  try {
    const data = await request("/api/feedback");
    renderFeedback(data.feedback);
  } catch (error) {
    anonymousList.innerHTML = `<p>${error.message}</p>`;
  }
}

async function loadTeams() {
  if (!teamChipList) return;
  if (!currentUser || currentUser.role === "employee") return;
  try {
    const data = await request("/api/teams");
    renderTeamChips(data.teams || []);
  } catch (error) {
    teamChipList.innerHTML = `<p>${error.message}</p>`;
  }
}

async function loadRhChat() {
  if (!rhChatList) return;
  if (!hasFeature("hasRhChat")) {
    rhChatList.innerHTML = "<p>Chat RH-colaborador disponível apenas no plano Enterprise.</p>";
    if (rhChatStatus) rhChatStatus.textContent = "Bloqueado neste plano";
    return;
  }
  try {
    const data = await request("/api/rh-chat");
    renderRhChat(data.messages || [], data.canManage);
  } catch (error) {
    rhChatList.innerHTML = `<p>${error.message}</p>`;
    if (rhChatStatus) rhChatStatus.textContent = "Indisponível";
  }
}

async function loadHseStatus() {
  if (!hseQuestionsContainer) return;
  try {
    const data = await request("/api/hse-status");
    hseQuestions = data.questions || [];
    renderHseQuestions(hseQuestions, data.alreadyAnswered);
    renderHseSummary(data.summary, data.alreadyAnswered, data.month);
  } catch (error) {
    hseQuestionsContainer.innerHTML = `<p>${error.message}</p>`;
    hseSummaryPanel.innerHTML = `<p>${error.message}</p>`;
    hseStatus.textContent = "Indisponível no plano";
  }
}

async function loadActionPlan() {
  if (!actionPlanBoard) return;
  if (!currentUser || currentUser.role === "employee") {
    actionPlanBoard.innerHTML = "<p>Disponível para RH/Gestor nos planos Profissional e Enterprise.</p>";
    return;
  }
  try {
    const data = await request("/api/rh-action-plan");
    renderActionPlan(data);
  } catch (error) {
    actionPlanBoard.innerHTML = `<p>${error.message}</p>`;
  }
}

async function loadAssistantStatus() {
  if (!aiStatusBar) return;
  if (!currentUser) {
    aiStatusBar.textContent = "IA: aguardando login.";
    return;
  }
  try {
    const data = await request("/api/assistant/status");
    aiStatusBar.textContent = data.configured ? `IA: GPT ativo (${data.model})` : "IA: modo local ativo. Configure OPENAI_API_KEY no Render.";
    aiStatusBar.classList.toggle("is-openai", Boolean(data.configured));
  } catch (error) {
    aiStatusBar.textContent = error.message;
  }
}

async function loadNr1Report() {
  if (!nr1Board) return;
  if (!currentUser || currentUser.role === "employee") {
    nr1Board.innerHTML = "<p>Disponivel para RH/Gestor nos planos Profissional e Enterprise.</p>";
    if (nr1Matrix) nr1Matrix.innerHTML = "";
    if (nr1Evidence) nr1Evidence.innerHTML = "";
    return;
  }
  try {
    const data = await request("/api/nr1-report");
    nr1ReportState = data;
    renderNr1Report(data);
  } catch (error) {
    nr1Board.innerHTML = `<p>${error.message}</p>`;
    if (nr1Matrix) nr1Matrix.innerHTML = "";
    if (nr1Evidence) nr1Evidence.innerHTML = "";
  }
}

async function loadPlatformCompanies() {
  if (!platformAdminPanel || !platformCompanyList) return;
  const isPlatformAdmin = currentUser?.role === "admin" && currentUser?.email === "admin@equilibria.demo";
  platformAdminPanel.style.display = isPlatformAdmin ? "grid" : "none";
  if (!isPlatformAdmin) return;
  try {
    const data = await request("/api/platform/companies");
    renderPlatformCompanies(data.companies || []);
  } catch (error) {
    platformCompanyList.innerHTML = `<p>${error.message}</p>`;
  }
}

async function loadGovernance() {
  if (!governanceCounts) return;
  if (!isPlatformAdmin()) {
    governanceCounts.innerHTML = "<p>Área restrita à administração Equilibria.</p>";
    return;
  }
  try {
    const data = await request("/api/admin/governance");
    if (retentionDaysInput) retentionDaysInput.value = data.company.retentionDays || 180;
    renderGovernanceCounts(data.counts || {});
  } catch (error) {
    governanceCounts.innerHTML = `<p>${error.message}</p>`;
  }
}

async function loadAuditLogs() {
  if (!auditLogList) return;
  if (!isPlatformAdmin()) {
    auditLogList.innerHTML = "<p>Área restrita à administração Equilibria.</p>";
    return;
  }
  try {
    const data = await request("/api/admin/audit");
    renderAuditLogs(data.logs || []);
  } catch (error) {
    auditLogList.innerHTML = `<p>${error.message}</p>`;
  }
}

function renderPlatformCompanies(companies) {
  if (!companies.length) {
    platformCompanyList.innerHTML = "<p>Nenhuma empresa cadastrada ainda.</p>";
    return;
  }
  platformCompanyList.innerHTML = companies
    .map(
      (company) => `
        <article class="platform-company-card" data-company-id="${company.id}">
          <div class="platform-company-head">
            <div>
              <strong>${company.name}</strong>
              <small>${company.users} usuário(s) · ${company.checkins} check-in(s) · ${company.hseResponses} HSE · ${company.feedback} relato(s)</small>
            </div>
            <span class="status-pill ${company.active ? "stable" : "danger"}">${company.active ? labelCompanyStatus(company.status) : company.expired ? "Vencido" : labelCompanyStatus(company.status)}</span>
          </div>
          <div class="platform-company-controls">
            <label>
              Plano
              <select name="plan">
                ${["Essencial", "Profissional", "Enterprise"].map((plan) => `<option ${company.plan === plan ? "selected" : ""} value="${plan}">${plan}</option>`).join("")}
              </select>
            </label>
            <label>
              Status
              <select name="status">
                ${[
                  ["trial", "Teste"],
                  ["active", "Ativo"],
                  ["paused", "Pausado"],
                  ["cancelled", "Cancelado"],
                ]
                  .map(([value, label]) => `<option ${company.status === value ? "selected" : ""} value="${value}">${label}</option>`)
                  .join("")}
              </select>
            </label>
            <label>
              Vencimento
              <input name="expiresAt" type="date" value="${company.expiresAt || ""}" />
            </label>
            <label>
              Colaboradores
              <input name="employeeCount" min="1" type="number" value="${company.employeeCount || company.users || 1}" />
            </label>
            <label>
              Retenção
              <input name="retentionDays" min="30" max="1825" type="number" value="${company.retentionDays || 180}" />
            </label>
          </div>
          <button class="primary-button wide" data-save-company="${company.id}" type="button">Salvar cliente</button>
        </article>
      `,
    )
    .join("");
}

function labelCompanyStatus(status) {
  return {
    trial: "Teste",
    active: "Ativo",
    paused: "Pausado",
    cancelled: "Cancelado",
  }[status] || "Ativo";
}

function renderGovernanceCounts(counts) {
  const labels = {
    checkins: "Check-ins",
    consents: "Consentimentos",
    feedback: "Relatos",
    chatMessages: "Chat RH",
    hseResponses: "HSE",
    preventiveActions: "Ações NR-1",
    audit: "Logs",
  };
  governanceCounts.innerHTML = Object.entries(labels)
    .map(([key, label]) => `<article><strong>${counts[key] || 0}</strong><span>${label}</span></article>`)
    .join("");
}

function renderAuditLogs(logs) {
  if (!logs.length) {
    auditLogList.innerHTML = "<p>Nenhum log administrativo registrado ainda.</p>";
    return;
  }
  auditLogList.innerHTML = logs
    .map(
      (log) => `
        <article class="audit-log-item">
          <strong>${escapeHtml(labelAuditAction(log.action))}</strong>
          <span>${new Date(log.date).toLocaleString("pt-BR")}</span>
          <small>${escapeHtml(log.action)}${log.targetUserId ? ` · alvo: ${escapeHtml(log.targetUserId)}` : ""}</small>
        </article>
      `,
    )
    .join("");
}

function labelAuditAction(action) {
  return {
    "account.password.changed": "Senha alterada",
    "user.password.reset": "Senha redefinida pelo RH",
    "governance.retention.updated": "Política de retenção atualizada",
    "governance.retention.applied": "Retenção aplicada",
    "company.operational_data.purged": "Dados operacionais excluídos",
    "consent.recorded": "Consentimento registrado",
    "user.created": "Usuário criado",
    "company.created": "Empresa criada",
    "company.plan.updated": "Plano atualizado",
    "platform.company.updated": "Cliente atualizado",
    "checkin.created": "Check-in registrado",
    "feedback.created": "Relato anônimo registrado",
    "hse.response.created": "HSE respondido",
    "nr1.preventive_action.created": "Medida NR-1 criada",
    "nr1.preventive_action.updated": "Medida NR-1 atualizada",
  }[action] || action;
}

function loadOnboardingState() {
  if (!onboardingChecklist) return;
  const saved = JSON.parse(localStorage.getItem("equilibria_onboarding") || "{}");
  onboardingChecklist.querySelectorAll("[data-onboarding-item]").forEach((input) => {
    input.checked = Boolean(saved[input.dataset.onboardingItem]);
  });
  updateOnboardingProgress();
}

function updateOnboardingProgress() {
  if (!onboardingChecklist || !onboardingProgress) return;
  const inputs = Array.from(onboardingChecklist.querySelectorAll("[data-onboarding-item]"));
  const done = inputs.filter((input) => input.checked).length;
  const total = inputs.length;
  const saved = Object.fromEntries(inputs.map((input) => [input.dataset.onboardingItem, input.checked]));
  localStorage.setItem("equilibria_onboarding", JSON.stringify(saved));
  onboardingProgress.textContent = `${done}/${total} concluídos`;
  if (onboardingStatus) {
    onboardingStatus.textContent = done === total ? "Pronto para operar" : done >= 5 ? "Quase pronto" : "Pronto para piloto";
    onboardingStatus.className = `status-pill ${done === total ? "stable" : "private"}`;
  }
}

function renderHseQuestions(questions, alreadyAnswered) {
  if (!questions.length) {
    hseQuestionsContainer.innerHTML = "<p>Questionário indisponível.</p>";
    return;
  }
  hseStatus.textContent = alreadyAnswered ? "Respondido neste mês" : "Disponível este mês";
  hseForm.querySelector("button[type='submit']").disabled = alreadyAnswered;
  hseQuestionsContainer.innerHTML = questions
    .map(
      (question, index) => `
        <fieldset class="hse-question">
          <legend>${index + 1}. ${question.text}</legend>
          <div class="hse-scale">
            ${[1, 2, 3, 4, 5]
              .map(
                (value) => `
                  <label>
                    <input ${value === 3 ? "checked" : ""} name="${question.id}" type="radio" value="${value}" />
                    <span>${value}</span>
                  </label>
                `,
              )
              .join("")}
          </div>
        </fieldset>
      `,
    )
    .join("");
}

function renderHseSummary(summary, alreadyAnswered, month) {
  if (!summary) {
    hseSummaryPanel.innerHTML = alreadyAnswered ? `<p>Você já respondeu o questionário de ${month}. O RH vê apenas resultados agregados.</p>` : "<p>Após o envio, as respostas entram no resumo agregado do mês.</p>";
    return;
  }
  hseSummaryPanel.innerHTML = `
    <div class="hse-count">${summary.count} resposta(s) em ${summary.month}</div>
    ${summary.dimensions
      .map(
        (dimension) => `
          <div class="hse-dimension">
            <div><strong>${dimension.label}</strong><span>${dimension.percent}% favorável</span></div>
            <div class="progress ${dimension.percent < 60 ? "risk" : ""}"><span style="width:${dimension.percent}%"></span></div>
          </div>
        `,
      )
      .join("")}
  `;
}

function renderActionPlan(data) {
  actionPlanBoard.innerHTML = data.actions
    .map((item) => {
      const priorityClass = item.priority === "Alta" ? "alta" : item.priority === "Média" ? "media" : "baixa";
      return `
        <article class="action-card ${priorityClass}">
          <span class="status-pill ${item.priority === "Alta" ? "danger" : item.priority === "Média" ? "private" : "stable"}">${item.priority}</span>
          <h3>${item.focus}</h3>
          <p><strong>Evidência:</strong> ${item.evidence}</p>
          <p><strong>Ação:</strong> ${item.action}</p>
          <small>${item.owner} · prazo: ${item.deadline}</small>
        </article>
      `;
    })
    .join("");
}

function renderNr1Report(data) {
  if (!data?.risks?.length) {
    nr1Board.innerHTML = "<p>Sem riscos psicossociais calculados ainda. Estimule check-ins, HSE mensal e voz anonima.</p>";
    return;
  }

  if (nr1RiskKey) {
    nr1RiskKey.innerHTML = data.risks.map((risk) => `<option value="${risk.key}">${escapeHtml(risk.factor)}</option>`).join("");
  }

  nr1Matrix.innerHTML = `
    <article><strong>${data.matrix.critical}</strong><span>Criticos</span></article>
    <article><strong>${data.matrix.high}</strong><span>Altos</span></article>
    <article><strong>${data.matrix.medium}</strong><span>Medios</span></article>
    <article><strong>${data.summary.openActions}</strong><span>Acoes abertas</span></article>
  `;

  nr1Board.innerHTML = data.risks
    .map((risk) => {
      const levelClass = risk.level === "Critico" || risk.level === "Alto" ? "danger" : risk.level === "Medio" ? "private" : "stable";
      return `
        <article class="nr1-risk-card">
          <div class="nr1-risk-head">
            <div>
              <strong>${escapeHtml(risk.factor)}</strong>
              <small>${escapeHtml(risk.source)}</small>
            </div>
            <span class="status-pill ${levelClass}">${risk.level}</span>
          </div>
          <div class="nr1-risk-grid">
            <span>Probabilidade <b>${risk.probability}/5</b></span>
            <span>Severidade <b>${risk.severity}/5</b></span>
            <span>Indice <b>${risk.index}%</b></span>
            <span>Status <b>${risk.status}</b></span>
          </div>
          <p><strong>Medida preventiva:</strong> ${escapeHtml(risk.recommendedMeasure)}</p>
          <ul>${risk.evidence.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
        </article>
      `;
    })
    .join("");

  nr1Evidence.innerHTML = `
    <div class="nr1-actions">
      ${(data.actions || [])
        .map(
          (action) => `
            <article class="nr1-action ${action.status === "Concluida" ? "done" : ""}">
              <div>
                <strong>${escapeHtml(action.title)}</strong>
                <small>${escapeHtml(action.owner)} · prazo: ${escapeHtml(action.deadline)}</small>
              </div>
              <span class="status-pill ${action.status === "Concluida" ? "stable" : action.suggested ? "private" : "danger"}">${escapeHtml(action.status)}</span>
              ${action.suggested ? "" : `<button class="ghost-button" data-complete-action="${action.id}" type="button">Concluir</button>`}
            </article>
          `,
        )
        .join("")}
    </div>
    <div class="nr1-timeline">
      ${(data.evidenceTimeline || [])
        .map(
          (item) => `
            <article>
              <strong>${escapeHtml(item.type)}</strong>
              <span>${new Date(item.date).toLocaleDateString("pt-BR")}</span>
              <p>${escapeHtml(item.text)}</p>
            </article>
          `,
        )
        .join("")}
    </div>
    <p class="legal-note">${escapeHtml(data.disclaimer)}</p>
  `;
}

function renderFeedback(items) {
  if (!items.length) {
    anonymousList.innerHTML = currentUser?.role === "employee"
      ? "<p>Você ainda não enviou nenhum relato. Quando o RH responder, a devolutiva aparecerá aqui.</p>"
      : "<p>Nenhum relato anônimo registrado ainda.</p>";
    renderMeetingPlan([]);
    return;
  }
  renderMeetingPlan(items);
  const canManage = currentUser?.role !== "employee";
  anonymousList.innerHTML = items
    .map(
      (item) => `
        <article class="anonymous-item ${item.sentiment}">
          <div>
            <strong>${labelCategory(item.category)}</strong>
            <span>${escapeHtml(item.team || "Equipe não informada")} · ${labelSentiment(item.sentiment)}</span>
          </div>
          <p>${escapeHtml(item.message)}</p>
          <small>${new Date(item.createdAt).toLocaleString("pt-BR")}</small>
          ${item.suggestion ? renderFeedbackSuggestion(item.suggestion) : ""}
          ${renderFeedbackResponses(item.responses || [])}
          ${
            canManage
              ? `
                <div class="feedback-actions">
                  <button class="ghost-button" type="button" data-suggest-feedback="${item.id}">Sugerir ação</button>
                </div>
                <div class="feedback-response-form">
                  <textarea rows="2" data-feedback-response="${item.id}" placeholder="Responder ao colaborador sem revelar identidade"></textarea>
                  <button class="primary-button" type="button" data-send-feedback-response="${item.id}">Enviar resposta</button>
                </div>
              `
              : ""
          }
        </article>
      `,
    )
    .join("");
}

function renderFeedbackSuggestion(suggestion) {
  if (!suggestion) return "";
  return `
    <div class="feedback-suggestion">
      <strong>${escapeHtml(suggestion.focus || "Ação preventiva")}</strong>
      <p>${escapeHtml(suggestion.action || "")}</p>
      <span>${escapeHtml(suggestion.meetingAgenda || "")}</span>
      <small>Prazo sugerido: ${escapeHtml(suggestion.deadline || "7 dias")}</small>
    </div>
  `;
}

function renderFeedbackResponses(responses) {
  if (!responses.length) return "";
  return `
    <div class="feedback-response-list">
      ${responses
        .map(
          (response) => `
            <div class="feedback-response">
              <strong>Resposta do RH</strong>
              <p>${escapeHtml(response.message)}</p>
              <small>${new Date(response.createdAt).toLocaleString("pt-BR")}</small>
            </div>
          `,
        )
        .join("")}
    </div>
  `;
}

function renderMeetingPlan(items) {
  if (!meetingPlan) return;
  const suggested = items.filter((item) => item.suggestion);
  if (!suggested.length) {
    meetingPlan.innerHTML = "<p>Use “Sugerir ação” nos relatos para montar a pauta preventiva do RH.</p>";
    return;
  }
  meetingPlan.innerHTML = suggested
    .slice(0, 5)
    .map(
      (item) => `
        <article>
          <strong>${escapeHtml(item.suggestion.focus)}</strong>
          <p>${escapeHtml(item.suggestion.meetingAgenda)}</p>
          <small>${escapeHtml(item.team || "Equipe não informada")} · ${labelSentiment(item.sentiment)}</small>
        </article>
      `,
    )
    .join("");
}

function renderTeamChips(teams) {
  if (!teamChipList) return;
  if (!teams.length) {
    teamChipList.innerHTML = "<p>Nenhuma equipe cadastrada ainda.</p>";
    return;
  }
  teamChipList.innerHTML = teams.map((team) => `<span>${escapeHtml(team)}</span>`).join("");
}

function renderRhChat(messages, canManage) {
  if (!rhChatList) return;
  const threads = Array.from(
    messages.reduce((map, item) => {
      const current = map.get(item.threadId) || { threadId: item.threadId, label: item.anonymous ? "Conversa anônima" : item.senderName, team: item.team, messages: [] };
      current.messages.push(item);
      if (!item.anonymous && item.senderRole === "employee") current.label = item.senderName;
      map.set(item.threadId, current);
      return map;
    }, new Map()).values(),
  ).sort((a, b) => new Date(b.messages.at(-1)?.createdAt || 0) - new Date(a.messages.at(-1)?.createdAt || 0));

  rhChatThreads = threads;
  if (rhChatStatus) rhChatStatus.textContent = canManage ? `${threads.length} conversa(s)` : "Canal direto com RH";
  if (rhChatThreadLabel) rhChatThreadLabel.style.display = canManage ? "grid" : "none";
  if (rhChatAnonymousLine) rhChatAnonymousLine.style.display = canManage ? "none" : "flex";
  if (rhChatThreadSelect) {
    rhChatThreadSelect.innerHTML = threads.map((thread) => `<option value="${thread.threadId}">${escapeHtml(thread.label)} · ${escapeHtml(thread.team || "sem equipe")}</option>`).join("");
  }

  if (!messages.length) {
    rhChatList.innerHTML = canManage
      ? "<p>Nenhuma conversa iniciada ainda. Quando um colaborador escrever, aparecerá aqui.</p>"
      : "<p>Nenhuma mensagem ainda. Você pode iniciar uma conversa com o RH.</p>";
    return;
  }

  rhChatList.innerHTML = threads
    .map(
      (thread) => `
        <article class="rh-chat-thread">
          <div class="rh-chat-thread-head">
            <strong>${escapeHtml(thread.label)}</strong>
            <span>${escapeHtml(thread.team || "Equipe não informada")}</span>
          </div>
          <div class="rh-chat-messages">
            ${thread.messages
              .map(
                (item) => `
                  <div class="rh-chat-message ${item.fromMe ? "from-me" : ""}">
                    <span>${escapeHtml(item.senderName || "Mensagem")} · ${new Date(item.createdAt).toLocaleString("pt-BR")}</span>
                    <p>${escapeHtml(item.message)}</p>
                  </div>
                `,
              )
              .join("")}
          </div>
        </article>
      `,
    )
    .join("");
}

function labelCategory(category) {
  return {
    jornada: "Jornada e carga",
    lideranca: "Liderança",
    processo: "Processos",
    ambiente: "Ambiente e relações",
    sugestao: "Sugestão de melhoria",
  }[category] || "Jornada";
}

function labelSentiment(sentiment) {
  return {
    neutro: "Neutro",
    preocupacao: "Preocupação",
    urgente: "Urgente",
    positivo: "Positivo",
  }[sentiment] || "Neutro";
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderUsers(users) {
  if (resetPasswordUser) {
    resetPasswordUser.innerHTML = users.map((user) => `<option value="${user.id}">${escapeHtml(user.name)} · ${escapeHtml(user.email)}</option>`).join("");
  }
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
  if (companyPlanSelect && data.company?.plan) companyPlanSelect.value = data.company.plan;
  document.querySelector("#avgMood").textContent = decimal(metrics.mood);
  document.querySelector("#avgEnergy").textContent = percent(metrics.energy * 10);
  document.querySelector("#burnoutRisk").textContent = percent(metrics.risk);
  document.querySelector("#checkinRate").textContent = percent(metrics.checkinRate);
  document.querySelector("#checkinDetail").textContent = `${metrics.count} respostas registradas`;
  document.querySelector("#riskDetail").textContent = metrics.risk >= 45 ? "atenção prioritária" : "sinais sob monitoramento";
  document.querySelector("#riskSummary").textContent = metrics.risk >= 45 ? "Risco coletivo elevado" : "Risco moderado controlado";
  document.querySelector("#pulseScore").textContent = percent(Math.max(1, 100 - metrics.risk));
  const visibleTeams = teams.filter((team) => !team.sampleProtected);
  const topTeam = visibleTeams.slice().sort((a, b) => (b.risk || 0) - (a.risk || 0))[0];
  const topRiskTeam = document.querySelector("#topRiskTeam");
  const topRiskAction = document.querySelector("#topRiskAction");
  const nr1Readiness = document.querySelector("#nr1Readiness");
  const nextBestAction = document.querySelector("#nextBestAction");
  if (topRiskTeam) topRiskTeam.textContent = topTeam ? `${topTeam.team} · ${topTeam.risk}%` : "Amostra protegida";
  if (topRiskAction) topRiskAction.textContent = topTeam && topTeam.risk >= 45 ? "Abrir escuta com lideranca e revisar carga em ate 7 dias." : "Manter check-ins e observar tendencia semanal.";
  if (nr1Readiness) nr1Readiness.textContent = metrics.count >= 10 ? "Evidencias em formacao" : "Coletar mais sinais";
  if (nextBestAction) nextBestAction.textContent = metrics.risk >= 45 ? "Acionar Plano RH" : "Revisar NR-1/PGR";

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
    await loginWithCredentials(formData.get("email"), formData.get("password"), formData.get("acceptedLegal") === "on");
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
    await loadAuditLogs();
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

feedbackForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(feedbackForm);
  try {
    await request("/api/feedback", {
      method: "POST",
      body: JSON.stringify({
        category: formData.get("category"),
        sentiment: formData.get("sentiment"),
        message: formData.get("message"),
      }),
    });
    feedbackForm.reset();
    await loadFeedback();
    await loadActionPlan();
    await loadNr1Report();
    showToast("Relato anônimo enviado com segurança.");
  } catch (error) {
    showToast(error.message);
  }
});

teamForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(teamForm);
  try {
    const data = await request("/api/teams", {
      method: "POST",
      body: JSON.stringify({ team: formData.get("team") }),
    });
    renderTeamChips(data.teams || []);
    teamForm.reset();
    await loadDashboard();
    showToast("Equipe cadastrada para relatórios e métricas.");
  } catch (error) {
    showToast(error.message);
  }
});

anonymousList?.addEventListener("click", async (event) => {
  const suggestButton = event.target.closest("[data-suggest-feedback]");
  const responseButton = event.target.closest("[data-send-feedback-response]");
  try {
    if (suggestButton) {
      const id = suggestButton.dataset.suggestFeedback;
      suggestButton.disabled = true;
      suggestButton.textContent = "Gerando...";
      await request(`/api/feedback/${encodeURIComponent(id)}/suggestion`, { method: "POST" });
      await loadFeedback();
      showToast("Ação preventiva sugerida para o RH.");
    }
    if (responseButton) {
      const id = responseButton.dataset.sendFeedbackResponse;
      const field = anonymousList.querySelector(`[data-feedback-response="${CSS.escape(id)}"]`);
      const message = field?.value || "";
      await request(`/api/feedback/${encodeURIComponent(id)}/response`, {
        method: "POST",
        body: JSON.stringify({ message }),
      });
      await loadFeedback();
      showToast("Resposta enviada ao colaborador.");
    }
  } catch (error) {
    showToast(error.message);
  }
});

rhChatForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(rhChatForm);
  try {
    const data = await request("/api/rh-chat", {
      method: "POST",
      body: JSON.stringify({
        threadId: formData.get("threadId"),
        message: formData.get("message"),
        anonymous: formData.get("anonymous") === "on",
      }),
    });
    rhChatForm.reset();
    renderRhChat(data.messages || [], data.canManage);
    showToast("Mensagem enviada ao chat.");
  } catch (error) {
    showToast(error.message);
  }
});

planSelect.addEventListener("change", updatePricing);

companyPlanSelect?.addEventListener("change", () => {
  const prices = { Essencial: "14.9", Profissional: "19.9", Enterprise: "39.9" };
  planSelect.value = prices[companyPlanSelect.value] || "19.9";
  updatePricing();
});

saveCompanyPlan?.addEventListener("click", async () => {
  try {
    await request("/api/company/plan", {
      method: "POST",
      body: JSON.stringify({ plan: companyPlanSelect.value }),
    });
    await loadDashboard();
    await loadHseStatus();
    await loadActionPlan();
    await loadNr1Report();
    showToast(`Plano ${companyPlanSelect.value} aplicado.`);
  } catch (error) {
    showToast(error.message);
  }
});

hseForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(hseForm);
  const answers = Object.fromEntries(hseQuestions.map((question) => [question.id, Number(formData.get(question.id))]));
  try {
    await request("/api/hse-responses", {
      method: "POST",
      body: JSON.stringify({ answers, notes: formData.get("notes") }),
    });
    hseForm.reset();
    await loadHseStatus();
    await loadActionPlan();
    await loadNr1Report();
    showToast("Questionário mensal enviado.");
  } catch (error) {
    showToast(error.message);
  }
});

refreshActionPlan?.addEventListener("click", loadActionPlan);
refreshPlatformCompanies?.addEventListener("click", loadPlatformCompanies);
refreshAuditButton?.addEventListener("click", loadAuditLogs);
onboardingChecklist?.addEventListener("change", updateOnboardingProgress);
copyOnboardingMessage?.addEventListener("click", async () => {
  const text = onboardingMessage?.textContent?.trim() || "";
  try {
    await navigator.clipboard?.writeText(text);
    showToast("Mensagem de convite copiada.");
  } catch {
    showToast("Mensagem pronta para copiar manualmente.");
  }
});

passwordForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(passwordForm);
  try {
    await request("/api/account/password", {
      method: "POST",
      body: JSON.stringify({
        currentPassword: formData.get("currentPassword"),
        newPassword: formData.get("newPassword"),
      }),
    });
    passwordForm.reset();
    await loadAuditLogs();
    showToast("Senha alterada com sucesso.");
  } catch (error) {
    showToast(error.message);
  }
});

resetPasswordForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(resetPasswordForm);
  try {
    await request(`/api/users/${encodeURIComponent(formData.get("userId"))}/password`, {
      method: "PATCH",
      body: JSON.stringify({ newPassword: formData.get("newPassword") }),
    });
    resetPasswordForm.reset();
    await loadAuditLogs();
    showToast("Senha do usuário redefinida.");
  } catch (error) {
    showToast(error.message);
  }
});

governanceForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(governanceForm);
  try {
    const data = await request("/api/admin/governance", {
      method: "PATCH",
      body: JSON.stringify({ retentionDays: Number(formData.get("retentionDays")) }),
    });
    renderGovernanceCounts(data.counts || {});
    await loadAuditLogs();
    showToast("Política de retenção salva.");
  } catch (error) {
    showToast(error.message);
  }
});

applyRetentionButton?.addEventListener("click", async () => {
  try {
    const data = await request("/api/admin/apply-retention", { method: "POST", body: "{}" });
    renderGovernanceCounts(data.counts || {});
    await loadAuditLogs();
    showToast("Retenção aplicada.");
  } catch (error) {
    showToast(error.message);
  }
});

purgeDataForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(purgeDataForm);
  try {
    const data = await request("/api/admin/purge-company-data", {
      method: "POST",
      body: JSON.stringify({ confirmation: formData.get("confirmation") }),
    });
    renderGovernanceCounts(data.counts || {});
    purgeDataForm.reset();
    await loadDashboard();
    await loadFeedback();
    await loadHseStatus();
    await loadActionPlan();
    await loadNr1Report();
    await loadAuditLogs();
    showToast("Dados operacionais excluídos.");
  } catch (error) {
    showToast(error.message);
  }
});
nr1ExportButton?.addEventListener("click", async () => {
  try {
    const data = nr1ReportState || (await request("/api/nr1-report"));
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `equilibria-nr1-pgr-${data.month || "relatorio"}.json`;
    link.click();
    URL.revokeObjectURL(url);
    showToast("Relatorio NR-1/PGR baixado.");
  } catch (error) {
    showToast(error.message);
  }
});

nr1ActionForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(nr1ActionForm);
  try {
    const data = await request("/api/preventive-actions", {
      method: "POST",
      body: JSON.stringify({
        riskKey: formData.get("riskKey"),
        title: formData.get("title"),
        owner: formData.get("owner"),
        deadline: formData.get("deadline"),
        evidence: formData.get("evidence"),
      }),
    });
    nr1ReportState = data.report;
    renderNr1Report(data.report);
    nr1ActionForm.reset();
    showToast("Medida preventiva registrada.");
  } catch (error) {
    showToast(error.message);
  }
});

nr1Evidence?.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-complete-action]");
  if (!button) return;
  try {
    const data = await request(`/api/preventive-actions/${encodeURIComponent(button.dataset.completeAction)}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "Concluida" }),
    });
    nr1ReportState = data.report;
    renderNr1Report(data.report);
    showToast("Medida marcada como concluida.");
  } catch (error) {
    showToast(error.message);
  }
});

platformCompanyList?.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-save-company]");
  if (!button) return;
  const card = button.closest(".platform-company-card");
  const companyId = button.dataset.saveCompany;
  try {
    await request(`/api/platform/companies/${encodeURIComponent(companyId)}`, {
      method: "PATCH",
      body: JSON.stringify({
        plan: card.querySelector('[name="plan"]').value,
        status: card.querySelector('[name="status"]').value,
        expiresAt: card.querySelector('[name="expiresAt"]').value,
        employeeCount: Number(card.querySelector('[name="employeeCount"]').value),
        retentionDays: Number(card.querySelector('[name="retentionDays"]').value),
      }),
    });
    await loadPlatformCompanies();
    showToast("Cliente atualizado.");
  } catch (error) {
    showToast(error.message);
  }
});

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
    await loadActionPlan();
    await loadNr1Report();
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
    if (aiStatusBar) {
      aiStatusBar.textContent = data.source === "openai" ? `IA: resposta via GPT (${data.model})` : "IA: resposta em modo local. Verifique a chave da OpenAI no Render.";
      aiStatusBar.classList.toggle("is-openai", data.source === "openai");
    }
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
  loadOnboardingState();
  addMessage("Olá. Sou uma primeira escuta de apoio. Não faço diagnóstico e não substituo cuidado profissional, mas posso ajudar a organizar o próximo passo com calma.");
  try {
    if (authToken) {
      const data = await request("/api/me");
      currentUser = data.user;
      updateUserBadge();
      await loadAppData();
      setRole(currentUser.role === "employee" ? "employee" : "manager", false);
      switchSection(defaultSection());
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
