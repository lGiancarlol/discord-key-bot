# Discord Key License Bot (Multi-Provider)

Bot de Discord interactivo para generación, eliminación y reseteo de HWID de licencias conectado a múltiples plataformas web (Bypass Web, MyCheats, KeyAuth) con panel de botones y modales.

## 🚀 Características
- **Panel Interactivo con Botones:** `🔑 Crear Key`, `🗑️ Eliminar Key`, `🔄 Reset HWID`, `📋 Mis Keys`, `📄 Mi Membresía`.
- **Modales (Formularios Emergentes):** Duración en días (1 a 30), Cantidad de keys (1-5), Prefijo personalizado y Notas.
- **Multi-Plataforma:**
  - **Bypass Web** (`http://172.96.172.132:3000`): API REST integrada.
  - **MyCheats** (`https://new.mycheats.net`): Generación automática con sesiones HTTP y tokens CSRF.
  - **KeyAuth** (`https://keyauth.cc`): Soporte Seller API para evitar Cloudflare WAF.
- **Control de Permisos por Rol o Usuario:** Los dueños pueden definir qué usuarios o roles acceden a qué plataformas.
- **Canal de Auditoría (Logs):** Registro privado de cada clave creada, eliminada o reseteada con identificación de rango (Admin vs Revendedor) y días restantes de membresía.
- **🌐 Dashboard Web Multi-Servidor (Multi-Tenant):** Panel de control web completo para gestionar revendedores, stock, historial de licencias, reset de HWID y configuración de canales y credenciales independientes por servidor sin interferencias.
- **Preparado para Sparked Host / VPS / Docker:** Consume menos de 80MB de RAM.

---

## 🌐 Dashboard Web Multi-Servidor

El bot incluye un servidor web integrado que arranca automáticamente en el puerto especificado en `PORT` (por defecto `3000`):

1. **Acceso Web:** Entra a `http://tu-ip:3000` (o a tu dominio).
2. **Métodos de Inicio de Sesión:**
   - **Discord OAuth2:** Haz clic en *Continuar con Discord* e ingresa con tu cuenta. El sistema detectará automáticamente los servidores donde eres Dueño o Administrador.
   - **Contraseña Maestra:** Si aún no configuraste `DISCORD_CLIENT_SECRET`, puedes ingresar de inmediato con la contraseña maestra configurada en `DASHBOARD_ADMIN_PASSWORD` (por defecto: `admin2026`).
3. **Aislamiento Multi-Tenant por Servidor:**
   - Cada servidor de Discord cuenta con su propia base de datos (`data/guilds/<ID_SERVIDOR>.json`).
   - Los revendedores, stock y licencias generadas en el Servidor A nunca interfieren ni son visibles en el Servidor B.
   - Cada servidor puede configurar sus propias credenciales de KeyAuth, Bypass APK y WorldCheats desde la pestaña *Configuración*.

---

## 🛠️ Ejecución Local

1. Entra a la carpeta del bot:
   ```bash
   cd discord-key-bot
   ```
2. Instala dependencias:
   ```bash
   npm install
   ```
3. Inicia el bot:
   ```bash
   npm start
   ```

---

## 🌐 Migración a Sparked Host (Advanced Bot Hosting)

1. En tu panel de Sparked Host (Pterodactyl), asegúrate de que el entorno sea **Node.js** (versión 18, 20 o 22).
2. Comprime todos los archivos de esta carpeta `discord-key-bot` en un archivo `.zip` (excluyendo la carpeta `node_modules`).
3. Ve a **File Manager** en Sparked Host y sube el archivo `.zip`.
4. Descomprime el `.zip`.
5. Asegúrate de que el archivo `.env` contenga tus tokens y contraseñas.
6. En la pestaña **Console**, presiona el botón **Start** (Sparked Host ejecuta automáticamente `npm install` y arranca `node src/index.js`).

---

## 📋 Comandos Slash Disponibles (Solo Administradores)
- `/panel`: Publica o reenvía el panel de control con los botones.
- `/permisos asignar destino:@usuario_o_rol plataformas:bypass,mycheats max_dias:30`: Asigna acceso a plataformas específicas.
- `/permisos revocar destino:@usuario_o_rol`: Quita todos los accesos.
- `/permisos listar`: Muestra la lista de accesos asignados.
- `/stats`: Muestra el estado de conexión con cada plataforma.
