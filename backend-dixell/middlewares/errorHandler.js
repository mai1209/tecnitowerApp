export function notFoundHandler(_req, res, _next) {
  return res.status(404).json({
    error: "Ruta no encontrada",
  });
}

export function errorHandler(err, _req, res, _next) {
  console.error("[API] Error no controlado:", err);

  const statusCode = err?.statusCode ?? 500;

  // No filtrar detalles internos al cliente en errores 5xx (rutas de DB,
  // stack traces, etc.). En 4xx el mensaje suele ser seguro y útil.
  const message =
    statusCode >= 500
      ? "Ocurrió un error inesperado. Revisa los logs del servidor para más detalles."
      : err?.message ?? "Solicitud inválida.";

  return res.status(statusCode).json({
    error: message,
  });
}
