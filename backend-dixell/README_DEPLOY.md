# Deploy Tecnitower API + Elfin TCP Client

## Arquitectura productiva validada

```text
App movil
  -> Backend Oracle
  -> TCP Gateway Oracle:4001
  -> Elfin EW11A en TCP Client
  -> Controlador RS485 Modbus
```

Este es el camino principal del proyecto.

---

## 1. Backend Oracle

Servicio Node:

```text
Root Directory: backend-dixell
Build Command: npm install
Start Command: npm start
```

Variables recomendadas:

```env
NODE_ENV=production
HOST=0.0.0.0
CONTROL_TRANSPORT=tcp-client
MONGODB_URI=mongodb+srv://...
MONGODB_DB_NAME=tecnitower
JWT_SECRET=valor-largo-random
JWT_EXPIRES_IN_SECONDS=604800
MQTT_URL=mqtts://TU_BROKER:8883
MQTT_USERNAME=TU_USUARIO
MQTT_PASSWORD=TU_PASSWORD
BACKEND_MQTT_CLIENT_ID=tecnitower-api-vps
MQTT_TOPIC=tecnitower/elfins/+/data
MQTT_ACK_TOPIC=tecnitower/elfins/+/ack
MQTT_RECONNECT_MS=3000
MQTT_COMMAND_TIMEOUT_MS=12000
TCP_GATEWAY_HOST=0.0.0.0
TCP_GATEWAY_PORT=4001
TCP_GATEWAY_TIMEOUT_MS=12000
TCP_CLIENT_MODBUS_MODE=modbus-tcp
DEBUG_TCP_GATEWAY=0
```

El backend debe exponer:

```text
3001/TCP
4001/TCP
```

---

## 2. Servicio systemd en Oracle

Comandos utiles:

```bash
cd ~/tecnitowerApp
git pull origin main
sudo systemctl restart tecnitower-backend
sudo systemctl status tecnitower-backend --no-pager
sudo journalctl -u tecnitower-backend -f
```

Si `status` muestra `active (running)`, el backend queda en produccion y arranca solo.

---

## 3. Configuracion del controlador

Para `TC900E LOG`, la instalacion validada fue:

```text
Prot: Modb
F24 / Unit ID: 1
Baud rate: 9600
Setpoint normal: register 31
Temperatura S1: register 101
Temperatura S2: register 102
```

---

## 4. Configuracion del Elfin

### Serial Port Settings

```text
Baud Rate: 9600
Data Bit: 8
Stop Bit: 1
Parity: None
Protocol: Modbus
```

### Communication Settings

```text
Name: netp
Protocol: TCP-CLIENT
Server: 147.15.48.169
Server Port: 4001
Local Port: 0
Buffer Size: 512
Keep Alive: 60
Timeout: 0
Connect Mode: Always
Register Mode: Link
Register Code: ELFIN:<elfinId_unico>
Heart Beat: OFF
Security: Disable
Route: Uart
```

Cada instalacion debe usar un `elfinId` unico.

---

## 5. Alta del controlador en la app

Datos minimos:

- nombre
- modelo
- `elfinId`
- `unitId`
- `baudRate`

Los registros reales del modelo se completan desde el modelo seleccionado y quedan guardados en el controlador.

---

## 6. Validacion tecnica

Verificar backend:

```bash
curl http://147.15.48.169:3001/api/health
nc -vz -w 3 147.15.48.169 4001
```

En logs de Oracle deben verse tramas `tx` y `rx`:

```text
[TCP GATEWAY 2018DP1893] tx ...
[TCP GATEWAY 2018DP1893] rx ...
```

Si el controlador no responde, revisar:

- protocolo Modbus en el controlador
- direccion / unit id
- baud rate
- cableado RS485
