# HTTPS para el backend Tecnitower (Caddy)

Guía para poner el backend detrás de HTTPS/WSS con **Caddy** (TLS automático de Let's Encrypt).
Hoy el backend corre en `http://147.15.48.169:3001` (HTTP plano). Esto NO está roto —
la app funciona igual—, pero por HTTP el token y las credenciales viajan en texto plano.
Esta guía cierra ese hueco.

- **Server:** Oracle Cloud Ubuntu (IP `147.15.48.169`)
- **Backend:** Node/Express en `:3001`, WebSocket en el mismo puerto (`/ws/controllers`)
- **Dominio:** `tecnitower.app` (ya lo usás para el email) → usaremos `api.tecnitower.app`

---

## 1. Apuntar el subdominio (en el proveedor de DNS)

Crear un registro **A**:

```
api.tecnitower.app   A   147.15.48.169
```

Verificar propagación (puede tardar unos minutos):

```bash
dig +short api.tecnitower.app     # debe devolver 147.15.48.169
```

## 2. Abrir puertos 80 y 443 (DOS lugares)

**a) Oracle Cloud Console** → VCN → Security List (o NSG) → Ingress Rules:
- TCP **80** desde `0.0.0.0/0`
- TCP **443** desde `0.0.0.0/0`

**b) Firewall del SO (iptables):**

```bash
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT
sudo netfilter-persistent save 2>/dev/null || sudo iptables-save | sudo tee /etc/iptables/rules.v4
```

(Si usás `ufw`: `sudo ufw allow 80,443/tcp`.)

## 3. Instalar Caddy

```bash
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update && sudo apt install -y caddy
```

## 4. Configurar Caddy

Editar `/etc/caddy/Caddyfile` y dejar SOLO esto (cambiar el email):

```caddy
{
    email tu-mail@ejemplo.com
}

api.tecnitower.app {
    reverse_proxy localhost:3001
}
```

Recargar:

```bash
sudo systemctl reload caddy
sudo systemctl status caddy --no-pager   # debe estar "active (running)"
```

Caddy saca el certificado de Let's Encrypt solo, lo renueva automáticamente, y proxya
HTTP **y** el WebSocket (`/ws/controllers`) sin config extra.

## 5. Verificar

```bash
curl https://api.tecnitower.app/api/health   # JSON de health por HTTPS, candado válido
```

Si responde OK, el HTTPS ya está funcionando. 🎉

---

## 6. Apuntar la app y el panel web al HTTPS (después de verificar el paso 5)

- **App móvil** (`frontend/tecnitowerController/src/services/api.ts`):
  cambiar `CLOUD_API_URL` de `http://147.15.48.169:3001` a `https://api.tecnitower.app`.
  El WebSocket deriva a `wss://` automáticamente. Luego **rebuildear el APK**.
- **Panel web admin** (`frontend/tecnitowerAdminWeb`): setear `__APP_API_BASE__` /
  variable de entorno de build a `https://api.tecnitower.app`.

## 7. Variables de entorno del backend (`.env`)

- `CORS_ORIGINS`: agregar el origin del panel web admin (y cualquier front que consuma la API).
- `trust proxy` ya está en `1` en el código → detrás de Caddy, el rate-limit y los logs
  ven la IP real del cliente vía `X-Forwarded-For`. No hay que tocar nada más.

## Notas / troubleshooting

- Si Caddy no obtiene el cert: revisar que el **A record** propagó (`dig`) y que los
  **puertos 80 y 443** estén abiertos en Oracle Console **y** en iptables. Let's Encrypt
  valida por el puerto 80.
- El backend sigue escuchando en `localhost:3001`; Caddy es el único que expone 443.
  Opcional: cerrar el `3001` al exterior (dejarlo solo local) una vez que Caddy funcione.
- Ver logs de Caddy: `sudo journalctl -u caddy -f`.
