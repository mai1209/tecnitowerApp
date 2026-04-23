const http = require("http");
const { URL } = require("url");

const host = "127.0.0.1";
const port = Number(process.env.PORT || 8787);

const normalState = {
  heading: "11 Espacio Holistico",
  badge: "Flujo legitimo",
  badgeClass: "badge-safe",
  intro:
    "Tu cuerpo recuerda lo que la mente olvida. Esta vista simula una reserva normal, coherente con la marca y con el paso final de pago seguro.",
  paymentHref: "https://sumup.example/checkout/11-espacio-holistico",
  paymentLabel: "Ir al pago seguro",
  paymentNote:
    "Paso 3 de 3. El boton mantiene la referencia a SumUp y la reserva sigue el flujo esperado.",
  whatsappHref: "https://wa.me/34600111222",
  whatsappLabel: "WhatsApp de reservas",
  emailHref: "mailto:reservas@11espacioholistico.com",
  emailLabel: "reservas@11espacioholistico.com",
  alert: "Sin cambios visibles en la reserva, el pago ni los datos de contacto.",
  alertClass: "alert-safe",
  reserveLabel: "Regalar ✦ Para mi",
  reserveNote: "Masaje Kundalini · 80 EUR / sesion",
};

const alteredState = {
  heading: "11 Espacio Holistico",
  badge: "Version alterada en transito",
  badgeClass: "badge-danger",
  intro:
    "Esta vista controlada muestra como la misma reserva podria verse distinta si un tercero altera la respuesta antes de que llegue al navegador del cliente.",
  paymentHref: "https://checkout-reservas.example/orden-118",
  paymentLabel: "Confirmar reserva ahora",
  paymentNote:
    "El boton apunta a un destino distinto y el texto mete urgencia para bajar la verificacion del cliente.",
  whatsappHref: "https://wa.me/34600999000",
  whatsappLabel: "WhatsApp soporte",
  emailHref: "mailto:cobros@espacio-holistico.example",
  emailLabel: "cobros@espacio-holistico.example",
  alert:
    "Cambios demostrativos: se alteraron el destino de pago, el WhatsApp y el email sin tocar el servidor original.",
  alertClass: "alert-danger",
  reserveLabel: "Reserva confirmada hoy",
  reserveNote: "Masaje Kundalini · 80 EUR / sesion",
};

