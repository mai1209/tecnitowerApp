# Opciones de Implementacion para Cliente

## Opcion 1. Gateway Local Tecnitower

```text
App
  -> Backend cloud
  -> EMQX MQTT
  -> Gateway local Tecnitower (Raspberry / mini PC / Mac de demo)
  -> Elfin local por 192.168.x.x:502
  -> TC900E
```

### Que necesita el cliente

- Elfin actual conectado al TC900E por RS485.
- Una Raspberry, mini PC o equipo local que quede encendido.
- WiFi o red local para que el gateway local llegue al Elfin.

### Ventajas

- Es la opcion recomendada y validada.
- Reutiliza el Elfin actual.
- No expone Modbus directo a internet.
- Permite presentar y operar mas rapido.

### Configuracion local

- En la app: `Gateway Local`
- En el Elfin: `TCP-SERVER`, puerto `502`, `Route: uart`, serial `9600 8N1 Modbus`
- En la Raspberry/mini PC: agente local conectado a EMQX

## Opcion 2. Gateway MQTT directo compatible

```text
App
  -> Backend cloud
  -> EMQX MQTT
  -> Gateway MQTT directo compatible
  -> TC900E
```

### Que necesita el cliente

- Un gateway que soporte MQTT bidireccional real.
- Soporte de TLS moderno si va a usar broker cloud con `8883`.
- Topics MQTT configurables.

### Ventajas

- Menos componentes en la instalacion.
- Arquitectura mas limpia.

### Riesgo actual

- En el EW11A probado no quedo validado el modo MQTT directo.
- Por eso esta opcion debe considerarse solo con hardware compatible ya probado.

### Configuracion local

- En la app: `Elfin MQTT Directo`
- En el panel del gateway: configurar broker MQTT, usuario, password, topics, seguridad y ruta UART

## Recomendacion

La recomendacion para presentacion, MVP y primeras instalaciones es:

```text
Opcion 1: Gateway Local Tecnitower
```

La opcion 2 conviene dejarla para gateways directos que ya hayan sido validados en campo.
