require("dotenv").config({ path: require("node:path").join(__dirname, "..", ".env") });

const { Client } = require("pg");
const bcrypt = require("bcryptjs");
const crypto = require("node:crypto");
const { spawn } = require("node:child_process");
const path = require("node:path");

const backendDir = path.join(__dirname, "..");
const port = Number(process.env.INTEGRATION_PORT || 3101);
const base = `http://127.0.0.1:${port}/api`;
const email = `integration.${crypto.randomBytes(6).toString("hex")}@example.invalid`;
const password = `Int-${crypto.randomBytes(12).toString("hex")}`;
const fullName = "Integración Sintética";
const results = [];

function check(name, pass, detail = {}) {
  results.push({ name, pass: Boolean(pass), ...detail });
}

async function postJson(endpoint, body, cookie, csrfToken) {
  const headers = { "Content-Type": "application/json" };
  if (cookie) headers.Cookie = cookie;
  if (csrfToken) headers["X-CSRF-Token"] = csrfToken;
  return fetch(`${base}${endpoint}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

async function waitForHealth() {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    try {
      const response = await fetch(`${base}/health`);
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error("El backend no respondió /api/health tras el arranque");
}

(async () => {
  const client = new Client({
    connectionString: process.env.DATABASE_URL || "",
    ssl: /neon\.tech/i.test(process.env.DATABASE_URL || "") ? { rejectUnauthorized: false } : undefined,
    connectionTimeoutMillis: 10000,
  });
  let server;
  let profileId;

  try {
    await client.connect();

    try {
      const existing = await fetch(`${base}/health`);
      if (existing.ok) throw new Error(`El puerto ${port} ya está en uso; elige otro con INTEGRATION_PORT`);
    } catch (error) {
      if (String(error.message).includes("ya está en uso")) throw error;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const inserted = await client.query(
      "insert into public.profiles (full_name, email, password_hash, role, active) values ($1,$2,$3,'consulta',true) returning id",
      [fullName, email, passwordHash],
    );
    profileId = inserted.rows[0].id;

    server = spawn(process.execPath, ["dist/server.js"], {
      cwd: backendDir,
      stdio: "ignore",
      env: { ...process.env, PORT: String(port) },
    });
    await waitForHealth();

    const failedStatuses = [];
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const response = await postJson("/auth/login", { email, password: "contraseña-incorrecta" });
      failedStatuses.push(response.status);
    }
    const limited = await postJson("/auth/login", { email, password: "contraseña-incorrecta" });
    check(
      "rate limiter: 10 fallos devuelven 401 y el undécimo 429",
      failedStatuses.every((status) => status === 401) && limited.status === 429,
      { failedStatuses, limitedStatus: limited.status },
    );

    const login = await postJson("/auth/login", { email, password });
    const loginBody = await login.json();
    const setCookie = login.headers.get("set-cookie") || "";
    const cookie = setCookie.split(";")[0];
    const csrfToken = loginBody.data?.csrfToken;
    check("login: HTTP 200", login.status === 200, { status: login.status });
    check("login: authenticated=true en el envelope", loginBody.ok === true && loginBody.data?.authenticated === true, {
      authenticated: loginBody.data?.authenticated ?? null,
    });
    check("login: cookie smartdesk_session recibida", setCookie.includes("smartdesk_session="));
    check("login: cookie HttpOnly", /HttpOnly/i.test(setCookie));
    check("login: cookie SameSite=Strict", /SameSite=Strict/i.test(setCookie));
    check("login: cookie Path=/api", /Path=\/api/i.test(setCookie));
    check("login: Secure ausente en desarrollo", !/Secure/i.test(setCookie));
    check("login: csrfToken y permisos presentes", Boolean(csrfToken) && Array.isArray(loginBody.data?.permissions));

    const secondLogin = await postJson("/auth/login", { email, password });
    check("rate limiter: el éxito libera la cuenta", secondLogin.status === 200, { status: secondLogin.status });

    const me = await fetch(`${base}/auth/me`, { headers: { Cookie: cookie } });
    const meBody = await me.json();
    check("GET /auth/me: sesión autenticada", me.status === 200 && meBody.data?.authenticated === true, { status: me.status });
    check("GET /auth/me: mismo perfil", meBody.data?.user?.id === profileId);
    check("GET /auth/me: csrfToken disponible", Boolean(meBody.data?.csrfToken));

    const protectedWithCookie = await fetch(`${base}/incidents`, { headers: { Cookie: cookie } });
    check("Ruta protegida con cookie: HTTP 200", protectedWithCookie.status === 200, { status: protectedWithCookie.status });

    const protectedWithoutCookie = await fetch(`${base}/incidents`);
    check("Ruta protegida sin cookie: HTTP 401", protectedWithoutCookie.status === 401, { status: protectedWithoutCookie.status });

    const sessionsBefore = await client.query(
      "select count(*)::int as n from public.user_sessions where profile_id=$1",
      [profileId],
    );
    check("Persistencia: sesión guardada en Neon", sessionsBefore.rows[0].n >= 1, { sessions: sessionsBefore.rows[0].n });

    const logout = await postJson("/auth/logout", {}, cookie, csrfToken);
    check("Logout con CSRF: HTTP 200", logout.status === 200, { status: logout.status });

    const meAfter = await fetch(`${base}/auth/me`, { headers: { Cookie: cookie } });
    const meAfterBody = await meAfter.json();
    check("GET /auth/me tras logout: no autenticado", meAfterBody.data?.authenticated === false);

    const sessionsAfter = await client.query(
      "select count(*)::int as n from public.user_sessions where profile_id=$1",
      [profileId],
    );
    check("Persistencia: sesión eliminada tras logout", sessionsAfter.rows[0].n === sessionsBefore.rows[0].n - 1, {
      before: sessionsBefore.rows[0].n,
      after: sessionsAfter.rows[0].n,
    });

    console.log(JSON.stringify(results, null, 2));
    if (!results.every((item) => item.pass)) process.exitCode = 1;
  } catch (error) {
    console.log(JSON.stringify({ fatal: String(error && error.message ? error.message : error).split("\n")[0], results }, null, 2));
    process.exitCode = 1;
  } finally {
    if (server) server.kill("SIGKILL");
    if (profileId) {
      try {
        // Sólo se elimina el perfil sintético creado por esta prueba.
        await client.query("delete from public.profiles where id=$1", [profileId]);
      } catch {}
    }
    try { await client.end(); } catch {}
  }
})();
