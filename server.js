import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PORT = Number(globalThis.EQUILIBRIA_PORT || globalThis.process?.env?.PORT || 5290);
const HOST = globalThis.process?.env?.HOST || "0.0.0.0";
const SESSION_TTL_MS = Number(globalThis.process?.env?.SESSION_TTL_MS || 1000 * 60 * 60 * 8);
const LOGIN_WINDOW_MS = 1000 * 60 * 10;
const LOGIN_MAX_ATTEMPTS = 8;
const MIN_TEAM_SAMPLE = Number(globalThis.process?.env?.MIN_TEAM_SAMPLE || 3);
const OPENAI_API_KEY = globalThis.process?.env?.OPENAI_API_KEY || "";
const OPENAI_MODEL = globalThis.process?.env?.OPENAI_MODEL || "gpt-4o-mini";
const OPENAI_TIMEOUT_MS = Number(globalThis.process?.env?.OPENAI_TIMEOUT_MS || 18000);
const ROOT = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(ROOT, "data");
const DB_PATH = path.join(DATA_DIR, "equilibria-db.json");
const sessions = new Map();
const loginAttempts = new Map();

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".pdf": "application/pdf",
  ".md": "text/markdown; charset=utf-8",
};

const securityHeaders = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Content-Security-Policy": "default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'",
};

const demoPassword = "demo123";

const planCatalog = {
  Essencial: {
    name: "Essencial",
    price: 14.9,
    features: ["Check-in diário", "Relatório pessoal", "Indicadores básicos", "Exportação simples"],
    limits: ["Sem IA de apoio", "Sem voz anônima", "Sem questionário mensal HSE", "Sem plano de ação RH"],
    hasAssistant: false,
    hasFeedback: false,
    hasHse: false,
    hasActionPlan: false,
    hasNr1: false,
  },
  Profissional: {
    name: "Profissional",
    price: 19.9,
    features: ["IA de apoio", "Voz anônima", "Questionário mensal tipo HSE", "Plano de ação RH", "Risco por equipe"],
    limits: ["Relatórios avançados sob demanda no Enterprise"],
    hasAssistant: true,
    hasFeedback: true,
    hasHse: true,
    hasActionPlan: true,
    hasNr1: true,
  },
  Enterprise: {
    name: "Enterprise",
    price: 39.9,
    features: ["Tudo do Profissional", "Governança avançada", "Suporte de implantação", "Relatórios personalizados", "Múltiplas unidades"],
    limits: [],
    hasAssistant: true,
    hasFeedback: true,
    hasHse: true,
    hasActionPlan: true,
    hasNr1: true,
  },
};

const hseDimensions = {
  demands: "Demandas",
  control: "Controle",
  support: "Apoio",
  relationships: "Relacionamentos",
  role: "Papel",
  change: "Mudanças",
};

const hseQuestions = [
  { id: "demands_1", dimension: "demands", text: "Minha carga de trabalho tem sido administrável." },
  { id: "demands_2", dimension: "demands", text: "Tenho tempo suficiente para realizar minhas atividades com qualidade." },
  { id: "demands_3", dimension: "demands", text: "As exigências do trabalho estão compatíveis com os recursos disponíveis." },
  { id: "control_1", dimension: "control", text: "Tenho autonomia adequada para organizar a forma como realizo meu trabalho." },
  { id: "control_2", dimension: "control", text: "Consigo participar de decisões que afetam minha rotina." },
  { id: "control_3", dimension: "control", text: "Tenho clareza para priorizar tarefas quando há muitas demandas." },
  { id: "support_1", dimension: "support", text: "Recebo apoio da liderança quando encontro dificuldades." },
  { id: "support_2", dimension: "support", text: "Recebo apoio dos colegas quando preciso." },
  { id: "support_3", dimension: "support", text: "A empresa oferece orientação suficiente para lidar com períodos de pressão." },
  { id: "relationships_1", dimension: "relationships", text: "O ambiente de trabalho favorece respeito e colaboração." },
  { id: "relationships_2", dimension: "relationships", text: "Conflitos são tratados de forma adequada." },
  { id: "relationships_3", dimension: "relationships", text: "Sinto segurança para expressar preocupações sem receio de retaliação." },
  { id: "role_1", dimension: "role", text: "Tenho clareza sobre minhas responsabilidades." },
  { id: "role_2", dimension: "role", text: "Entendo como meu trabalho contribui para os objetivos da empresa." },
  { id: "role_3", dimension: "role", text: "Recebo orientações claras sobre o que é esperado de mim." },
  { id: "change_1", dimension: "change", text: "Mudanças na empresa são comunicadas com antecedência razoável." },
  { id: "change_2", dimension: "change", text: "Entendo os motivos das mudanças que afetam minha rotina." },
  { id: "change_3", dimension: "change", text: "Tenho espaço para tirar dúvidas durante mudanças importantes." },
];

const psychosocialRiskFactors = {
  demands: {
    label: "Demandas e carga de trabalho",
    source: "Check-ins, questionario mensal e relatos anonimos",
    measure: "Revisar volume de demandas, prioridades, pausas e dimensionamento da equipe.",
  },
  control: {
    label: "Autonomia e controle sobre a rotina",
    source: "Questionario mensal tipo HSE",
    measure: "Dar mais previsibilidade, autonomia de organizacao e participacao em decisoes da rotina.",
  },
  support: {
    label: "Apoio de lideranca e colegas",
    source: "Check-ins, HSE e plano de acao RH",
    measure: "Criar rituais de apoio, check-ins de lideranca e canais claros para bloqueios.",
  },
  relationships: {
    label: "Relacionamentos, respeito e conflitos",
    source: "Voz anonima e HSE",
    measure: "Abrir escuta segura, tratar conflitos recorrentes e reforcar condutas esperadas.",
  },
  role: {
    label: "Clareza de papel e expectativas",
    source: "HSE e relatos sobre processos",
    measure: "Revisar responsabilidades, criterios de sucesso e comunicacao de prioridades.",
  },
  change: {
    label: "Gestao de mudancas",
    source: "HSE e relatos sobre jornada",
    measure: "Comunicar mudancas com antecedencia, explicar motivos e registrar duvidas recorrentes.",
  },
};

function hashPassword(password, salt) {
  return crypto.createHash("sha256").update(`${salt}:${password}`).digest("hex");
}

function createPasswordHash(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(String(password), salt, 64).toString("hex");
  return `scrypt:${salt}:${hash}`;
}

function verifyPassword(password, user) {
  if (String(user.passwordHash || "").startsWith("scrypt:")) {
    const [, salt, storedHash] = user.passwordHash.split(":");
    const hash = crypto.scryptSync(String(password), salt, 64);
    const stored = Buffer.from(storedHash, "hex");
    return stored.length === hash.length && crypto.timingSafeEqual(stored, hash);
  }
  const legacy = hashPassword(String(password), user.salt);
  return crypto.timingSafeEqual(Buffer.from(legacy), Buffer.from(user.passwordHash || ""));
}

function createSession(user) {
  const token = crypto.randomBytes(32).toString("hex");
  sessions.set(token, { userId: user.id, createdAt: Date.now(), expiresAt: Date.now() + SESSION_TTL_MS });
  return token;
}

function cleanupSessions() {
  const now = Date.now();
  for (const [token, session] of sessions.entries()) {
    if (session.expiresAt <= now) sessions.delete(token);
  }
}

function isRateLimited(key) {
  const now = Date.now();
  const current = loginAttempts.get(key) || [];
  const fresh = current.filter((time) => now - time < LOGIN_WINDOW_MS);
  fresh.push(now);
  loginAttempts.set(key, fresh);
  return fresh.length > LOGIN_MAX_ATTEMPTS;
}

function riskScore(entry) {
  const exhaustion = (10 - entry.energy) * 4;
  const pressure = entry.pressure * 4;
  const moodDrop = (10 - entry.mood) * 3;
  const lowSupport = (10 - entry.support) * 2;
  return Math.min(100, Math.round(exhaustion + pressure + moodDrop + lowSupport));
}

