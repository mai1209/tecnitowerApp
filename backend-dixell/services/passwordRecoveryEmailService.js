const DEFAULT_FROM = "Tecnitower <no-reply@tecnitower.app>";

function buildRecoveryEmail({ code, expiresInMinutes }) {
  return {
    subject: "Código para recuperar tu contraseña Tecnitower",
    text: [
      "Recibimos una solicitud para recuperar tu contraseña de Tecnitower.",
      "",
      `Tu código de verificación es: ${code}`,
      `Este código vence en ${expiresInMinutes} minutos.`,
      "",
      "Si no solicitaste este cambio, ignorá este mensaje.",
    ].join("\n"),
    html: `
      <div style="font-family:Arial,sans-serif;color:#0f172a;line-height:1.5">
        <h2>Recuperación de contraseña</h2>
        <p>Recibimos una solicitud para recuperar tu contraseña de Tecnitower.</p>
        <p style="font-size:28px;font-weight:800;letter-spacing:4px;margin:20px 0">${code}</p>
        <p>Este código vence en ${expiresInMinutes} minutos.</p>
        <p style="color:#64748b">Si no solicitaste este cambio, ignorá este mensaje.</p>
      </div>
    `,
  };
}

async function sendWithResend({ to, subject, text, html }) {
  const apiKey = String(process.env.RESEND_API_KEY ?? "").trim();
  if (!apiKey) return false;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: String(process.env.EMAIL_FROM ?? DEFAULT_FROM).trim(),
      to: [to],
      subject,
      text,
      html,
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`No se pudo enviar email de recuperación (${response.status}): ${body}`);
  }

  return true;
}

export async function sendPasswordRecoveryCode({ email, code, expiresInMinutes }) {
  const message = buildRecoveryEmail({ code, expiresInMinutes });
  const sent = await sendWithResend({
    to: email,
    subject: message.subject,
    text: message.text,
    html: message.html,
  });

  if (sent) return;

  console.info(
    `[AUTH] Código de recuperación para ${email}: ${code} (vence en ${expiresInMinutes} min). ` +
      "Configurar RESEND_API_KEY/EMAIL_FROM para enviarlo por email."
  );
}
