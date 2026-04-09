# Deploy Tecnitower API + Gateway Local

## Arquitectura recomendada para presentacion/MVP

```text
App movil
  -> Backend cloud (Northflank/Render)
  -> Broker MQTT publico
  -> Agente local Tecnitower (Raspberry/mini PC/Mac de demo)
  -> Elfin por IP local 192.168.x.x:502
  -> RS485
  -> TC900E
```

El backend cloud no puede conectarse directo a IPs privadas como `192.168.100.55`. El agente local queda dentro de la red del cliente, se conecta hacia el broker MQTT y usa el Elfin en modo Modbus TCP local, que es el modo ya validado.

Ademas, el proyecto ya permite guardar el modo de gateway por controlador:

```text
agent-mqtt   -> recomendado para Raspberry/mini PC/Mac local
tcp-client   -> Elfin conectado como TCP Client a un puerto publico del backend/VPS
elfin-mqtt   -> experimental para gateways MQTT directos compatibles
direct       -> desarrollo local
```

Si el controlador no tiene `gatewayMode` guardado, el backend usa `CONTROL_TRANSPORT` del `.env` como fallback.

## 1. Backend cloud

Para Northflank o Render usar un servicio Node:

```text
Root Directory: backend-dixell
Build Command: npm install
Start Command: npm start
```

Variables cloud:

```env
NODE_ENV=production
HOST=0.0.0.0
CONTROL_TRANSPORT=agent-mqtt
MONGODB_URI=mongodb+srv://...
MONGODB_DB_NAME=tecnitower
JWT_SECRET=valor-largo-random
JWT_EXPIRES_IN_SECONDS=604800
MQTT_URL=mqtts://TU_BROKER:8883
MQTT_USERNAME=TU_USUARIO
MQTT_PASSWORD=TU_PASSWORD
BACKEND_MQTT_CLIENT_ID=tecnitower-api-production
MQTT_TOPIC=tecnitower/elfins/+/data
MQTT_ACK_TOPIC=tecnitower/elfins/+/ack
MQTT_RECONNECT_MS=3000
MQTT_COMMAND_TIMEOUT_MS=12000
TCP_GATEWAY_HOST=0.0.0.0
TCP_GATEWAY_PORT=4001
TCP_GATEWAY_TIMEOUT_MS=12000
```

En Render, el `render.yaml` ya deja `CONTROL_TRANSPORT=agent-mqtt`. En Northflank cargar estas variables manualmente.
Ese valor queda como default global; cada controlador puede sobreescribirlo con su `gatewayMode`.

Archivo base para copiar:

```text
backend-dixell/.env.northflank.example
```

Si el modo del controlador es `tcp-client`, además de `3001` tenés que exponer un segundo puerto TCP público:

```text
4001/TCP
```

## 2. Agente local de demo

En la Mac usada para demo, o en una Raspberry/mini PC dentro del local:

```bash
cd /Users/maidev/Desktop/maiWork/appTecnitower/backend-dixell
npm run agent:local
```

Variables del agente:

```env
MQTT_URL=mqtts://TU_BROKER:8883
MQTT_USERNAME=TU_USUARIO
MQTT_PASSWORD=TU_PASSWORD
LOCAL_AGENT_MQTT_CLIENT_ID=tecnitower-agent-2018DP1893
MQTT_RECONNECT_MS=3000
LOCAL_AGENT_ELFIN_ID=2018DP1893
LOCAL_AGENT_MODBUS_HOST=192.168.100.55
LOCAL_AGENT_MODBUS_PORT=502
LOCAL_AGENT_UNIT_ID=1
```

En el panel de clientes del broker MQTT deberias ver:

```text
tecnitower-api-production
tecnitower-agent-2018DP1893
```

Para Raspberry/mini PC Linux, usar como base:

```text
scripts/tecnitower-agent.service.example
```

La idea en produccion no es dejar una terminal abierta: el agente se instala como servicio y arranca solo al encender el equipo.

Instalacion orientativa en Linux:

```bash
sudo mkdir -p /opt/tecnitower-agent
sudo cp -R backend-dixell /opt/tecnitower-agent/
sudo cp /opt/tecnitower-agent/backend-dixell/.env.agent.example /opt/tecnitower-agent/backend-dixell/.env
sudo cp /opt/tecnitower-agent/backend-dixell/scripts/tecnitower-agent.service.example /etc/systemd/system/tecnitower-agent.service
sudo systemctl daemon-reload
sudo systemctl enable tecnitower-agent
sudo systemctl start tecnitower-agent
sudo systemctl status tecnitower-agent
```

Antes de iniciar el servicio, editar `/opt/tecnitower-agent/backend-dixell/.env` con el broker MQTT y la IP local del Elfin del cliente.

## 3. Configuracion local del TC900E + Elfin

TC900E:

```text
Prot: Modb
F24 / Unit ID: 1
Baud rate: 9600
Setpoint normal: register 31
Temperatura S1: register 101
Temperatura S2: register 102
```

Elfin:

```text
Modo usado por el agente: Modbus TCP local
IP local: 192.168.100.55
Puerto: 502
Serial: 9600, 8, none, 1
```

Validacion local:

```bash
nc -vz -w 3 192.168.100.55 502
```

## 4. App movil

Cuando el hosting entregue el dominio final, actualizar `CLOUD_API_URL` en:

```text
frontend/tecnitowerController/src/services/api.ts
```

Ejemplo:

```ts
const CLOUD_API_URL = "https://tecnitower-api.northflank.app";
```

## 5. Gateway MQTT directo

El backend tambien soporta:

```env
CONTROL_TRANSPORT=elfin-mqtt
```

Ese modo publica tramas Modbus RTU binarias en:

```text
tecnitower/elfins/<elfinId>/tx
```

y espera respuesta en:

```text
tecnitower/elfins/<elfinId>/rx
```

Este modo queda como experimental para gateways que soporten Modbus/MQTT bidireccional real y TLS moderno. En el EW11A probado, el MQTT directo no quedo validado: con TLS no conecto a EMQX Serverless y con MQTT 1883 recibio mensajes pero no devolvio respuesta por `rx`.

En la app, al registrar un controlador, ya se puede elegir:

```text
Gateway Local      -> guarda gatewayMode=agent-mqtt
Elfin MQTT Directo -> guarda gatewayMode=elfin-mqtt
```