function average(values) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function createSeedData() {
  const salt = "equilibria-demo";
  const users = [
    {
      id: "u_colab_ana",
      companyId: "c_demo",
      name: "Ana Colaboradora",
      email: "colaborador@equilibria.demo",
      role: "employee",
      team: "Atendimento",
      salt,
      passwordHash: hashPassword(demoPassword, salt),
    },
    {
      id: "u_rh_marina",
      companyId: "c_demo",
      name: "Marina RH",
      email: "rh@equilibria.demo",
      role: "manager",
      team: "RH",
      salt,
      passwordHash: hashPassword(demoPassword, salt),
    },
    {
      id: "u_admin_lucas",
      companyId: "c_demo",
      name: "Lucas Admin",
      email: "admin@equilibria.demo",
      role: "admin",
      team: "Diretoria",
      salt,
      passwordHash: hashPassword(demoPassword, salt),
    },
  ];

  const entries = [
    ["2026-05-14T09:00:00", "Atendimento", "Entrada", 6, 6, 6, 5, "Fila alta desde cedo."],
    ["2026-05-14T18:00:00", "Atendimento", "Saída", 4, 4, 8, 5, "Fim do dia pesado."],
    ["2026-05-15T09:00:00", "Comercial", "Entrada", 7, 7, 5, 7, ""],
    ["2026-05-15T18:00:00", "Comercial", "Saída", 6, 6, 7, 6, "Metas apertadas."],
    ["2026-05-16T09:00:00", "Produto", "Entrada", 8, 8, 4, 8, ""],
    ["2026-05-16T18:00:00", "Produto", "Saída", 8, 7, 4, 8, "Boa colaboração."],
    ["2026-05-17T09:00:00", "Operações", "Entrada", 6, 6, 6, 6, ""],
    ["2026-05-17T18:00:00", "Operações", "Saída", 5, 4, 8, 5, "Muitas urgências no turno."],
    ["2026-05-20T09:00:00", "Financeiro", "Entrada", 7, 6, 5, 8, ""],
    ["2026-05-20T18:00:00", "Financeiro", "Saída", 7, 6, 5, 8, ""],
    ["2026-05-21T09:00:00", "Atendimento", "Entrada", 5, 5, 7, 5, "Equipe reduzida."],
    ["2026-05-21T18:00:00", "Atendimento", "Saída", 3, 3, 9, 4, "Exaustão no fechamento."],
    ["2026-05-22T09:00:00", "Produto", "Entrada", 8, 8, 4, 9, ""],
    ["2026-05-22T18:00:00", "Produto", "Saída", 7, 7, 5, 8, ""],
  ].map((row, index) => ({
    id: `chk_${index + 1}`,
    companyId: "c_demo",
    userId: index % 3 === 0 ? "u_colab_ana" : `anon_${index}`,
    date: row[0],
    team: row[1],
    moment: row[2],
    mood: row[3],
    energy: row[4],
    pressure: row[5],
    support: row[6],
    note: row[7],
  }));

  return {
    companies: [
      {
        id: "c_demo",
        name: "Empresa Demo",
        plan: "Profissional",
        status: "trial",
        expiresAt: "2026-06-30",
        employeeCount: 100,
        retentionDays: 180,
        teams: ["Atendimento", "Comercial", "Produto", "Operações", "Financeiro"],
      },
    ],
    users,
    checkins: entries,
    consents: [],
    feedback: [],
    preventiveActions: [],
    hseResponses: [
      {
        id: "hse_demo_1",
        companyId: "c_demo",
        userId: "u_colab_ana",
        team: "Atendimento",
        month: "2026-05",
        answers: Object.fromEntries(hseQuestions.map((question, index) => [question.id, index % 3 === 0 ? 2 : index % 3 === 1 ? 3 : 4])),
        notes: "Carga alta em dias de fila cheia e pouca previsibilidade nas mudanças de escala.",
        createdAt: "2026-05-22T12:00:00.000Z",
      },
    ],
    audit: [],
    createdAt: new Date().toISOString(),
  };
}

function ensureDb({ reset = false } = {}) {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (reset || !fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, JSON.stringify(createSeedData(), null, 2), "utf8");
  }
}

function readDb() {
  ensureDb();
  return JSON.parse(fs.readFileSync(DB_PATH, "utf8"));
}

function writeDb(db) {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), "utf8");
}

function addAudit(db, { action, userId = "", companyId = "", targetUserId = "", changes = {}, detail = "" }) {
  db.audit = db.audit || [];
  db.audit.push({
    id: `audit_${Date.now()}_${crypto.randomBytes(3).toString("hex")}`,
    action,
    userId,
    companyId,
    targetUserId,
    changes,
    detail,
    date: new Date().toISOString(),
  });
}

function companyDataCounts(db, companyId) {
  return {
    checkins: (db.checkins || []).filter((item) => item.companyId === companyId).length,
    consents: (db.consents || []).filter((item) => item.companyId === companyId).length,
    feedback: (db.feedback || []).filter((item) => item.companyId === companyId).length,
    hseResponses: (db.hseResponses || []).filter((item) => item.companyId === companyId).length,
    preventiveActions: (db.preventiveActions || []).filter((item) => item.companyId === companyId).length,
    audit: (db.audit || []).filter((item) => item.companyId === companyId).length,
  };
}

function purgeCompanyOperationalData(db, companyId, { keepAudit = true } = {}) {
  const before = companyDataCounts(db, companyId);
  db.checkins = (db.checkins || []).filter((item) => item.companyId !== companyId);
  db.consents = (db.consents || []).filter((item) => item.companyId !== companyId);
  db.feedback = (db.feedback || []).filter((item) => item.companyId !== companyId);
  db.hseResponses = (db.hseResponses || []).filter((item) => item.companyId !== companyId);
  db.preventiveActions = (db.preventiveActions || []).filter((item) => item.companyId !== companyId);
  if (!keepAudit) db.audit = (db.audit || []).filter((item) => item.companyId !== companyId);
  return before;
}

function applyRetentionPolicy(db, companyId, retentionDays) {
  const cutoff = Date.now() - Number(retentionDays || 180) * 24 * 60 * 60 * 1000;
  const isRecent = (item) => new Date(item.date || item.createdAt || item.updatedAt || 0).getTime() >= cutoff;
  const before = companyDataCounts(db, companyId);
  db.checkins = (db.checkins || []).filter((item) => item.companyId !== companyId || isRecent(item));
  db.consents = (db.consents || []).filter((item) => item.companyId !== companyId || isRecent(item));
  db.feedback = (db.feedback || []).filter((item) => item.companyId !== companyId || isRecent(item));
  db.hseResponses = (db.hseResponses || []).filter((item) => item.companyId !== companyId || isRecent(item));
  db.preventiveActions = (db.preventiveActions || []).filter((item) => item.companyId !== companyId || isRecent(item));
  const after = companyDataCounts(db, companyId);
  return {
    before,
    after,
    removed: Object.fromEntries(Object.keys(before).map((key) => [key, Math.max(0, before[key] - after[key])])),
  };
}

function publicUser(user) {
  return {
    id: user.id,
    companyId: user.companyId,
    name: user.name,
    email: user.email,
    role: user.role,
    team: user.team,
  };
}

function requireManager(user) {
  return user.role === "manager" || user.role === "admin";
}

function requirePlatformAdmin(user) {
  return user.role === "admin" && user.email === "admin@equilibria.demo";
}

function currentMonthKey(date = new Date()) {
  return date.toISOString().slice(0, 7);
}

function companyPlan(db, user) {
  const company = db.companies.find((item) => item.id === user.companyId) || {};
  return planCatalog[company.plan] || planCatalog.Profissional;
}

function companyAccessStatus(company = {}) {
  const status = company.status || "active";
  const expiresAt = company.expiresAt || "";
  const expired = expiresAt ? new Date(expiresAt) < new Date() : false;
  return {
    status,
    expiresAt,
    active: status !== "paused" && status !== "cancelled" && !expired,
    expired,
  };
}

function requireFeature(db, user, feature) {
  const plan = companyPlan(db, user);
  return Boolean(plan[feature]);
}

function hseDimensionScores(responses = []) {
  const grouped = Object.fromEntries(Object.keys(hseDimensions).map((key) => [key, []]));
  responses.forEach((response) => {
    hseQuestions.forEach((question) => {
      const value = Number(response.answers?.[question.id]);
      if (value >= 1 && value <= 5) grouped[question.dimension].push(value);
    });
  });
  return Object.entries(grouped).map(([key, values]) => {
    const score = values.length ? average(values) : 0;
    return {
      key,
      label: hseDimensions[key],
      score,
      percent: Math.round((score / 5) * 100),
      risk: Math.max(0, Math.round(100 - (score / 5) * 100)),
      count: values.length,
    };
  });
}

function buildHseSummary(db, user, month = currentMonthKey()) {
  const responses = (db.hseResponses || []).filter((item) => item.companyId === user.companyId && item.month === month);
  const dimensions = hseDimensionScores(responses);
  const lowest = dimensions.slice().sort((a, b) => a.percent - b.percent).slice(0, 3);
  return {
    month,
    count: responses.length,
    dimensions,
    lowest,
    questions: hseQuestions,
  };
}

