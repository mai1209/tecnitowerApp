# Manual Tecnico: Elfin TCP Client + Oracle

Este manual deja una instalacion en el modo productivo validado:

```text
App movil
  -> Backend Oracle
  -> TCP Gateway Oracle:4001
  -> Elfin EW11A en TCP Client
  -> Controlador por RS485 Modbus
```

## 1. Datos que define el tecnico

Antes de empezar, el tecnico tiene que tener estos datos:

- WiFi del local: `SSID` y clave
- IP publica del backend Oracle: `137.131.194.247`
- Puerto TCP del gateway: `4001`
- `elfinId` unico del equipo
- `unitId` del controlador
- `baud rate` del controlador
- registros reales del modelo:
  - `probe1`
  - `probe2`
  - `setpoint`

Para el caso validado de `TC900E LOG`:

- `unitId = 1`
- `baud = 9600`
- `probe1 = 101`
- `probe2 = 102`
- `setpoint = 31`

---

## 2. Configurar WiFi del Elfin

Conectarse al hotspot del Elfin y abrir:

```text
http://10.10.100.254
```

Credenciales por defecto:

- usuario: `admin`
- clave: `admin`

En `System Settings`:

- WiFi Mode: `STA`
- STA SSID: WiFi del local
- STA KEY: clave del WiFi

Guardar con `Submit` y reiniciar el equipo.

---

## 3. Configurar RS485 del Elfin

En `Serial Port Settings` dejar:

- Baud Rate: `9600`
- Data Bit: `8`
- Stop Bit: `1`
- Parity: `None`
- Protocol: `Modbus`

Si el controlador usa otros valores, aca se cargan los reales del equipo instalado.

---

## 4. Configurar TCP Client del Elfin

En `Communication Settings` dejar:

### Basic Settings

- Name: `netp`
- Protocol: `TCP-CLIENT`

### Socket Settings

- Server: `137.131.194.247`
- Server Port: `4001`
- Local Port: `0`
- Buffer Size: `512`
- Keep Alive: `60`
- Timeout: `0`

### Protocol Settings

- Connect Mode: `Always`
- Register Mode: `Link`
- Register Code: `ELFIN:<elfinId>`
- Heart Beat: `OFF`

Ejemplo:

```text
Register Code = ELFIN:2018DP1893
```

### More Settings

- Security: `Disable`
- Route: `Uart`

Guardar con `Submit` y reiniciar el Elfin.

---

## 5. Configurar el controlador

En el controlador RS485 hay que confirmar como minimo:

- protocolo serial en Modbus
- `unitId` correcto
- `baud` correcto

Para `TC900E LOG`, la instalacion validada fue:

- `F24 = 1`
- `baud = 9600`
- `Prot = Modb`

Si el Elfin recibe por TCP y transmite por UART, pero `UART RecvBytes` queda en `0`, el problema no esta en Oracle: hay que revisar protocolo, direccion o cableado RS485 del controlador.

---

## 6. Alta del controlador en la app

En `Nuevo Controlador`, cargar:

- nombre del equipo
- modelo de hardware
- `elfinId`
- `unitId`
- `baud rate`
- `probe1`
- `probe2`

Notas:

- el modo visual de alta queda fijo en `Elfin TCP Client`
- la IP local del Elfin es opcional y solo sirve para soporte o acceso al panel local
- los valores reales que usa el backend son los del controlador guardado, no los defaults del modelo base

---

## 7. Configuracion de Oracle

Luego de configurar el panel del Elfin:

- desenchufar el Elfin
- esperar `5` segundos
- volver a enchufarlo
- reconectarse a la red WiFi local desde la notebook o celular del tecnico
- verificar que la red WiFi del Elfin haya desaparecido de la lista de redes

Si la red WiFi del Elfin ya no aparece, eso indica que el equipo se conecto correctamente a la red local configurada.

---

## 8. Configuracion de Oracle

En el backend Oracle, el `.env` debe quedar con:

```env
CONTROL_TRANSPORT=tcp-client
TCP_GATEWAY_HOST=0.0.0.0
TCP_GATEWAY_PORT=4001
TCP_GATEWAY_TIMEOUT_MS=12000
TCP_CLIENT_MODBUS_MODE=modbus-tcp
```

Durante validacion tecnica se puede activar:

```env
DEBUG_TCP_GATEWAY=1
```

En produccion conviene dejar:

```env
DEBUG_TCP_GATEWAY=0
```

---

## 9. Comandos de soporte Oracle

Entrar por SSH:

```bash
ssh -i /Users/maidev/Desktop/Codex/ssh-key-2026-04-09.key ubuntu@137.131.194.247
```

Editar `.env`:

```bash
cd ~/tecnitowerApp/backend-dixell
nano .env
```

Actualizar y reiniciar backend:

```bash
cd ~/tecnitowerApp
git pull origin main
sudo systemctl restart tecnitower-backend
sudo systemctl status tecnitower-backend --no-pager
```

Ver logs en vivo:

```bash
sudo journalctl -u tecnitower-backend -f
```

---

## 10. Validacion tecnica

### Desde la Mac o notebook del tecnico

Verificar backend Oracle:

```bash
curl http://137.131.194.247:3001/api/health
nc -vz -w 3 137.131.194.247 4001
```

### En logs de Oracle

Deberia verse:

- conexion entrante
- registro del Elfin con `ELFIN:<id>`
- tramas `tx`
- tramas `rx`

Ejemplo esperado:

```text
[TCP GATEWAY 2018DP1893] tx 12 bytes ...
[TCP GATEWAY 2018DP1893] rx 11 bytes ...
```

### Verificacion local del panel del Elfin

Consultar estado:

```bash
curl --max-time 10 -u admin:admin \
  http://IP_DEL_ELFIN/cmd \
  -H 'Content-Type: application/json; charset=utf-8' \
  --data 'msg={"CID":10001,"PL":["SOCK","UART"]}'
```

Si funciona correctamente:

- `SOCK State` debe quedar en `Connected`
- `RecvBytes` y `SendBytes` deben crecer

---

## 11. Regla de instalacion

Para nuevas instalaciones, el socket cloud del Elfin puede repetirse siempre:

- Server: `137.131.194.247`
- Port: `4001`
- Connect Mode: `Always`
- Register Mode: `Link`

Lo que cambia por cliente es:

- WiFi del local
- `elfinId` unico
- configuracion serial del controlador
- registros reales del modelo

El `elfinId` no debe repetirse entre clientes.
