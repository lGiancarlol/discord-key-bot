const config = require('../../config');

function renderServersPage(user, serversList) {
  const clientId = config.web.clientId;
  const inviteBase = `https://discord.com/api/oauth2/authorize?client_id=${clientId}&permissions=8&scope=bot%20applications.commands`;

  return `<!DOCTYPE html>
<html lang="es" class="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Selección de Servidor • Auth Gateway</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
</head>
<body class="bg-slate-950 text-slate-100 min-h-screen selection:bg-blue-600 selection:text-white">

  <!-- Barra de Navegación Superior -->
  <header class="border-b border-slate-800 bg-slate-900/60 backdrop-blur-md sticky top-0 z-50">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 bg-gradient-to-tr from-blue-600 to-indigo-500 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
          <i class="fa-solid fa-shield-halved text-white text-lg"></i>
        </div>
        <div>
          <span class="font-bold text-base tracking-tight text-white">Auth Cloud Gateway</span>
          <span class="hidden sm:inline-block ml-2 px-2 py-0.5 text-[10px] font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-full">Multi-Tenant v2.4</span>
        </div>
      </div>

      <!-- Perfil de Usuario -->
      <div class="flex items-center gap-4">
        <div class="flex items-center gap-3 bg-slate-800/80 border border-slate-700/60 rounded-xl px-3 py-1.5">
          <img src="${user.avatarUrl}" class="w-7 h-7 rounded-full object-cover border border-slate-600" alt="Avatar">
          <span class="text-sm font-medium text-slate-200 hidden sm:inline">${user.global_name || user.username}</span>
        </div>
        <a href="/logout" title="Cerrar Sesión" class="text-slate-400 hover:text-red-400 p-2 rounded-lg hover:bg-slate-800 transition">
          <i class="fa-solid fa-arrow-right-from-bracket"></i>
        </a>
      </div>
    </div>
  </header>

  <!-- Contenedor Principal -->
  <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
    <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
      <div>
        <h1 class="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">Tus Servidores</h1>
        <p class="text-slate-400 text-sm mt-1">Selecciona el servidor que deseas gestionar. Cada servidor opera con su propia base de datos, credenciales y stock independiente.</p>
      </div>

      <!-- Buscador -->
      <div class="w-full md:w-72 relative">
        <span class="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
          <i class="fa-solid fa-magnifying-glass text-xs"></i>
        </span>
        <input type="text" id="searchServers" placeholder="Buscar servidor..." onkeyup="filterServers()" class="w-full pl-9 pr-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500">
      </div>
    </div>

    <!-- Grid de Servidores -->
    <div id="serversGrid" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      ${serversList.map((srv) => {
        const isBotInGuild = srv.botPresent;
        return `
        <div class="server-card bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl p-6 transition duration-200 flex flex-col justify-between shadow-xl shadow-black/20" data-name="${srv.name.toLowerCase()}">
          <div>
            <div class="flex items-start justify-between gap-4 mb-4">
              <div class="flex items-center gap-3.5">
                ${srv.iconUrl ? `
                  <img src="${srv.iconUrl}" class="w-14 h-14 rounded-2xl object-cover border border-slate-700 shadow" alt="Icono">
                ` : `
                  <div class="w-14 h-14 bg-gradient-to-br from-slate-800 to-slate-700 rounded-2xl flex items-center justify-center font-bold text-lg text-slate-300 border border-slate-700 shadow">
                    ${srv.name.substring(0, 2).toUpperCase()}
                  </div>
                `}
                <div>
                  <h3 class="font-bold text-white text-base leading-tight">${srv.name}</h3>
                  <span class="text-xs text-slate-500 font-mono">ID: ${srv.id}</span>
                </div>
              </div>

              ${isBotInGuild ? `
                <span class="px-2.5 py-1 text-xs font-semibold rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1.5">
                  <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  Online
                </span>
              ` : `
                <span class="px-2.5 py-1 text-xs font-semibold rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  Sin Bot
                </span>
              `}
            </div>

            <div class="grid grid-cols-2 gap-2 text-xs py-3 border-y border-slate-800/80 mb-5">
              <div>
                <span class="text-slate-500 block">Revendedores:</span>
                <span class="font-bold text-slate-200">${srv.resellersCount || 0} registrados</span>
              </div>
              <div>
                <span class="text-slate-500 block">Licencias Totales:</span>
                <span class="font-bold text-slate-200">${srv.keysCount || 0} emitidas</span>
              </div>
            </div>
          </div>

          <div>
            ${isBotInGuild ? `
              <a href="/dashboard/${srv.id}" class="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-medium text-sm rounded-xl transition duration-150 shadow-lg shadow-blue-600/20">
                <i class="fa-solid fa-sliders text-xs"></i>
                <span>Administrar Servidor</span>
              </a>
            ` : `
              <a href="${inviteBase}&guild_id=${srv.id}" target="_blank" class="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-sm rounded-xl transition duration-150 border border-slate-700/80">
                <i class="fa-brands fa-discord text-sm text-[#5865F2]"></i>
                <span>Invitar Bot al Servidor</span>
              </a>
            `}
          </div>
        </div>
        `;
      }).join('')}
    </div>

    <!-- Si no hay servidores -->
    <div id="noServers" class="hidden text-center py-16">
      <div class="w-16 h-16 bg-slate-800/80 rounded-2xl flex items-center justify-center mx-auto mb-4 text-slate-500 text-2xl">
        <i class="fa-solid fa-server"></i>
      </div>
      <h3 class="text-lg font-bold text-slate-300">No se encontraron servidores</h3>
      <p class="text-slate-500 text-sm mt-1">Asegúrate de ser Administrador en los servidores de Discord que deseas gestionar.</p>
    </div>
  </main>

  <script>
    function filterServers() {
      const q = document.getElementById('searchServers').value.toLowerCase().trim();
      const cards = document.querySelectorAll('.server-card');
      let visible = 0;
      cards.forEach(card => {
        const name = card.getAttribute('data-name');
        if (name.includes(q)) {
          card.style.display = '';
          visible++;
        } else {
          card.style.display = 'none';
        }
      });
      document.getElementById('noServers').classList.toggle('hidden', visible > 0);
    }
  </script>
</body>
</html>`;
}

module.exports = { renderServersPage };