function buildRhActionPlan(db, user) {
  const dashboard = buildDashboard(db, user);
  const hse = buildHseSummary(db, user);
  const feedback = (db.feedback || []).filter((item) => item.companyId === user.companyId).slice(-40);
  const urgentFeedback = feedback.filter((item) => item.sentiment === "urgente" || item.sentiment === "preocupacao");
  const riskyTeams = dashboard.teams.filter((team) => !team.sampleProtected && (team.risk || 0) >= 32).sort((a, b) => b.risk - a.risk);
  const weakDimensions = hse.lowest.filter((item) => item.count && item.percent < 70);
  const actions = [];

  riskyTeams.slice(0, 3).forEach((team) => {
    actions.push({
      priority: team.risk >= 45 ? "Alta" : "Média",
      focus: `Equipe ${team.team}`,
      evidence: `Risco agregado em ${team.risk}%, energia em ${team.energy}% e apoio em ${team.support}%.`,
      action: team.risk >= 45 ? "Realizar escuta guiada com liderança e equipe em até 7 dias, revisar carga e suspender demandas não essenciais temporariamente." : "Monitorar tendência por 2 semanas, revisar prioridades e reforçar acordos de apoio com liderança.",
      owner: "RH + liderança direta",
      deadline: team.risk >= 45 ? "7 dias" : "14 dias",
    });
  });

  weakDimensions.forEach((dimension) => {
    const actionByDimension = {
      demands: "Mapear picos de demanda, redistribuir tarefas e criar regra de priorização semanal.",
      control: "Aumentar autonomia sobre ordem de execução e envolver a equipe em decisões de rotina.",
      support: "Criar check-in de liderança semanal e pactuar canais de apoio para bloqueios.",
      relationships: "Abrir roda de escuta segura, tratar conflitos recorrentes e reforçar conduta esperada.",
      role: "Revisar papéis, responsabilidades e critérios de sucesso por função.",
      change: "Comunicar mudanças com antecedência, explicar motivos e abrir espaço para dúvidas.",
    };
    actions.push({
      priority: dimension.percent < 55 ? "Alta" : "Média",
      focus: hseDimensions[dimension.key],
      evidence: `Questionário mensal com ${dimension.percent}% de favorabilidade em ${dimension.label}.`,
      action: actionByDimension[dimension.key],
      owner: "RH",
      deadline: dimension.percent < 55 ? "15 dias" : "30 dias",
    });
  });

  if (urgentFeedback.length) {
    actions.push({
      priority: "Alta",
      focus: "Voz anônima",
      evidence: `${urgentFeedback.length} relato(s) recentes com preocupação ou urgência.`,
      action: "Classificar relatos por tema, validar riscos com canais internos adequados e comunicar medidas sem expor autores.",
      owner: "RH/Compliance",
      deadline: "72 horas",
    });
  }

  if (!actions.length) {
    actions.push({
      priority: "Baixa",
      focus: "Manutenção preventiva",
      evidence: "Indicadores sem alerta crítico no período atual.",
      action: "Manter check-ins, reforçar participação no questionário mensal e compartilhar devolutiva coletiva com a equipe.",
      owner: "RH",
      deadline: "30 dias",
    });
  }

  return {
    generatedAt: new Date().toISOString(),
    company: dashboard.company.name,
    plan: companyPlan(db, user),
    summary: {
      risk: Math.round(dashboard.metrics.risk || 0),
      hseResponses: hse.count,
      feedbackItems: feedback.length,
    },
    actions: actions.slice(0, 8),
  };
}

function riskLevel(score) {
  if (score >= 75) return "Critico";
  if (score >= 55) return "Alto";
  if (score >= 35) return "Medio";
  return "Baixo";
}

function probabilityFromScore(score) {
  if (score >= 75) return 5;
  if (score >= 55) return 4;
  if (score >= 35) return 3;
  if (score >= 20) return 2;
  return 1;
}

function severityFromFactor(key, score) {
  const base = ["relationships", "demands", "support"].includes(key) ? 3 : 2;
  return Math.min(5, Math.max(1, base + (score >= 70 ? 2 : score >= 45 ? 1 : 0)));
}

function feedbackScore(feedback = [], key) {
  const terms = {
    demands: ["carga", "jornada", "meta", "escala", "prazo", "sobrecarga", "pressao"],
    control: ["autonomia", "decisao", "prioridade", "controle"],
    support: ["apoio", "lideranca", "ajuda", "orientacao", "bloqueio"],
    relationships: ["conflito", "respeito", "assedio", "humilha", "ambiente", "relacao"],
    role: ["clareza", "papel", "responsabilidade", "funcao", "esperado"],
    change: ["mudanca", "comunicacao", "antecedencia", "duvida"],
  }[key] || [];
  const matched = feedback.filter((item) => {
    const text = `${item.category || ""} ${item.sentiment || ""} ${item.message || ""}`.toLowerCase();
    return terms.some((term) => text.includes(term));
  });
  return Math.min(30, matched.length * 10 + matched.filter((item) => item.sentiment === "urgente").length * 8);
}

function buildNr1Report(db, user, month = currentMonthKey()) {
  const dashboard = buildDashboard(db, user);
  const hse = buildHseSummary(db, user, month);
  const feedback = (db.feedback || []).filter((item) => item.companyId === user.companyId);
  const existingActions = (db.preventiveActions || []).filter((item) => item.companyId === user.companyId);
  const avgTeamRisk = average(dashboard.teams.filter((team) => !team.sampleProtected).map((team) => team.risk || 0));
  const avgPressure = average(companyEntries(db, user).map((entry) => entry.pressure * 10));
  const dimensionsByKey = Object.fromEntries(hse.dimensions.map((dimension) => [dimension.key, dimension]));

  const risks = Object.entries(psychosocialRiskFactors)
    .map(([key, config]) => {
      const dimension = dimensionsByKey[key] || { percent: 70, count: 0 };
      const hseRisk = dimension.count ? 100 - dimension.percent : 25;
      const operationalRisk = key === "demands" ? Math.max(avgTeamRisk, avgPressure) : key === "support" ? dashboard.metrics.risk : avgTeamRisk * 0.65;
      const score = Math.round(Math.min(100, Math.max(hseRisk, operationalRisk) + feedbackScore(feedback, key)));
      const probability = probabilityFromScore(score);
      const severity = severityFromFactor(key, score);
      const relatedActions = existingActions.filter((action) => action.riskKey === key && action.status !== "Concluida");
      return {
        key,
        factor: config.label,
        source: config.source,
        evidence: [
          `${dimension.count || 0} resposta(s) HSE no mes ${month}`,
          `risco coletivo medio ${Math.round(avgTeamRisk || 0)}%`,
          `${feedback.length} relato(s) anonimo(s) registrados`,
        ],
        probability,
        severity,
        score: probability * severity,
        index: score,
        level: riskLevel(score),
        recommendedMeasure: config.measure,
        status: relatedActions.length ? "Em tratamento" : score >= 35 ? "Pendente" : "Monitorado",
      };
    })
    .sort((a, b) => b.index - a.index);

  const generatedActions = risks
    .filter((risk) => risk.index >= 35)
    .slice(0, 6)
    .map((risk) => ({
      id: `suggested_${risk.key}`,
      riskKey: risk.key,
      title: risk.recommendedMeasure,
      owner: risk.level === "Critico" || risk.level === "Alto" ? "RH + Lideranca direta" : "RH",
      deadline: risk.level === "Critico" || risk.level === "Alto" ? "7 dias" : "30 dias",
      status: "Sugerida",
      evidence: risk.evidence.join("; "),
      createdAt: new Date().toISOString(),
      suggested: true,
    }));

  return {
    generatedAt: new Date().toISOString(),
    month,
    company: dashboard.company.name,
    disclaimer: "Relatorio de apoio ao GRO/PGR. Nao substitui avaliacao tecnica, juridica, medica ou laudo ocupacional.",
    summary: {
      risk: Math.round(dashboard.metrics.risk || 0),
      hseResponses: hse.count,
      feedbackItems: feedback.length,
      openActions: existingActions.filter((action) => action.status !== "Concluida").length,
    },
    risks,
    matrix: {
      low: risks.filter((risk) => risk.level === "Baixo").length,
      medium: risks.filter((risk) => risk.level === "Medio").length,
      high: risks.filter((risk) => risk.level === "Alto").length,
      critical: risks.filter((risk) => risk.level === "Critico").length,
    },
    actions: [...generatedActions, ...existingActions.slice().reverse()],
    evidenceTimeline: [
      ...companyEntries(db, user).slice(-8).map((entry) => ({
        type: "Check-in",
        date: entry.date,
        text: `${entry.team}: humor ${entry.mood}/10, energia ${entry.energy}/10, pressao ${entry.pressure}/10.`,
      })),
      ...feedback.slice(-6).map((item) => ({
        type: "Voz anonima",
        date: item.createdAt,
        text: `${item.team || "Equipe"}: ${item.category} / ${item.sentiment}.`,
      })),
      ...(db.hseResponses || [])
        .filter((item) => item.companyId === user.companyId)
        .slice(-6)
        .map((item) => ({ type: "HSE mensal", date: item.createdAt, text: `${item.team || "Equipe"} respondeu o ciclo ${item.month}.` })),
    ]
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 12),
  };
}

