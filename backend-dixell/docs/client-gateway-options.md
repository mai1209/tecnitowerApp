# Opcion recomendada para cliente

## Camino validado

```text
App
  -> Backend Oracle
  -> TCP Gateway Oracle:4001
  -> Elfin EW11A en TCP Client
  -> TC900E por RS485 Modbus
```

## Que necesita el cliente

- Elfin conectado al controlador por RS485
- WiFi 2.4 GHz en el local
- configuracion del panel del Elfin
- alta del controlador en la app con el mismo `elfinId`

## Ventajas

- no requiere Raspberry ni mini PC local
- no requiere gateway local prendido
- una sola configuracion cloud para todas las instalaciones
- Oracle identifica cada equipo por `Register Code / elfinId`

## Configuracion del Elfin

### Serial

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

## Configuracion del controlador

Para `TC900E LOG`:

```text
Prot: Modb
F24: 1
Baud: 9600
Probe 1: 101
Probe 2: 102
Setpoint: 31
```

## Recomendacion

Para instalaciones nuevas, este es el unico camino recomendado.