function renderPage(state) {
  return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>11 Espacio Holistico | Demo de Riesgo HTTP</title>
    <style>
      :root {
        --paper: rgba(255, 251, 244, 0.84);
        --paper-2: rgba(255, 255, 255, 0.74);
        --ink: #312a21;
        --muted: #6d6256;
        --accent: #6f7f63;
        --accent-2: #b8794b;
        --safe: #5b7354;
        --danger: #a34b45;
        --border: rgba(49, 42, 33, 0.1);
        --shadow: 0 26px 90px rgba(79, 63, 47, 0.12);
      }

      * {
        box-sizing: border-box;
      }

      body {
        margin: 0;
        font-family: "Avenir Next", "Segoe UI", sans-serif;
        color: var(--ink);
        background:
          radial-gradient(circle at top left, rgba(111, 127, 99, 0.22), transparent 28%),
          radial-gradient(circle at bottom right, rgba(184, 121, 75, 0.18), transparent 26%),
          linear-gradient(180deg, #fffaf2 0%, #efe4d5 100%);
      }

      main {
        max-width: 980px;
        margin: 0 auto;
        padding: 48px 20px 64px;
      }

      .hero,
      .panel {
        background: var(--paper);
        backdrop-filter: blur(14px);
        border: 1px solid var(--border);
        border-radius: 28px;
        box-shadow: var(--shadow);
      }

      .hero {
        padding: 30px;
      }

      .topbar {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        margin-bottom: 20px;
      }

      .topbar span {
        display: inline-flex;
        align-items: center;
        min-height: 34px;
        padding: 0 12px;
        border-radius: 999px;
        color: var(--muted);
        background: rgba(49, 42, 33, 0.05);
        font-size: 13px;
        letter-spacing: 0.04em;
        text-transform: uppercase;
      }

      .evidence {
        margin-top: 18px;
        padding: 18px 20px;
        border-radius: 20px;
        background: rgba(111, 127, 99, 0.08);
        border: 1px solid rgba(111, 127, 99, 0.16);
      }

      .evidence strong {
        display: block;
        margin-bottom: 8px;
        font-size: 15px;
      }

      .evidence p + p {
        margin-top: 8px;
      }

      .badge-safe,
      .badge-danger {
        display: inline-flex;
        align-items: center;
        padding: 8px 14px;
        border-radius: 999px;
        font-size: 13px;
        font-weight: 700;
        letter-spacing: 0.04em;
        text-transform: uppercase;
      }

      .badge-safe {
        color: var(--safe);
        background: rgba(22, 101, 52, 0.12);
      }

      .badge-danger {
        color: var(--danger);
        background: rgba(185, 28, 28, 0.12);
      }

      h1 {
        margin: 18px 0 12px;
        font-size: clamp(38px, 8vw, 74px);
        line-height: 0.94;
        letter-spacing: -0.04em;
        font-family: Georgia, "Times New Roman", serif;
        font-weight: 600;
      }

      .eyebrow {
        color: var(--accent-2);
        font-size: 14px;
        font-weight: 700;
        letter-spacing: 0.12em;
        text-transform: uppercase;
      }

      .subhead {
        margin-top: 10px;
        max-width: 620px;
      }

      p {
        margin: 0;
        color: var(--muted);
        font-size: 18px;
        line-height: 1.6;
      }

      .grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
        gap: 18px;
        margin-top: 24px;
      }

      .card {
        padding: 22px;
        border-radius: 22px;
        background: var(--paper-2);
        border: 1px solid var(--border);
      }

      .card h2 {
        margin: 0 0 8px;
        font-size: 18px;
      }

      .link {
        display: inline-flex;
        margin-top: 14px;
        color: var(--accent);
        font-weight: 700;
        text-decoration: none;
        word-break: break-word;
      }

      .panel {
        margin-top: 22px;
        padding: 24px;
      }

      .alert-safe,
      .alert-danger {
        margin-top: 18px;
        padding: 14px 16px;
        border-radius: 16px;
        font-weight: 600;
      }

      .alert-safe {
        color: var(--safe);
        background: rgba(22, 101, 52, 0.09);
      }

      .alert-danger {
        color: var(--danger);
        background: rgba(185, 28, 28, 0.09);
      }

      .actions {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        margin-top: 26px;
      }

      .button,
      .button-alt {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-height: 48px;
        padding: 0 18px;
        border-radius: 999px;
        text-decoration: none;
        font-weight: 700;
      }

      .button {
        color: white;
        background: linear-gradient(135deg, var(--accent), #58694c);
      }

      .button-alt {
        color: var(--ink);
        background: rgba(49, 42, 33, 0.06);
      }

      .caption {
        margin-top: 14px;
        font-size: 14px;
        color: var(--muted);
      }

      .session-meta {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        margin-top: 20px;
      }

      .session-meta span {
        display: inline-flex;
        align-items: center;
        min-height: 40px;
        padding: 0 14px;
        border-radius: 999px;
        background: rgba(111, 127, 99, 0.08);
        color: var(--ink);
        font-weight: 700;
      }

      .compare {
        margin-top: 24px;
        padding: 18px;
        border-radius: 18px;
        background: rgba(49, 42, 33, 0.04);
      }

      .brandline {
        margin-top: 18px;
        font-size: 15px;
      }

      .demo-note {
        margin-top: 18px;
        padding: 16px 18px;
        border-radius: 18px;
        background: rgba(184, 121, 75, 0.08);
      }

      code {
        padding: 2px 6px;
        border-radius: 8px;
        background: rgba(49, 42, 33, 0.06);
        font-family: ui-monospace, "SFMono-Regular", monospace;
        font-size: 0.95em;
      }
    </style>
  </head>
  <body>
    <main>
      <section class="hero">
        <div class="topbar">
          <span>Sesiones</span>
          <span>Resenas</span>
          <span>Donde estamos</span>
          <span>WhatsApp</span>
        </div>
        <span class="${state.badgeClass}">${state.badge}</span>
        <h1>${state.heading}</h1>
        <div class="eyebrow">Tu cuerpo recuerda lo que la mente olvida</div>
        <p class="subhead">${state.intro}</p>
        <div class="session-meta">
          <span>${state.reserveNote}</span>
          <span>Pago paso 3 de 3</span>
          <span>${state.reserveLabel}</span>
        </div>
        <div class="evidence">
          <strong>Relacion directa con el sitio real</strong>
          <p>En <code>11espacioholistico.com</code> se observo que <code>http://</code> responde <code>200 OK</code> en lugar de redirigir a <code>https://</code>.</p>
          <p>Esta pantalla muestra una version demostrativa del mismo flujo para explicar que tipo de cambios visibles podria recibir un cliente si entra por HTTP.</p>
        </div>
        <div class="${state.alertClass}">${state.alert}</div>
        <div class="actions">
          <a class="button" href="${state.paymentHref}" target="_blank" rel="noreferrer">${state.paymentLabel}</a>
          <a class="button-alt" href="/?view=compare">Volver a la comparacion</a>
        </div>
        <p class="caption">En un escenario real, un usuario solo veria una de estas respuestas y asumiria que es la legitima.</p>
        <p class="brandline">Demostracion inspirada en la identidad comercial del sitio, sin copiar ni tocar su codigo.</p>
      </section>

      <section class="grid">
        <article class="card">
          <h2>Pago de la reserva</h2>
          <p>${state.paymentNote}</p>
          <a class="link" href="${state.paymentHref}" target="_blank" rel="noreferrer">${state.paymentHref}</a>
        </article>
        <article class="card">
          <h2>WhatsApp</h2>
          <p>Este es el contacto que veria el cliente si toca el acceso rapido desde la pagina.</p>
          <a class="link" href="${state.whatsappHref}" target="_blank" rel="noreferrer">${state.whatsappLabel}</a>
        </article>
        <article class="card">
          <h2>Email</h2>
          <p>Si el correo cambia en la pagina, el cliente puede mandar datos o comprobantes al destinatario equivocado.</p>
          <a class="link" href="${state.emailHref}">${state.emailLabel}</a>
        </article>
      </section>

      <section class="panel">
        <strong>Que demuestra esta pantalla</strong>
        <div class="compare">
          <p>La demo no intercepta trafico ni toca un sitio real. Solo enseña el tipo de cambio visible que un atacante podria introducir cuando una pagina se sirve por <code>http://</code> sin forzar <code>https://</code>.</p>
        </div>
        <div class="demo-note">
          <p>La idea para el cliente es simple: aunque SumUp sea seguro, el riesgo aparece antes, cuando la persona todavia esta viendo la pagina del negocio y decide a donde hacer clic.</p>
        </div>
      </section>
    </main>
  </body>
</html>`;
}

function renderIndex() {
  return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>11 Espacio Holistico | Comparacion de Riesgo HTTP</title>
    <style>
      :root {
        --paper: rgba(255, 251, 244, 0.84);
        --ink: #312a21;
        --muted: #6d6256;
        --accent: #6f7f63;
        --accent-2: #b8794b;
        --border: rgba(49, 42, 33, 0.1);
        --shadow: 0 24px 80px rgba(79, 63, 47, 0.14);
      }

      * {
        box-sizing: border-box;
      }

      body {
        margin: 0;
        font-family: "Avenir Next", "Segoe UI", sans-serif;
        color: var(--ink);
        background:
          radial-gradient(circle at top left, rgba(111, 127, 99, 0.22), transparent 26%),
          radial-gradient(circle at 85% 20%, rgba(184, 121, 75, 0.14), transparent 22%),
          linear-gradient(180deg, #fffaf2 0%, #efe4d5 100%);
      }

      main {
        max-width: 1100px;
        margin: 0 auto;
        padding: 44px 20px 64px;
      }

      .hero,
      .panel {
        background: var(--paper);
        backdrop-filter: blur(14px);
        border: 1px solid var(--border);
        border-radius: 28px;
        box-shadow: var(--shadow);
      }

      .hero {
        padding: 32px;
      }

      h1 {
        margin: 0;
        font-size: clamp(38px, 8vw, 76px);
        line-height: 0.94;
        letter-spacing: -0.05em;
        font-family: Georgia, "Times New Roman", serif;
        font-weight: 600;
      }

      .lead {
        margin-top: 16px;
        max-width: 720px;
        color: var(--muted);
        font-size: 18px;
        line-height: 1.65;
      }

      .actions {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        margin-top: 28px;
      }

      .button,
      .button-alt {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-height: 48px;
        padding: 0 18px;
        border-radius: 999px;
        text-decoration: none;
        font-weight: 700;
      }

      .button {
        color: white;
        background: linear-gradient(135deg, var(--accent), #58694c);
      }

      .button-alt {
        color: var(--ink);
        background: rgba(49, 42, 33, 0.06);
      }

      .grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
        gap: 18px;
        margin-top: 22px;
      }

      .panel {
        padding: 24px;
      }

      .panel h2 {
        margin: 0 0 10px;
      }

      ul {
        margin: 12px 0 0;
        padding-left: 18px;
        color: var(--muted);
      }

      li + li {
        margin-top: 8px;
      }

      code {
        padding: 2px 6px;
        border-radius: 8px;
        background: rgba(49, 42, 33, 0.06);
        font-family: ui-monospace, "SFMono-Regular", monospace;
        font-size: 0.95em;
      }

      .eyebrow {
        color: var(--accent-2);
        font-size: 14px;
        font-weight: 700;
        letter-spacing: 0.12em;
        text-transform: uppercase;
      }

      .topbar {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        margin-bottom: 18px;
      }

      .topbar span {
        display: inline-flex;
        align-items: center;
        min-height: 34px;
        padding: 0 12px;
        border-radius: 999px;
        color: var(--muted);
        background: rgba(49, 42, 33, 0.05);
        font-size: 13px;
        letter-spacing: 0.04em;
        text-transform: uppercase;
      }

      .evidence-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
        gap: 18px;
        margin-top: 22px;
      }

      .evidence-card {
        padding: 22px;
        border-radius: 22px;
        background: rgba(255, 251, 244, 0.84);
        border: 1px solid var(--border);
        box-shadow: var(--shadow);
      }

      .evidence-card h2 {
        margin: 0 0 10px;
      }

      .evidence-card p + p {
        margin-top: 10px;
      }
    </style>
  </head>
  <body>
    <main>
      <section class="hero">
        <div class="topbar">
          <span>Sesiones</span>
          <span>Resenas</span>
          <span>Donde estamos</span>
          <span>WhatsApp</span>
        </div>
        <div class="eyebrow">11 Espacio Holistico</div>
        <h1>Demo visual del riesgo por HTTP</h1>
        <p class="lead">Esta version esta adaptada al tono del sitio real: sesiones holisticas, reserva, regalo y paso a pago. La comparacion sirve para mostrarle al cliente que el problema aparece antes del checkout, cuando la pagina todavia puede ser modificada si no se fuerza HTTPS.</p>
        <div class="actions">
          <a class="button" href="/site?mode=normal">Abrir version legitima</a>
          <a class="button-alt" href="/site?mode=altered">Abrir version alterada</a>
        </div>
      </section>

      <section class="evidence-grid">
        <article class="evidence-card">
          <h2>Esto si se observo en su web</h2>
          <p>En <code>http://11espacioholistico.com</code> y <code>http://www.11espacioholistico.com</code> el servidor respondio <code>200 OK</code>, no <code>301</code> ni <code>308</code>.</p>
          <p>Eso significa que el sitio real acepta HTTP y no fuerza HTTPS desde el servidor.</p>
        </article>
        <article class="evidence-card">
          <h2>Que muestra esta demo</h2>
          <p>No es una copia del sitio ni un ataque en vivo. Es una representacion visual aplicada a su flujo de reserva, pago y contacto.</p>
          <p>La relacion con su web es directa: si el dominio acepta HTTP, un cliente podria recibir una version alterada antes de llegar al pago real.</p>
        </article>
      </section>

      <section class="grid">
        <article class="panel">
          <h2>Como presentarla</h2>
          <ul>
            <li>Mostra primero la version legitima y remarca que se parece a una reserva normal del negocio.</li>
            <li>Abri despues la version alterada y marca tres cambios visibles: boton de pago, WhatsApp y email.</li>
            <li>Cerra con la idea central: si el sitio acepta <code>http://</code>, el riesgo es que el usuario vea una respuesta distinta de la original.</li>
          </ul>
        </article>
        <article class="panel">
          <h2>Mensaje recomendado</h2>
          <ul>
            <li>El problema no es SumUp en si, sino el paso previo en la pagina del negocio.</li>
            <li>Aunque el checkout real sea seguro, un tercero puede intentar desviar al cliente antes de que llegue a esa pasarela.</li>
            <li>La correccion prioritaria es forzar <code>HTTP -&gt; HTTPS</code> y activar <code>HSTS</code>.</li>
          </ul>
        </article>
      </section>
    </main>
  </body>
</html>`;
}

function createServer() {
  return http.createServer((req, res) => {
    const requestUrl = new URL(req.url, `http://${req.headers.host || "localhost"}`);

    if (requestUrl.pathname === "/site") {
      const mode = requestUrl.searchParams.get("mode") === "altered" ? "altered" : "normal";
      const state = mode === "altered" ? alteredState : normalState;
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end(renderPage(state));
      return;
    }

    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(renderIndex());
  });
}

module.exports = {
  alteredState,
  createServer,
  normalState,
  renderIndex,
  renderPage,
};

if (require.main === module) {
  const server = createServer();
  server.listen(port, host, () => {
    console.log(`HTTP risk demo running on http://${host}:${port}`);
  });
}