function createUser({ companyId, name, email, role, team, password }) {
  return {
    id: `u_${crypto.randomBytes(8).toString("hex")}`,
    companyId,
    name: String(name).trim(),
    email: String(email).trim().toLowerCase(),
    role: role || "employee",
    team: team || "Geral",
    salt: "",
    passwordHash: createPasswordHash(password),
  };
}

function sendJson(res, status, payload) {
  res.writeHead(status, {
    ...securityHeaders,
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(payload));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        req.destroy();
        reject(new Error("Body muito grande"));
      }
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error("JSON inválido"));
      }
    });
  });
}

function getAuthUser(req, db) {
  cleanupSessions();
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  const session = sessions.get(token);
  if (!session) return null;
  if (session.expiresAt <= Date.now()) {
    sessions.delete(token);
    return null;
  }
  return db.users.find((user) => user.id === session.userId) || null;
}

function getBearerToken(req) {
  const auth = req.headers.authorization || "";
  return auth.startsWith("Bearer ") ? auth.slice(7) : "";
}

function companyEntries(db, user) {
  return db.checkins.filter((entry) => entry.companyId === user.companyId);
}

function teamSummaries(db, user) {
  const company = db.companies.find((item) => item.id === user.companyId);
  const entries = companyEntries(db, user);
  return company.teams.map((team) => {
    const teamEntries = entries.filter((entry) => entry.team === team);
    const mood = average(teamEntries.map((entry) => entry.mood)) || 7;
    const energy = average(teamEntries.map((entry) => entry.energy)) || 7;
    const pressure = average(teamEntries.map((entry) => entry.pressure)) || 5;
    const support = average(teamEntries.map((entry) => entry.support)) || 7;
    const risk = average(teamEntries.map(riskScore)) || 22;
    const sampleProtected = teamEntries.length > 0 && teamEntries.length < MIN_TEAM_SAMPLE;
    return {
      team,
      count: teamEntries.length,
      sampleProtected,
      mood: sampleProtected ? null : Math.round(mood * 10),
      energy: sampleProtected ? null : Math.round(energy * 10),
      pressure: sampleProtected ? null : Math.round(pressure * 10),
      support: sampleProtected ? null : Math.round(support * 10),
      risk: sampleProtected ? null : Math.round(risk),
    };
  });
}

function buildDashboard(db, user) {
  const entries = companyEntries(db, user);
  const ownEntries = entries.filter((entry) => entry.userId === user.id);
  const company = db.companies.find((item) => item.id === user.companyId);
  const mood = average(entries.map((entry) => entry.mood));
  const energy = average(entries.map((entry) => entry.energy));
  const risk = average(entries.map(riskScore));
  const teams = teamSummaries(db, user);
  const alerts = teams
    .slice()
    .sort((a, b) => (b.risk || 0) - (a.risk || 0))
    .slice(0, 3)
    .map((summary) => ({
      level: summary.sampleProtected ? "low" : summary.risk >= 45 ? "high" : summary.risk >= 32 ? "medium" : "low",
      title: summary.sampleProtected ? `Amostra protegida em ${summary.team}` : summary.risk >= 45 ? `Atenção em ${summary.team}` : `Monitorar ${summary.team}`,
      text: summary.sampleProtected
        ? `A equipe tem ${summary.count} registro(s). Os indicadores ficam ocultos até atingir a amostra mínima de ${MIN_TEAM_SAMPLE}.`
        : summary.risk >= 45
          ? `Risco agregado em ${summary.risk}%. Revisar carga, abrir escuta com liderança e planejar ajuste de prioridades.`
          : `Risco agregado em ${summary.risk}%. Acompanhar tendência e reforçar rituais de apoio.`,
    }));

  return {
    company,
    plan: companyPlan(db, user),
    currentUser: publicUser(user),
    metrics: {
      mood,
      energy,
      risk,
      checkinRate: Math.min(96, 58 + entries.length * 2.2),
      count: entries.length,
    },
    teams,
    alerts,
    ownEntries,
    recentEntries: entries.slice(-18),
  };
}

function platformCompanies(db) {
  return db.companies.map((company) => {
    const users = db.users.filter((user) => user.companyId === company.id);
    const checkins = db.checkins.filter((entry) => entry.companyId === company.id);
    const hse = (db.hseResponses || []).filter((item) => item.companyId === company.id);
    const feedback = (db.feedback || []).filter((item) => item.companyId === company.id);
    const access = companyAccessStatus(company);
    return {
      id: company.id,
      name: company.name,
      plan: company.plan || "Profissional",
      status: access.status,
      expiresAt: access.expiresAt,
      active: access.active,
      expired: access.expired,
      employeeCount: company.employeeCount || users.length,
      retentionDays: company.retentionDays || 180,
      teams: company.teams || [],
      users: users.length,
      checkins: checkins.length,
      hseResponses: hse.length,
      feedback: feedback.length,
      createdAt: company.createdAt || "",
    };
  });
}

function buildPersonalReport(db, user) {
  const entries = companyEntries(db, user).filter((entry) => entry.userId === user.id).slice(-8);
  const fallback = companyEntries(db, user).slice(-8);
  const latest = entries.length ? entries : fallback;
  const mood = average(latest.map((entry) => entry.mood));
  const energy = average(latest.map((entry) => entry.energy));
  const pressure = average(latest.map((entry) => entry.pressure));
  const support = average(latest.map((entry) => entry.support));

  return {
    items: [
      `Seu humor médio recente ficou em ${mood.toFixed(1).replace(".", ",")}/10.`,
      `Sua energia média ficou em ${energy.toFixed(1).replace(".", ",")}/10, com pressão percebida em ${pressure.toFixed(1).replace(".", ",")}/10.`,
      support < 6
        ? "O apoio percebido está abaixo do ideal. Considere pedir alinhamento de prioridades com sua liderança."
        : "O apoio percebido está saudável. Mantenha o registro de contexto nos dias mais difíceis.",
      "Este relatório é privado e não aparece no painel de RH sem consentimento explícito.",
    ],
    carePlan: [
      { title: "Hoje", text: pressure >= 7 ? "Reduzir o dia para uma próxima tarefa clara." : "Manter pausas curtas entre blocos de foco." },
      { title: "Esta semana", text: energy < 6 ? "Reservar uma conversa de apoio e revisar carga." : "Observar quais rotinas mantêm sua energia estável." },
      { title: "Se repetir", text: "Buscar apoio profissional ou canal interno de cuidado." },
    ],
  };
}

function routeStatic(req, res) {
  const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
  const pathname = url.pathname === "/" ? "/index.html" : decodeURIComponent(url.pathname);
  const filePath = path.resolve(ROOT, `.${pathname}`);
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }
  fs.readFile(filePath, (error, data) => {
    if (error) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    res.writeHead(200, { ...securityHeaders, "Content-Type": mimeTypes[path.extname(filePath)] || "application/octet-stream" });
    res.end(data);
  });
}

