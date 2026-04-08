# Flujo Backend Tecnitower

## 1. Variables de entorno
- Duplicar `.env.example` a `.env` y ajustar `MONGODB_URI`, `MONGODB_DB_NAME`, `PORT`, `JWT_SECRET`, `JWT_EXPIRES_IN_SECONDS`.
- Para habilitar MQTT definir `MQTT_URL` (ej: `mqtt://192.168.0.50:1883`), `MQTT_TOPIC` (por defecto `tecnitower/elfins/+/data`) y credenciales si aplica.
- Mantener el archivo `.env` fuera del control de versiones.

## 2. Conexión a MongoDB
- El módulo `database/connectMongo.js` centraliza la conexión con Mongoose.
- `connectMongo()` se ejecuta al iniciar el servidor y reutiliza la misma conexión para evitar múltiples sockets.
- Variables relevantes:
  - `MONGODB_URI`: cadena de conexión (por defecto `mongodb://127.0.0.1:27017/tecnitower`).
  - `MONGODB_DB_NAME`: nombre lógico de la base.
  - `MONGODB_TIMEOUT_MS`: tiempo máximo para seleccionar el servidor.

## 3. Arranque del servidor Express
- `server.js` carga `dotenv/config`, aplica `cors` y `express.json()`.
- Antes de escuchar peticiones se espera `connectMongo()`; si falla se aborta el proceso.
- Para desarrollo ejecutar `npm run dev` y validar `http://localhost:3001/api/health`.

## 4. Próximos pasos sugeridos
- Definir esquemas dentro de `models/` y servicios en `api/`.
- Exponer rutas desacopladas en `routes/` importándolas en `server.js`.
- Añadir middlewares reutilizables (auth, manejo de errores) en `middlewares/`.

## 5. Primer flujo de dominio: registro de usuarios
- **Modelo**: `models/User.js` define la entidad (fullName, email, passwordHash, role, isActive).
- **Controlador**: `api/authController.js` contiene `registerUser`, valida datos básicos y guarda el hash.
- **Ruta**: `routes/authRoutes.js` expone `POST /api/auth/register`.
- **Middlewares**: `middlewares/errorHandler.js` centraliza 404 y errores inesperados.
- **Utilidad**: `token/passwordManager.js` usa `crypto.scrypt` para generar hashes seguros sin dependencias externas.
- Request de ejemplo:

```bash
curl -X POST http://localhost:3001/api/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"fullName":"Admin","email":"admin@tecni.io","password":"secreto123","role":"admin"}'
```

## 6. Autenticación (login + JWT)
- **Controlador**: `loginUser` en `api/authController.js` busca el usuario activo, valida el password con `verifyPassword` y genera un token.
- **Rutas**: `POST /api/auth/login` devuelve `{ token, user }` si las credenciales son correctas.
- **Tokens**: `token/jwtManager.js` crea/verifica JWT HS256 usando `JWT_SECRET`; `JWT_EXPIRES_IN_SECONDS` define la vigencia (por defecto 3600 segundos).
- Request de ejemplo:

```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@tecni.io","password":"secreto123"}'
```

- Integración frontend:
  1. Registrar usuario (o crear un seed) y luego loguearse para obtener `token`.
  2. Guardar `token` en almacenamiento seguro (SecureStore/Keychain en mobile, `localStorage`/`sessionStorage` en web).
  3. Incluir `Authorization: Bearer <token>` en futuras requests protegidas (middleware pendiente).

## 7. Lectura Modbus
- **Controlador**: `api/modbusController.js` encapsula la lógica de conexión Modbus (timeouts, registros por defecto, manejo de errores).
- **Ruta**: `routes/modbusRoutes.js` expone `GET /api/modbus` y permite sobreescribir `ip`, `unitId`, `probe1`, `probe2` vía query-string.
- **Configuración**: puedes ajustar los valores por defecto mediante variables como `MODBUS_DEVICE_PORT`, `MODBUS_TIMEOUT_MS`, etc.; si no están definidas se usan los valores legacy (502, 1500 ms, registros 256/258).

## 8. Controladores por usuario
- **Modelo**: `models/Controller.js` guarda cada controlador asociado al usuario (`owner`), incluyendo nombre, modelo Dixell, `elfinId`, `ipAddress`, `unitId`, `probe1/2`, notas y ubicación.
- **Middleware**: `middlewares/authMiddleware.js` valida el JWT y llena `req.user` para las rutas protegidas.
- **Controlador/Rutas**: `api/controllerController.js` expone `createController` + `listControllers`. Se montan en `routes/controllerRoutes.js` bajo `/api/controllers` y requieren token.
- **Flujo**:
  1. `POST /api/controllers` recibe los datos del formulario. Si se envía `dixellModelId` (o nombre), auto-completa `probe1/2` con los valores del modelo Dixell asociado.
  2. `GET /api/controllers` devuelve los controladores del usuario autenticado para renderizarlos en Home.
- **Requests de ejemplo**:

```bash
TOKEN=<token_del_login>

curl -X POST http://localhost:3001/api/controllers \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Freezer Heladería Uno","dixellModel":"XR75CX","elfinId":"ELF-2018DP1893","ipAddress":"192.168.0.85"}'

curl -H "Authorization: Bearer $TOKEN" http://localhost:3001/api/controllers
```

## 9. Automatización modelos Dixell
- **Modelo**: `models/DixellModel.js` almacena cada referencia (nombre, descripción, `defaultUnitId`, `defaultProbe1/2`, `registerCount`, notas).
- **Controlador/Ruta**: `api/dixellModelController.js` + `routes/dixellModelRoutes.js` proveen:
  - `GET /api/dixell-models`: listado para que el frontend llene selects/autocomplete.
  - `POST /api/dixell-models`: sólo admin (`role === "admin"`) puede crear nuevos presets.
