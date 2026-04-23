# Demo Local de Riesgo por HTTP

Esta demo existe para mostrarle a un cliente el impacto visible de servir una pagina sin forzar `HTTPS`.

No intercepta trafico, no modifica un sitio real y no toca infraestructura ajena. Solo compara:

- una respuesta legitima
- una respuesta alterada de forma demostrativa

## Ejecutar

```bash
node /Users/maidev/Desktop/maiWork/appTecnitower/tmp/http-risk-demo/server.js
```

Despues abri en el navegador:

```text
http://localhost:8787
```

Si preferis no levantar ningun servidor, tambien podes generar una version estatica:

```bash
node /Users/maidev/Desktop/maiWork/appTecnitower/tmp/http-risk-demo/build-static.js
```

Eso crea estos archivos listos para abrir en el navegador:

- `/Users/maidev/Desktop/maiWork/appTecnitower/tmp/http-risk-demo/dist/index.html`
- `/Users/maidev/Desktop/maiWork/appTecnitower/tmp/http-risk-demo/dist/normal.html`
- `/Users/maidev/Desktop/maiWork/appTecnitower/tmp/http-risk-demo/dist/altered.html`

## Que mostrar

1. La pantalla inicial explica el objetivo de la demo.
2. La version legitima muestra un pago hacia SumUp y los datos de contacto esperados.
3. La version alterada cambia tres elementos visibles:
   - el destino del boton de pago
   - el numero de WhatsApp
   - el email de contacto

## Como explicarlo

Podes decir algo como:

> Esta demo no ataca tu web. Solo ilustra el tipo de cambio que un usuario podria recibir si entra a una pagina por HTTP y la conexion no se fuerza a HTTPS desde el servidor.

## Limite de la demo

La demo no intenta reproducir un ataque de red. Su funcion es pedagogica: hacer visible el dano potencial sin tocar el sitio real.