async function routeApi(req, res) {
  const db = readDb();
  const url = new URL(req.url, `http://127.0.0.1:${PORT}`);

  try {
    if (req.method === "GET" && url.pathname === "/api/health") {
      sendJson(res, 200, {
        ok: true,
        service: "equilibria",
        uptimeSeconds: Math.round(globalThis.process?.uptime?.() || 0),
        checkedAt: new Date().toISOString(),
      });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/login") {
      const body = await readBody(req);
      const rateKey = `${req.socket.remoteAddress || "local"}:${String(body.email || "").toLowerCase()}`;
      if (isRateLimited(rateKey)) {
        sendJson(res, 429, { error: "Muitas tentativas. Aguarde alguns minutos." });
        return;
      }
      const user = db.users.find((item) => item.email.toLowerCase() === String(body.email || "").toLowerCase());
      if (!user || !verifyPassword(String(body.password || ""), user)) {
        sendJson(res, 401, { error: "Credenciais inválidas" });
        return;
      }
      if (body.acceptedLegal !== true) {
        sendJson(res, 400, { error: "Aceite os Termos de Uso, a Politica de Privacidade e o consentimento para continuar." });
        return;
      }
      loginAttempts.delete(rateKey);
      const token = createSession(user);
      db.consents = db.consents || [];
      db.consents.push({
        id: `consent_${Date.now()}_${crypto.randomBytes(3).toString("hex")}`,
        companyId: user.companyId,
        userId: user.id,
        type: "legal-login-acceptance",
        text: "Aceite dos Termos de Uso, Politica de Privacidade e consentimento de tratamento de dados emocionais para uso da plataforma.",
        accepted: true,
        policyVersion: "2026-05-lgpd-mental-health",
        ipHash: crypto.createHash("sha256").update(String(req.socket.remoteAddress || "local")).digest("hex").slice(0, 16),
        userAgent: String(req.headers["user-agent"] || "").slice(0, 180),
        date: new Date().toISOString(),
      });
      addAudit(db, { action: "consent.login_legal_acceptance", userId: user.id, companyId: user.companyId });
      writeDb(db);
      sendJson(res, 200, { token, user: publicUser(user) });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/register-company") {
      const body = await readBody(req);
      const required = ["companyName", "name", "email", "password"];
      if (required.some((key) => !String(body[key] || "").trim())) {
        sendJson(res, 400, { error: "Dados incompletos" });
        return;
      }
      if (String(body.password).length < 6) {
        sendJson(res, 400, { error: "A senha precisa ter pelo menos 6 caracteres" });
        return;
      }
      if (body.acceptedTerms !== true || body.acceptedSensitiveData !== true) {
        sendJson(res, 400, { error: "Aceite os Termos, a Politica de Privacidade e o consentimento de dados para criar a empresa." });
        return;
      }
      if (db.users.some((user) => user.email === String(body.email).trim().toLowerCase())) {
        sendJson(res, 409, { error: "E-mail já cadastrado" });
        return;
      }
      const companyId = `c_${crypto.randomBytes(8).toString("hex")}`;
      const teams = String(body.teams || "Geral,Atendimento,Comercial,Operações")
        .split(",")
        .map((team) => team.trim())
        .filter(Boolean);
      const company = {
        id: companyId,
        name: String(body.companyName).trim(),
        plan: "Profissional",
        status: "trial",
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString().slice(0, 10),
        employeeCount: Number(body.employeeCount || 10),
        retentionDays: 180,
        teams: teams.length ? teams : ["Geral"],
        createdAt: new Date().toISOString(),
      };
      const owner = createUser({
        companyId,
        name: body.name,
        email: body.email,
        role: "admin",
        team: "Administração",
        password: body.password,
      });
      db.companies.push(company);
      db.users.push(owner);
      db.consents = db.consents || [];
      const consentDate = new Date().toISOString();
      const consentBase = {
        companyId,
        userId: owner.id,
        accepted: true,
        policyVersion: "2026-05-lgpd-mental-health",
        ipHash: crypto.createHash("sha256").update(String(req.socket.remoteAddress || "local")).digest("hex").slice(0, 16),
        userAgent: String(req.headers["user-agent"] || "").slice(0, 180),
        date: consentDate,
      };
      db.consents.push(
        { ...consentBase, id: `consent_${Date.now()}_terms`, type: "company-registration-terms", text: "Aceite dos Termos de Uso e Politica de Privacidade no cadastro da empresa." },
        { ...consentBase, id: `consent_${Date.now()}_sensitive`, type: "company-registration-sensitive-data", text: "Consentimento para tratamento de dados emocionais, relatos, HSE, NR-1/PGR e indicadores agregados." },
      );
      db.audit.push({ id: `audit_${Date.now()}`, action: "company.created", userId: owner.id, companyId, date: new Date().toISOString() });
      addAudit(db, { action: "consent.company_registration_acceptance", userId: owner.id, companyId });
      writeDb(db);
      const token = createSession(owner);
      sendJson(res, 201, { token, user: publicUser(owner), company });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/demo/reset") {
      ensureDb({ reset: true });
      sendJson(res, 200, { ok: true });
      return;
    }

    const user = getAuthUser(req, db);
    if (!user) {
      sendJson(res, 401, { error: "Não autenticado" });
      return;
    }

    const currentCompany = db.companies.find((item) => item.id === user.companyId);
    const access = companyAccessStatus(currentCompany);
    const allowedWhenInactive = ["/api/logout", "/api/me"];
    if (!access.active && !requirePlatformAdmin(user) && !allowedWhenInactive.includes(url.pathname)) {
      sendJson(res, 402, { error: access.expired ? "Acesso vencido. Fale com a Equilibria para renovar." : "Acesso pausado. Fale com a Equilibria para reativar." });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/logout") {
      const token = getBearerToken(req);
      if (token) sessions.delete(token);
      sendJson(res, 200, { ok: true });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/me") {
      const company = db.companies.find((item) => item.id === user.companyId);
      sendJson(res, 200, { user: publicUser(user), company: { ...company, access: companyAccessStatus(company) } });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/platform/companies") {
      if (!requirePlatformAdmin(user)) {
        sendJson(res, 403, { error: "Acesso restrito à administração Equilibria." });
        return;
      }
      sendJson(res, 200, { companies: platformCompanies(db), plans: planCatalog });
      return;
    }

    if (req.method === "PATCH" && url.pathname.startsWith("/api/platform/companies/")) {
      if (!requirePlatformAdmin(user)) {
        sendJson(res, 403, { error: "Acesso restrito à administração Equilibria." });
        return;
      }
      const companyId = decodeURIComponent(url.pathname.split("/").pop());
      const company = db.companies.find((item) => item.id === companyId);
      if (!company) {
        sendJson(res, 404, { error: "Empresa não encontrada" });
        return;
      }
      const body = await readBody(req);
      if (body.plan && !planCatalog[body.plan]) {
        sendJson(res, 400, { error: "Plano inválido" });
        return;
      }
      if (body.status && !["trial", "active", "paused", "cancelled"].includes(body.status)) {
        sendJson(res, 400, { error: "Status inválido" });
        return;
      }
      if (body.plan) company.plan = body.plan;
      if (body.status) company.status = body.status;
      if (body.expiresAt !== undefined) company.expiresAt = String(body.expiresAt || "");
      if (body.employeeCount !== undefined) company.employeeCount = Number(body.employeeCount || company.employeeCount || 0);
      if (body.retentionDays !== undefined) company.retentionDays = Math.min(1825, Math.max(30, Number(body.retentionDays || company.retentionDays || 180)));
      db.audit.push({ id: `audit_${Date.now()}`, action: "platform.company.updated", userId: user.id, companyId, date: new Date().toISOString(), changes: body });
      writeDb(db);
      sendJson(res, 200, { company: platformCompanies(db).find((item) => item.id === companyId) });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/users") {
      if (!requireManager(user)) {
        sendJson(res, 403, { error: "Acesso restrito a RH/Gestor" });
        return;
      }
      const users = db.users.filter((item) => item.companyId === user.companyId).map(publicUser);
      sendJson(res, 200, { users });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/users") {
      if (!requireManager(user)) {
        sendJson(res, 403, { error: "Acesso restrito a RH/Gestor" });
        return;
      }
      const body = await readBody(req);
      const required = ["name", "email", "password", "team"];
      if (required.some((key) => !String(body[key] || "").trim())) {
        sendJson(res, 400, { error: "Dados incompletos" });
        return;
      }
      if (String(body.password).length < 6) {
        sendJson(res, 400, { error: "A senha precisa ter pelo menos 6 caracteres" });
        return;
      }
      if (db.users.some((item) => item.email === String(body.email).trim().toLowerCase())) {
        sendJson(res, 409, { error: "E-mail já cadastrado" });
        return;
      }
      const newUser = createUser({
        companyId: user.companyId,
        name: body.name,
        email: body.email,
        role: body.role === "manager" || body.role === "admin" ? body.role : "employee",
        team: body.team,
        password: body.password,
      });
      db.users.push(newUser);
      const company = db.companies.find((item) => item.id === user.companyId);
      if (company && !company.teams.includes(newUser.team)) company.teams.push(newUser.team);
      db.audit.push({ id: `audit_${Date.now()}`, action: "user.created", userId: user.id, targetUserId: newUser.id, date: new Date().toISOString() });
      writeDb(db);
      sendJson(res, 201, { user: publicUser(newUser), users: db.users.filter((item) => item.companyId === user.companyId).map(publicUser) });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/consents") {
      const consents = (db.consents || []).filter((item) => item.userId === user.id || (requireManager(user) && item.companyId === user.companyId));
      sendJson(res, 200, { consents });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/consents") {
      const body = await readBody(req);
      const consent = {
        id: `consent_${Date.now()}`,
        companyId: user.companyId,
        userId: user.id,
        type: body.type || "privacy-checkin",
        text: body.text || "Uso de dados emocionais individuais para relatório pessoal e dados agregados para a empresa.",
        accepted: body.accepted !== false,
        policyVersion: body.policyVersion || "2026-05-lgpd-mental-health",
        ipHash: crypto.createHash("sha256").update(String(req.socket.remoteAddress || "local")).digest("hex").slice(0, 16),
        userAgent: String(req.headers["user-agent"] || "").slice(0, 180),
        date: new Date().toISOString(),
      };
      db.consents = db.consents || [];
      db.consents.push(consent);
      db.audit.push({ id: `audit_${Date.now()}`, action: "consent.recorded", userId: user.id, date: consent.date });
      writeDb(db);
      sendJson(res, 201, { consent });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/account/password") {
      const body = await readBody(req);
      if (String(body.newPassword || "").length < 8) {
        sendJson(res, 400, { error: "A nova senha precisa ter pelo menos 8 caracteres" });
        return;
      }
      if (!verifyPassword(String(body.currentPassword || ""), user)) {
        sendJson(res, 401, { error: "Senha atual incorreta" });
        return;
      }
      user.salt = "";
      user.passwordHash = createPasswordHash(body.newPassword);
      addAudit(db, { action: "account.password.changed", userId: user.id, companyId: user.companyId });
      writeDb(db);
      sendJson(res, 200, { ok: true });
      return;
    }

    if (req.method === "PATCH" && url.pathname.startsWith("/api/users/") && url.pathname.endsWith("/password")) {
      if (!requireManager(user)) {
        sendJson(res, 403, { error: "Acesso restrito a RH/Gestor" });
        return;
      }
      const targetUserId = decodeURIComponent(url.pathname.split("/")[3]);
      const targetUser = db.users.find((item) => item.id === targetUserId && item.companyId === user.companyId);
      if (!targetUser) {
        sendJson(res, 404, { error: "Usuário não encontrado" });
        return;
      }
      const body = await readBody(req);
      if (String(body.newPassword || "").length < 8) {
        sendJson(res, 400, { error: "A nova senha precisa ter pelo menos 8 caracteres" });
        return;
      }
      targetUser.salt = "";
      targetUser.passwordHash = createPasswordHash(body.newPassword);
      addAudit(db, { action: "user.password.reset", userId: user.id, targetUserId: targetUser.id, companyId: user.companyId });
      writeDb(db);
      sendJson(res, 200, { ok: true, user: publicUser(targetUser) });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/admin/governance") {
      if (!requireManager(user)) {
        sendJson(res, 403, { error: "Acesso restrito a RH/Gestor" });
        return;
      }
      const company = db.companies.find((item) => item.id === user.companyId);
      sendJson(res, 200, {
        company: {
          id: company.id,
          name: company.name,
          retentionDays: company.retentionDays || 180,
        },
        counts: companyDataCounts(db, user.companyId),
      });
      return;
    }

    if (req.method === "PATCH" && url.pathname === "/api/admin/governance") {
      if (!requireManager(user)) {
        sendJson(res, 403, { error: "Acesso restrito a RH/Gestor" });
        return;
      }
      const body = await readBody(req);
      const retentionDays = Number(body.retentionDays || 180);
      if (retentionDays < 30 || retentionDays > 1825) {
        sendJson(res, 400, { error: "A retenção precisa ficar entre 30 e 1825 dias" });
        return;
      }
      const company = db.companies.find((item) => item.id === user.companyId);
      company.retentionDays = retentionDays;
      addAudit(db, { action: "governance.retention.updated", userId: user.id, companyId: user.companyId, changes: { retentionDays } });
      writeDb(db);
      sendJson(res, 200, { company: { id: company.id, name: company.name, retentionDays: company.retentionDays }, counts: companyDataCounts(db, user.companyId) });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/admin/apply-retention") {
      if (!requireManager(user)) {
        sendJson(res, 403, { error: "Acesso restrito a RH/Gestor" });
        return;
      }
      const company = db.companies.find((item) => item.id === user.companyId);
      const result = applyRetentionPolicy(db, user.companyId, company.retentionDays || 180);
      addAudit(db, { action: "governance.retention.applied", userId: user.id, companyId: user.companyId, changes: result.removed });
      writeDb(db);
      sendJson(res, 200, { result, counts: companyDataCounts(db, user.companyId) });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/admin/purge-company-data") {
      if (user.role !== "admin") {
        sendJson(res, 403, { error: "Acesso restrito a administradores" });
        return;
      }
      const body = await readBody(req);
      if (String(body.confirmation || "").trim() !== "EXCLUIR DADOS") {
        sendJson(res, 400, { error: "Digite EXCLUIR DADOS para confirmar" });
        return;
      }
      const before = purgeCompanyOperationalData(db, user.companyId, { keepAudit: true });
      addAudit(db, { action: "company.operational_data.purged", userId: user.id, companyId: user.companyId, changes: before });
      writeDb(db);
      sendJson(res, 200, { ok: true, removed: before, counts: companyDataCounts(db, user.companyId) });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/admin/audit") {
      if (!requireManager(user)) {
        sendJson(res, 403, { error: "Acesso restrito a RH/Gestor" });
        return;
      }
      const logs = (db.audit || [])
        .filter((item) => item.companyId === user.companyId || item.userId === user.id)
        .slice(-120)
        .reverse()
        .map((item) => ({
          id: item.id,
          action: item.action,
          userId: item.userId,
          targetUserId: item.targetUserId || "",
          companyId: item.companyId || "",
          date: item.date,
          detail: item.detail || "",
          changes: item.changes || {},
        }));
      sendJson(res, 200, { logs });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/dashboard") {
      sendJson(res, 200, buildDashboard(db, user));
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/plans") {
      const company = db.companies.find((item) => item.id === user.companyId);
      sendJson(res, 200, { currentPlan: company?.plan || "Profissional", plans: planCatalog });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/company/plan") {
      if (!requireManager(user)) {
        sendJson(res, 403, { error: "Acesso restrito a RH/Gestor" });
        return;
      }
      const body = await readBody(req);
      if (!planCatalog[body.plan]) {
        sendJson(res, 400, { error: "Plano inválido" });
        return;
      }
      const company = db.companies.find((item) => item.id === user.companyId);
      company.plan = body.plan;
      db.audit.push({ id: `audit_${Date.now()}`, action: "company.plan.updated", userId: user.id, companyId: user.companyId, plan: body.plan, date: new Date().toISOString() });
      writeDb(db);
      sendJson(res, 200, { company, plan: planCatalog[body.plan] });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/personal-report") {
      sendJson(res, 200, buildPersonalReport(db, user));
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/hse-status") {
      if (!requireFeature(db, user, "hasHse")) {
        sendJson(res, 403, { error: "Questionário mensal disponível nos planos Profissional e Enterprise." });
        return;
      }
      const month = url.searchParams.get("month") || currentMonthKey();
      const alreadyAnswered = (db.hseResponses || []).some((item) => item.companyId === user.companyId && item.userId === user.id && item.month === month);
      const summary = requireManager(user) ? buildHseSummary(db, user, month) : null;
      sendJson(res, 200, { month, alreadyAnswered, questions: hseQuestions, dimensions: hseDimensions, summary });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/hse-responses") {
      if (!requireFeature(db, user, "hasHse")) {
        sendJson(res, 403, { error: "Questionário mensal disponível nos planos Profissional e Enterprise." });
        return;
      }
      const body = await readBody(req);
      const month = body.month || currentMonthKey();
      db.hseResponses = db.hseResponses || [];
      if (db.hseResponses.some((item) => item.companyId === user.companyId && item.userId === user.id && item.month === month)) {
        sendJson(res, 409, { error: "Você já respondeu o questionário deste mês." });
        return;
      }
      const answers = body.answers || {};
      const missing = hseQuestions.some((question) => Number(answers[question.id]) < 1 || Number(answers[question.id]) > 5);
      if (missing) {
        sendJson(res, 400, { error: "Responda todas as perguntas do questionário mensal." });
        return;
      }
      const response = {
        id: `hse_${Date.now()}`,
        companyId: user.companyId,
        userId: user.id,
        team: user.team,
        month,
        answers: Object.fromEntries(hseQuestions.map((question) => [question.id, Number(answers[question.id])])),
        notes: String(body.notes || ""),
        createdAt: new Date().toISOString(),
      };
      db.hseResponses.push(response);
      db.audit.push({ id: `audit_${Date.now()}`, action: "hse.response.created", userId: user.id, companyId: user.companyId, date: response.createdAt });
      writeDb(db);
      sendJson(res, 201, { response: { id: response.id, month: response.month, createdAt: response.createdAt }, summary: requireManager(user) ? buildHseSummary(db, user, month) : null });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/rh-action-plan") {
      if (!requireManager(user)) {
        sendJson(res, 403, { error: "Acesso restrito a RH/Gestor" });
        return;
      }
      if (!requireFeature(db, user, "hasActionPlan")) {
        sendJson(res, 403, { error: "Plano de ação RH disponível nos planos Profissional e Enterprise." });
        return;
      }
      sendJson(res, 200, buildRhActionPlan(db, user));
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/nr1-report") {
      if (!requireManager(user)) {
        sendJson(res, 403, { error: "Acesso restrito a RH/Gestor" });
        return;
      }
      if (!requireFeature(db, user, "hasNr1")) {
        sendJson(res, 403, { error: "Modulo NR-1/PGR disponivel nos planos Profissional e Enterprise." });
        return;
      }
      sendJson(res, 200, buildNr1Report(db, user, url.searchParams.get("month") || currentMonthKey()));
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/preventive-actions") {
      if (!requireManager(user)) {
        sendJson(res, 403, { error: "Acesso restrito a RH/Gestor" });
        return;
      }
      if (!requireFeature(db, user, "hasNr1")) {
        sendJson(res, 403, { error: "Modulo NR-1/PGR disponivel nos planos Profissional e Enterprise." });
        return;
      }
      const body = await readBody(req);
      if (!psychosocialRiskFactors[body.riskKey]) {
        sendJson(res, 400, { error: "Fator de risco invalido" });
        return;
      }
      if (!String(body.title || "").trim()) {
        sendJson(res, 400, { error: "Descreva a medida preventiva" });
        return;
      }
      const action = {
        id: `action_${Date.now()}`,
        companyId: user.companyId,
        riskKey: body.riskKey,
        title: String(body.title).trim(),
        owner: String(body.owner || "RH").trim(),
        deadline: String(body.deadline || "30 dias").trim(),
        status: ["Aberta", "Em andamento", "Concluida"].includes(body.status) ? body.status : "Aberta",
        evidence: String(body.evidence || "").trim(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      db.preventiveActions = db.preventiveActions || [];
      db.preventiveActions.push(action);
      db.audit.push({ id: `audit_${Date.now()}`, action: "nr1.preventive_action.created", userId: user.id, companyId: user.companyId, date: action.createdAt });
      writeDb(db);
      sendJson(res, 201, { action, report: buildNr1Report(db, user) });
      return;
    }

    if (req.method === "PATCH" && url.pathname.startsWith("/api/preventive-actions/")) {
      if (!requireManager(user)) {
        sendJson(res, 403, { error: "Acesso restrito a RH/Gestor" });
        return;
      }
      if (!requireFeature(db, user, "hasNr1")) {
        sendJson(res, 403, { error: "Modulo NR-1/PGR disponivel nos planos Profissional e Enterprise." });
        return;
      }
      const actionId = decodeURIComponent(url.pathname.split("/").pop());
      const action = (db.preventiveActions || []).find((item) => item.companyId === user.companyId && item.id === actionId);
      if (!action) {
        sendJson(res, 404, { error: "Medida preventiva nao encontrada" });
        return;
      }
      const body = await readBody(req);
      if (body.title !== undefined) action.title = String(body.title).trim();
      if (body.owner !== undefined) action.owner = String(body.owner).trim();
      if (body.deadline !== undefined) action.deadline = String(body.deadline).trim();
      if (body.evidence !== undefined) action.evidence = String(body.evidence).trim();
      if (["Aberta", "Em andamento", "Concluida"].includes(body.status)) action.status = body.status;
      action.updatedAt = new Date().toISOString();
      db.audit.push({ id: `audit_${Date.now()}`, action: "nr1.preventive_action.updated", userId: user.id, companyId: user.companyId, date: action.updatedAt });
      writeDb(db);
      sendJson(res, 200, { action, report: buildNr1Report(db, user) });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/checkins") {
      const body = await readBody(req);
      const required = ["team", "moment", "mood", "energy", "pressure", "support"];
      if (required.some((key) => body[key] === undefined || body[key] === "")) {
        sendJson(res, 400, { error: "Dados incompletos" });
        return;
      }
      const entry = {
        id: `chk_${Date.now()}`,
        companyId: user.companyId,
        userId: user.id,
        date: new Date().toISOString(),
        team: String(body.team),
        moment: String(body.moment),
        mood: Number(body.mood),
        energy: Number(body.energy),
        pressure: Number(body.pressure),
        support: Number(body.support),
        note: String(body.note || ""),
      };
      db.checkins.push(entry);
      db.audit.push({ id: `audit_${Date.now()}`, action: "checkin.created", userId: user.id, date: entry.date });
      writeDb(db);
      sendJson(res, 201, { entry, dashboard: buildDashboard(db, user), personal: buildPersonalReport(db, user) });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/assistant/status") {
      if (!requireFeature(db, user, "hasAssistant")) {
        sendJson(res, 403, { error: "IA de apoio disponível nos planos Profissional e Enterprise." });
        return;
      }
      sendJson(res, 200, {
        configured: Boolean(OPENAI_API_KEY),
        model: OPENAI_MODEL,
        mode: OPENAI_API_KEY ? "openai" : "local",
      });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/assistant") {
      if (!requireFeature(db, user, "hasAssistant")) {
        sendJson(res, 403, { error: "IA de apoio disponível nos planos Profissional e Enterprise." });
        return;
      }
      const body = await readBody(req);
      const message = String(body.message || "");
      const fallbackReply = buildAssistantReply(message);
      const ai = await buildSmartAssistantReply(db, user, message, fallbackReply);
      sendJson(res, 200, ai);
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/feedback") {
      if (!requireFeature(db, user, "hasFeedback")) {
        sendJson(res, 403, { error: "Voz anônima disponível nos planos Profissional e Enterprise." });
        return;
      }
      const body = await readBody(req);
      if (!String(body.message || "").trim()) {
        sendJson(res, 400, { error: "Escreva uma mensagem antes de enviar" });
        return;
      }
      const feedback = {
        id: `feedback_${Date.now()}`,
        companyId: user.companyId,
        team: body.team ? String(body.team) : user.team,
        category: body.category || "jornada",
        sentiment: body.sentiment || "neutro",
        message: String(body.message).trim(),
        anonymous: true,
        createdAt: new Date().toISOString(),
      };
      db.feedback = db.feedback || [];
      db.feedback.push(feedback);
      db.audit.push({ id: `audit_${Date.now()}`, action: "feedback.created", companyId: user.companyId, date: feedback.createdAt });
      writeDb(db);
      sendJson(res, 201, { feedback: { ...feedback, message: "registrado anonimamente" } });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/feedback") {
      if (!requireFeature(db, user, "hasFeedback")) {
        sendJson(res, 403, { error: "Voz anônima disponível nos planos Profissional e Enterprise." });
        return;
      }
      if (!requireManager(user)) {
        sendJson(res, 403, { error: "Acesso restrito a RH/Gestor" });
        return;
      }
      const items = (db.feedback || [])
        .filter((item) => item.companyId === user.companyId)
        .slice(-50)
        .reverse()
        .map((item) => ({
          id: item.id,
          team: item.team,
          category: item.category,
          sentiment: item.sentiment,
          message: item.message,
          anonymous: true,
          createdAt: item.createdAt,
        }));
      sendJson(res, 200, { feedback: items });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/export") {
      const dashboard = buildDashboard(db, user);
      sendJson(res, 200, {
        filename: "equilibria-relatorio.json",
        report: {
          generatedAt: new Date().toISOString(),
          company: dashboard.company.name,
          metrics: dashboard.metrics,
          teams: dashboard.teams,
          alerts: dashboard.alerts,
          nr1: requireManager(user) && requireFeature(db, user, "hasNr1") ? buildNr1Report(db, user) : null,
        },
      });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/admin/backup") {
      if (user.role !== "admin") {
        sendJson(res, 403, { error: "Acesso restrito a administradores" });
        return;
      }
      sendJson(res, 200, {
        filename: `equilibria-backup-${new Date().toISOString().slice(0, 10)}.json`,
        backup: {
          exportedAt: new Date().toISOString(),
          companyId: user.companyId,
          data: {
            companies: db.companies.filter((company) => company.id === user.companyId),
            users: db.users.filter((item) => item.companyId === user.companyId).map(publicUser),
            checkins: db.checkins.filter((item) => item.companyId === user.companyId),
            consents: (db.consents || []).filter((item) => item.companyId === user.companyId),
            feedback: (db.feedback || []).filter((item) => item.companyId === user.companyId),
            hseResponses: (db.hseResponses || []).filter((item) => item.companyId === user.companyId),
            preventiveActions: (db.preventiveActions || []).filter((item) => item.companyId === user.companyId),
            audit: db.audit.filter((item) => item.companyId === user.companyId || item.userId === user.id),
          },
        },
      });
      return;
    }

    sendJson(res, 404, { error: "Rota não encontrada" });
  } catch (error) {
    sendJson(res, 500, { error: error.message || "Erro interno" });
  }
}

function buildAssistantReply(message) {
  const raw = String(message || "").trim();
  const text = raw.toLowerCase();
  const has = (...words) => words.some((word) => text.includes(word));
  const wantsAction = has("o que faço", "como faço", "me ajuda", "ajuda", "orienta", "orientação");

  if (!raw) return "Estou aqui. Me conte em uma ou duas frases o que está acontecendo para eu te responder com mais precisão.";

  if (has("assédio", "humilha", "humilh", "ameaça", "ameaçado", "perseguição", "perseguido")) {
    return [
      "O que você descreve merece cuidado e registro, não deve ser tratado como algo normal da rotina.",
      "Se puder, anote datas, pessoas envolvidas, contexto e impactos. Evite ficar sozinho com essa situação: procure um canal formal de RH, compliance ou uma liderança segura.",
      "Se houver risco imediato à sua segurança, priorize sair da situação e buscar ajuda de uma pessoa ou serviço de emergência.",
    ].join("\n\n");
  }

  if (has("cans", "exaust", "esgot", "burnout", "sem energia", "não aguento")) {
    return [
      "Parece que seu corpo e sua mente estão pedindo redução de carga, não só mais força de vontade.",
      "Para hoje, tente escolher uma próxima tarefa pequena e negociar o que pode sair da lista. Se isso vem se repetindo, o melhor passo é transformar em conversa: carga, prazo, prioridade e apoio.",
      wantsAction ? "Uma frase possível para abrir essa conversa: \"Eu preciso revisar prioridades porque minha energia está baixa de forma recorrente e isso pode afetar a entrega\"." : "Se quiser, me diga o que mais pesa: volume de tarefas, conflito, cobrança, falta de pausa ou falta de apoio.",
    ].join("\n\n");
  }

  if (has("ansios", "pânico", "panico", "pressão", "pressionado", "cobrança", "cobranca")) {
    return [
      "Entendi. Quando a pressão sobe, a mente costuma tentar resolver tudo ao mesmo tempo, e isso aumenta a sensação de ameaça.",
      "Agora, separe o que é urgente do que é apenas barulhento. Escolha uma ação de 10 minutos, não o dia inteiro. Depois registre o gatilho no check-in para vermos se isso é um padrão da jornada.",
      "Se vier com falta de ar intensa, dor no peito, sensação de descontrole ou risco de se machucar, procure ajuda imediata.",
    ].join("\n\n");
  }

  if (has("triste", "chorei", "choro", "desanim", "sozinho", "sozinha", "mal")) {
    return [
      "Sinto muito que o dia esteja vindo desse jeito. Não vou tentar transformar isso em frase pronta.",
      "O mais importante agora é você não atravessar isso isolado. Procure alguém confiável, reduza decisões difíceis por hoje e registre o que aconteceu com o máximo de honestidade possível.",
      "Se essa tristeza estiver frequente, intensa ou vier com pensamentos de se ferir, busque apoio profissional ou um serviço de emergência imediatamente.",
    ].join("\n\n");
  }

  if (has("chefe", "lider", "líder", "gestor", "gestora", "coordenador")) {
    return [
      "Parece que existe um ponto de relação com liderança, e isso costuma afetar muito a segurança emocional no trabalho.",
      "Tente separar fatos observáveis de interpretações: o que foi dito, quando, qual impacto teve e o que você precisa que mude. Isso ajuda a conversa ficar mais objetiva e menos desgastante.",
      "Se você não se sente seguro para falar diretamente, use o canal anônimo ou procure RH/compliance.",
    ].join("\n\n");
  }

  return [
    "Obrigado por me contar. Pelo que você trouxe, eu olharia para três coisas: o que aconteceu, como isso te afetou e que apoio você precisa agora.",
    "Se for algo pontual, registre o contexto e observe se passa. Se for repetido, vale transformar em dado: frequência, gatilho e impacto na sua energia.",
    "Quer me contar um pouco mais sobre o que aconteceu antes desse sentimento aparecer?",
  ].join("\n\n");
}

function extractOpenAIText(payload = {}) {
  if (payload.output_text) return String(payload.output_text).trim();
  const pieces = [];
  for (const item of payload.output || []) {
    for (const content of item.content || []) {
      if (content.text) pieces.push(content.text);
      if (content.type === "output_text" && content.text) pieces.push(content.text);
    }
  }
  return pieces.join("\n").trim();
}

function buildAssistantContext(db, user) {
  const entries = companyEntries(db, user).filter((entry) => entry.userId === user.id).slice(-5);
  const latest = entries.slice(-1)[0];
  const personal = buildPersonalReport(db, user);
  const teamData = teamSummaries(db, user).find((team) => team.team === user.team && !team.sampleProtected);
  return {
    role: user.role,
    team: user.team,
    latestCheckin: latest
      ? {
          moment: latest.moment,
          mood: latest.mood,
          energy: latest.energy,
          pressure: latest.pressure,
          support: latest.support,
          note: latest.note,
        }
      : null,
    teamSignals: teamData
      ? {
          mood: teamData.mood,
          energy: teamData.energy,
          pressure: teamData.pressure,
          support: teamData.support,
          risk: teamData.risk,
        }
      : null,
    recentPersonalSignals: personal.items.slice(0, 3),
  };
}

function assistantSystemPrompt() {
  return [
    "Voce e a IA de apoio interno do Equilibria, uma plataforma de gestao emocional corporativa.",
    "Responda em portugues do Brasil, como uma conversa real: humano, especifico, acolhedor, direto e nada robotico.",
    "Nao faca diagnostico clinico, nao prometa tratamento e nao substitua psicologo, medico, RH ou emergencia.",
    "Ajude a pessoa a organizar o que sente, identificar gatilhos do trabalho, pensar no proximo passo e, quando adequado, sugerir uso de RH, lideranca segura, compliance ou canal anonimo.",
    "Se houver risco de autoagressao, violencia, abuso, assedio grave, dor no peito, falta de ar intensa ou perigo imediato, oriente procurar ajuda imediata/emergencia e uma pessoa de confianca.",
    "Evite respostas genericas, listas longas e frases prontas. Use detalhes da mensagem e do contexto.",
    "Estruture a resposta em: acolhimento breve, leitura do que pode estar acontecendo, uma acao pratica para hoje, e uma pergunta final util.",
    "Prefira 2 a 4 paragrafos curtos. Nao mencione que recebeu JSON ou contexto tecnico.",
  ].join("\n");
}

async function callOpenAIAssistant(message, context) {
  if (!OPENAI_API_KEY) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), OPENAI_TIMEOUT_MS);
  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        input: [
          { role: "system", content: assistantSystemPrompt() },
          {
            role: "user",
            content: [
              "Mensagem do colaborador:",
              message,
              "",
              "Contexto seguro e limitado do Equilibria:",
              JSON.stringify(context),
            ].join("\n"),
          },
        ],
        max_output_tokens: 650,
      }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error?.message || "Falha na OpenAI");
    const text = extractOpenAIText(data);
    return text || null;
  } finally {
    clearTimeout(timer);
  }
}

