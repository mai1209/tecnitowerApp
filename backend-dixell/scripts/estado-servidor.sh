#!/usr/bin/env bash
# Chequeo rápido de salud del servidor Tecnitower.
# Uso (en el server, desde backend-dixell):  bash scripts/estado-servidor.sh
set -u
cd "$(dirname "$0")/.." || exit 1

echo "══════════════════════════════════════════════"
echo "  ESTADO DEL SERVIDOR TECNITOWER — $(date '+%Y-%m-%d %H:%M')"
echo "══════════════════════════════════════════════"

echo ""
echo "── 1) BASE DE DATOS (límite Atlas M0: 512 MB) ──"
node -e "
require('dotenv/config');
const m = require('mongoose');
m.connect(process.env.MONGODB_URI, { dbName: process.env.MONGODB_DB_NAME }).then(async () => {
  const s = await m.connection.db.stats();
  const usadoMb = s.dataSize / 1048576;
  const pct = (usadoMb / 512) * 100;
  console.log('  Usado:', usadoMb.toFixed(1), 'MB de 512 (' + pct.toFixed(1) + '%)', pct > 80 ? '⚠️  ATENCIÓN: planificar ampliación' : '✅');
  const cols = await m.connection.db.listCollections().toArray();
  for (const c of cols) {
    const st = await m.connection.db.command({ collStats: c.name });
    if (st.size > 0) console.log('   ·', c.name + ':', (st.size / 1048576).toFixed(1), 'MB ·', st.count, 'docs');
  }
  process.exit(0);
}).catch((e) => { console.log('  ✗ No se pudo consultar la base:', e.message); process.exit(1); });
"

echo ""
echo "── 2) DISCO ──"
df -h / | awk 'NR==2 { gsub("%","",$5); estado = ($5+0 > 80) ? "⚠️  ATENCIÓN" : "✅"; print "  Usado: " $3 " de " $2 " (" $5 "%) " estado }'

echo ""
echo "── 3) MEMORIA ──"
free -h | awk '
  /^Mem:/  { print "  RAM:  " $3 " usada de " $2 " · disponible " $7 }
  /^Swap:/ { if ($2 == "0B") print "  Swap: SIN SWAP ⚠️  (conviene agregar 2G)"; else print "  Swap: " $3 " usada de " $2 " ✅" }
'

echo ""
echo "── 4) BACKEND ──"
if command -v pm2 >/dev/null 2>&1 && pm2 pid >/dev/null 2>&1; then
  pm2 list | sed 's/^/  /'
elif pgrep -f "node.*server.js" >/dev/null 2>&1; then
  echo "  ✅ Proceso node del backend corriendo (PID $(pgrep -f 'node.*server.js' | head -1))"
else
  echo "  ⚠️  No se detecta el proceso del backend"
fi

echo ""
echo "── 5) GATEWAYS CONECTADOS (puerto TCP 4001) ──"
CONS=$(ss -tn state established "( sport = :4001 )" 2>/dev/null | tail -n +2 | wc -l)
echo "  Elfins/gateways conectados ahora: ${CONS}"

echo ""
echo "── 6) API ──"
if curl -s -m 5 http://localhost:3001/api/health >/dev/null 2>&1; then
  echo "  ✅ API responde en :3001"
else
  echo "  ⚠️  La API no responde en :3001"
fi

echo ""
echo "══════════════════════════════════════════════"
echo "  Regla simple: si algo dice ⚠️ , avisar/planificar."
echo "══════════════════════════════════════════════"
