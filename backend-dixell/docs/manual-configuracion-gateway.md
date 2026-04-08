# Manual de Configuración del Gateway

Este manual cubre dos formas de instalar Tecnitower:

1. **Gateway Local Tecnitower**: Raspberry, mini PC o Mac local.
2. **Gateway MQTT Directo Compatible**: para hardware que soporte MQTT bidireccional real.

---

## Opcion 1. Gateway Local Tecnitower

### Cuando usarla

Usar esta opcion si el cliente ya tiene un Elfin EW11A o un gateway local que funcione bien por Modbus TCP local.

Es la opcion recomendada para primeras instalaciones.

### Flujo

```text
App
  -> Backend cloud
  -> EMQX MQTT
  -> Gateway local Tecnitower
  -> Elfin local por IP y puerto 502
  -> TC900E por RS485
```

### 1. Configurar el controlador en la app

Al registrar el controlador:

- **Modo de conexion**: `Gateway Local`
- **ID Elfin**: serial o identificador del gateway local
- **IP local**: IP del Elfin en la red del cliente
- **Unit ID**: normalmente `1`
- **Baud rate**: `9600`

### 2. Configurar el Elfin

#### WiFi

- Modo: `STA`
- SSID: WiFi del local
- Password: clave del WiFi

#### Serial / UART

- Baudrate: `9600`
- Databits: `8`
- Stopbits: `1`
- Parity: `NONE`
- UartProto: `Modbus`

#### Socket

- Name: `netp`
- Protocol: `TCP-SERVER`
- Port: `502`
- Security: `Disable`
- Route: `uart`
- Connect Mode: `Always`

### 3. Configurar el controlador Dixell

- Protocolo: `Modb`
- Unit ID / F24: `1`
- Baud rate: `9600`

### 4. Configurar el gateway local Tecnitower

En la Raspberry, mini PC o Mac local, crear `.env` con:

```env
MQTT_URL=mqtts://TU_BROKER:8883
MQTT_USERNAME=TU_USUARIO
MQTT_PASSWORD=TU_PASSWORD
LOCAL_AGENT_MQTT_CLIENT_ID=tecnitower-agent-2018DP1893
LOCAL_AGENT_ELFIN_ID=2018DP1893
LOCAL_AGENT_MODBUS_HOST=192.168.100.55
LOCAL_AGENT_MODBUS_PORT=502
LOCAL_AGENT_UNIT_ID=1
MODBUS_TIMEOUT_MS=1500
```

Levantar el agente:

```bash
npm run agent:local
```

En produccion debe quedar como servicio automatico.

### 5. Validacion

Validar primero que el Elfin responda en la red local:

```bash
nc -vz -w 3 192.168.100.55 502
```

Validar lectura Modbus:

```bash
node --input-type=module -e "import ModbusRTU from 'modbus-serial'; const c=new ModbusRTU(); try{await c.connectTCP('192.168.100.55',{port:502}); c.setID(1); c.setTimeout(3000); const res=await c.readHoldingRegisters(31,1); console.log(res.data[0]);}catch(e){console.error(e.message||String(e));} finally{try{c.close();}catch{}}"
```

Si esto funciona, la app deberia poder leer y escribir.

---

## Opcion 2. Gateway MQTT Directo Compatible

### Cuando usarla

Usar esta opcion solo si el gateway fue validado para:

- MQTT bidireccional real
- request/response Modbus por MQTT
- TLS moderno si usa broker cloud seguro

### Flujo

```text
App
  -> Backend cloud
  -> EMQX MQTT
  -> Gateway MQTT directo compatible
  -> TC900E
```

### 1. Configurar el controlador en la app

Al registrar el controlador:

- **Modo de conexion**: `Elfin MQTT Directo`
- **ID Elfin**: serial o identificador MQTT del gateway
- **IP local**: opcional
- **Unit ID**: normalmente `1`
- **Baud rate**: `9600`

### 2. Configurar el panel del gateway

En `socket.html` o panel equivalente:

- Protocol: `MQTT`
- Server: endpoint del broker MQTT
- Port: `8883` o `1883` segun el caso
- Security: `TLS` o `Disable`
- MQTT Client ID: identificador unico del gateway
- MQTT User: usuario del broker
- MQTT Password: clave del broker
- Subscribe Topic: `tecnitower/elfins/<elfinId>/tx`
- Publish Topic: `tecnitower/elfins/<elfinId>/rx`
- Route: `uart`
- Connect Mode: `Always`

### 3. Configurar el controlador Dixell

- Protocolo: `Modb`
- Unit ID / F24: `1`
- Baud rate: `9600`

### 4. Configurar el backend cloud

En el backend:

```env
CONTROL_TRANSPORT=elfin-mqtt
MQTT_URL=mqtts://TU_BROKER:8883
MQTT_USERNAME=TU_USUARIO
MQTT_PASSWORD=TU_PASSWORD
MQTT_RAW_COMMAND_TOPIC_SUFFIX=tx
MQTT_RAW_RESPONSE_TOPIC_SUFFIX=rx
```

### 5. Advertencia

Esta opcion queda como **experimental** hasta validar el modelo exacto del gateway.

Si no hay respuesta por MQTT `rx`, la instalacion debe volver al camino del **Gateway Local Tecnitower**.

---

## Recomendacion final

Para clientes nuevos y primeras instalaciones:

```text
Recomendado: Gateway Local Tecnitower
```

Para hardware MQTT directo ya probado:

```text
Opcional: Gateway MQTT Directo Compatible
```