async function buildSmartAssistantReply(db, user, message, fallbackReply) {
  const raw = String(message || "").trim();
  if (!raw) return { reply: fallbackReply, source: "local" };

  try {
    const reply = await callOpenAIAssistant(raw, buildAssistantContext(db, user));
    if (reply) return { reply, source: "openai", model: OPENAI_MODEL };
  } catch (error) {
    console.warn("OpenAI assistant fallback:", error.message);
  }

  return { reply: fallbackReply, source: OPENAI_API_KEY ? "local-fallback" : "local" };
}

if (globalThis.process?.argv?.includes("--reset-demo")) {
  ensureDb({ reset: true });
  console.log(`Banco demo recriado em ${DB_PATH}`);
  process.exit(0);
}

ensureDb();

const server = http
  .createServer((req, res) => {
    if (req.url.startsWith("/api/")) {
      routeApi(req, res);
      return;
    }
    routeStatic(req, res);
  })
  .listen(PORT, HOST, () => {
    const displayHost = HOST === "0.0.0.0" ? "127.0.0.1" : HOST;
    console.log(`Equilibria rodando em http://${displayHost}:${PORT}`);
    console.log("Contas demo: colaborador@equilibria.demo, rh@equilibria.demo, admin@equilibria.demo");
    console.log("Senha demo: demo123");
  });

globalThis.equilibriaHttpServer = server;