- **Uso en alta de controlador**: al crear un controlador, si se envía `dixellModelId` (o nombre) se aplican automáticamente los `probe1/2` y `unitId` sugeridos. Esto permite que el usuario sólo elija el modelo y no tenga que recordar direcciones de registros.
- **Request de ejemplo**:

```bash
TOKEN=<token_admin>

curl -X POST http://localhost:3001/api/dixell-models \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"XR75CX","defaultProbe1":256,"defaultProbe2":258,"defaultUnitId":1,"description":"Controlador cámaras frigoríficas"}'

curl http://localhost:3001/api/dixell-models
```

## 10. Control remoto de setpoint
- **Configuración**:
  - Define `setpointRegister`, `setpointMin` y `setpointMax` en `models/DixellModel` (o envíalos al crear el controlador) para que el backend sepa en qué holding register escribir.
  - Cada controlador copia estos valores cuando se crea y puede sobreescribirse manualmente.
- **Endpoint**: `POST /api/controllers/:controllerId/setpoint`
  - Body: `{ "temperature": -5.5 }` (°C). Se convierte a decimales x10 antes de escribir.
  - Requiere token JWT y que el controlador tenga `ipAddress` junto con `setpointRegister`.
  - Internamente usa Modbus función 0x06 (`writeRegister`) para enviar el nuevo setpoint y guarda el comando en `lastTelemetry.setpointCommand`.
- **Ejemplo**:

```bash
TOKEN=<token_del_login>
curl -X POST http://localhost:3001/api/controllers/67ad8f5a3d/setpoint \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"temperature": -3.0}'
```

- **Frontend**: la pantalla Live usa este endpoint para enviar comandos desde el campo “Control remoto” y muestra el mensaje de éxito al completar.

## 11. Suscripción MQTT (Mosquitto)
- **Listener**: `mqtt/mqttListener.js` usa la librería `mqtt` y se inicia automáticamente desde `server.js` si `MQTT_URL` está configurada.
- **Topic de telemetría**: `MQTT_TOPIC` (por defecto `tecnitower/elfins/+/data`) donde `+` corresponde al `elfinId`. Ejemplo: `tecnitower/elfins/ELF-2018DP1893/data`.
- **Topic de respuestas**: `MQTT_ACK_TOPIC` (por defecto `tecnitower/elfins/+/ack`) permite que el agente local confirme comandos publicados por el backend.
- **Parseo**: el payload debe ser JSON con campos como `probe1Value`, `probe2Value`, `raw1`, `raw2`, `temperature`. Cualquier estructura se guarda íntegra en `payload`.
- **Persistencia**:
  - Se actualiza `controller.lastTelemetry` con la última lectura recibida.
  - Se guarda un histórico en `models/ControllerReading.js` para auditoría.
- **Control remoto cloud**:
  - `CONTROL_TRANSPORT=direct`: el backend escribe por Modbus TCP directo contra la IP del Elfin. Útil en desarrollo local.
  - `CONTROL_TRANSPORT=mqtt`: el backend publica comandos JSON en `tecnitower/elfins/<elfinId>/cmd` y espera ACK del agente local en `tecnitower/elfins/<elfinId>/ack`.
  - `CONTROL_TRANSPORT=elfin-mqtt`: el backend publica tramas Modbus RTU binarias en `tecnitower/elfins/<elfinId>/tx` y espera la respuesta del Elfin EW11A en `tecnitower/elfins/<elfinId>/rx`.
  - El agente local se ejecuta en la red del Elfin con `npm run agent:local`; usa `LOCAL_AGENT_ELFIN_ID`, `LOCAL_AGENT_MODBUS_HOST`, `LOCAL_AGENT_MODBUS_PORT` y `LOCAL_AGENT_UNIT_ID`.
- **Prueba rápida**:

```bash
export TOKEN=$(curl -s -X POST http://localhost:3001/api/auth/login -d '{"email":"admin@tecni.io","password":"secreto123"}' -H 'Content-Type: application/json' | jq -r .token)
curl -X POST http://localhost:3001/api/controllers -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"name":"Freezer 1","dixellModel":"XR75CX","elfinId":"ELF-2018DP1893"}'

mosquitto_pub -h localhost -t tecnitower/elfins/ELF-2018DP1893/data -m '{"probe1Value":-18.3,"probe2Value":-15.1,"raw1":-183,"raw2":-151}'

curl -H "Authorization: Bearer $TOKEN" http://localhost:3001/api/controllers | jq '.controllers[0].lastTelemetry'
```

- **Notas**:
  - Si no configuras `MQTT_URL`, el listener no se inicia.
  - Usa `MQTT_USERNAME`/`MQTT_PASSWORD` si tu broker requiere autenticación.

## 12. Flujo recomendado para nube
- **App móvil**: consume una API pública con HTTPS, por ejemplo `https://api.tecnitower.com`.
- **Backend cloud**: mantiene login, usuarios, controladores y MongoDB Atlas. No intenta conectarse a IPs privadas `192.168.x.x`.
- **Broker MQTT**: punto común entre la nube y el local.
- **Agente local/Raspberry**: flujo recomendado para la primera entrega. Se conecta al broker MQTT y escribe por Modbus TCP al Elfin local.
- **Elfin/gateway MQTT directo**: queda como modo experimental (`CONTROL_TRANSPORT=elfin-mqtt`) para hardware que soporte Modbus/MQTT bidireccional y TLS moderno. No asumirlo para EW11A sin validación.
- **Controlador**: el TC900E queda detrás del Elfin con `Prot=Modb`, `F24=1`, `Baud=9600` y registros `SET=31`, `TMP1=101`, `TMP2=102`.
