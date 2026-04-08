export function notFoundHandler(_req, res, _next) {
  return res.status(404).json({
    error: "Ruta no encontrada",
  });
}

export function errorHandler(err, _req, res, _next) {
  console.error("[API] Error no controlado:", err);

  const statusCode = err?.statusCode ?? 500;
  const message =
    err?.message ?? "Ocurrió un error inesperado. Revisa los logs del servidor para más detalles.";

  return res.status(statusCode).json({
    error: message,
  });
}
