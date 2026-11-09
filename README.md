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
- **Canal de Auditoría (Logs):** Registro privado de cada clave creada, eliminada o reseteada.
- **Preparado para Sparked Host / VPS / Docker:** Consume menos de 80MB de RAM.

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
