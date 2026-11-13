const config = require('../../config');

function renderDashboardPage(user, guild, guildData, providersConfig, availableGuilds = []) {
  const gId = guild.id;
  const gName = guild.name;
  const gIcon = guild.iconURL ? guild.iconURL() : null;
  const clientId = config.web.clientId;
  const inviteUrl = `https://discord.com/api/oauth2/authorize?client_id=${clientId}&permissions=8&scope=bot%20applications.commands`;

  return `<!DOCTYPE html>
<html lang="es" class="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${gName} • Auth Cloud Gateway</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      darkMode: 'class',
      theme: {
        extend: {
          colors: {
            brand: {
              50: '#eff6ff',
              500: '#3b82f6',
              600: '#2563eb',
              700: '#1d4ed8',
              900: '#1e3a8a',
            }
          }
        }
      }
    }
  </script>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
  <style>
    /* Custom scrollbars */
    ::-webkit-scrollbar { width: 6px; height: 6px; }
    ::-webkit-scrollbar-track { background: #0f172a; }
    ::-webkit-scrollbar-thumb { background: #334155; border-radius: 9999px; }
    ::-webkit-scrollbar-thumb:hover { background: #475569; }
  </style>
</head>
<body class="bg-slate-950 text-slate-100 min-h-screen flex flex-col selection:bg-brand-500 selection:text-white">

  <!-- Navegación Superior -->
  <header class="border-b border-slate-800 bg-slate-900/80 backdrop-blur-md sticky top-0 z-40">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
      
      <!-- Izquierda: Info de Servidor Actual -->
      <div class="flex items-center gap-3">
        <a href="/servers" title="Volver a lista de servidores" class="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-slate-800 transition mr-1">
          <i class="fa-solid fa-arrow-left"></i>
        </a>

        ${gIcon ? `
          <img src="${gIcon}" class="w-9 h-9 rounded-xl object-cover border border-slate-700 shadow" alt="Icon">
        ` : `
          <div class="w-9 h-9 bg-brand-600 rounded-xl flex items-center justify-center font-bold text-sm text-white shadow">
            ${gName.substring(0, 2).toUpperCase()}
          </div>
        `}

        <div>
          <div class="flex items-center gap-2">
            <h1 class="font-bold text-white text-sm sm:text-base leading-tight">${gName}</h1>
            <span class="px-2 py-0.5 text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full">Activo</span>
          </div>
          <p class="text-[11px] text-slate-500 font-mono">ID: ${gId}</p>
        </div>
      </div>

      <!-- Derecha: Selector de Servidores y Perfil -->
      <div class="flex items-center gap-3">
        <a href="${inviteUrl}" target="_blank" title="Invitar el bot a otro servidor de Discord" class="hidden sm:flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl transition shadow-lg shadow-indigo-600/20">
          <i class="fa-brands fa-discord text-sm"></i>
          <span>➕ Invitar Bot</span>
        </a>

        <a href="/servers" class="hidden sm:flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/60 rounded-xl transition">
          <i class="fa-solid fa-server text-brand-400"></i>
          <span>Cambiar Servidor</span>
        </a>

        <div class="flex items-center gap-2.5 bg-slate-800/60 border border-slate-700/50 rounded-xl px-2.5 py-1">
          <img src="${user.avatarUrl}" class="w-6 h-6 rounded-full border border-slate-600" alt="Avatar">
          <span class="text-xs font-medium text-slate-200 hidden md:inline">${user.global_name || user.username}</span>
        </div>

        <a href="/logout" title="Cerrar Sesión" class="text-slate-400 hover:text-red-400 p-2 rounded-lg hover:bg-slate-800 transition">
          <i class="fa-solid fa-arrow-right-from-bracket text-sm"></i>
        </a>
      </div>
    </div>
  </header>

  <!-- Pestañas de Navegación -->
  <nav class="border-b border-slate-800/80 bg-slate-900/40">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex overflow-x-auto gap-2 py-2">
      <button onclick="switchTab('overview')" id="tab-btn-overview" class="tab-btn active px-4 py-2 rounded-xl text-xs sm:text-sm font-medium flex items-center gap-2 transition whitespace-nowrap bg-brand-600 text-white shadow-sm">
        <i class="fa-solid fa-chart-pie"></i> Resumen
      </button>
      <button onclick="switchTab('resellers')" id="tab-btn-resellers" class="tab-btn px-4 py-2 rounded-xl text-xs sm:text-sm font-medium flex items-center gap-2 transition whitespace-nowrap text-slate-400 hover:text-slate-200 hover:bg-slate-800/50">
        <i class="fa-solid fa-users"></i> Revendedores
      </button>
      <button onclick="switchTab('stock')" id="tab-btn-stock" class="tab-btn px-4 py-2 rounded-xl text-xs sm:text-sm font-medium flex items-center gap-2 transition whitespace-nowrap text-slate-400 hover:text-slate-200 hover:bg-slate-800/50">
        <i class="fa-solid fa-boxes-stacked"></i> Stock & Inventario
      </button>
      <button onclick="switchTab('keys')" id="tab-btn-keys" class="tab-btn px-4 py-2 rounded-xl text-xs sm:text-sm font-medium flex items-center gap-2 transition whitespace-nowrap text-slate-400 hover:text-slate-200 hover:bg-slate-800/50">
        <i class="fa-solid fa-key"></i> Historial & HWID
      </button>
      <button onclick="switchTab('generator')" id="tab-btn-generator" class="tab-btn px-4 py-2 rounded-xl text-xs sm:text-sm font-medium flex items-center gap-2 transition whitespace-nowrap text-slate-400 hover:text-slate-200 hover:bg-slate-800/50">
        <i class="fa-solid fa-bolt"></i> Emisión Rápida
      </button>
      <button onclick="switchTab('admins')" id="tab-btn-admins" class="tab-btn px-4 py-2 rounded-xl text-xs sm:text-sm font-medium flex items-center gap-2 transition whitespace-nowrap text-slate-400 hover:text-slate-200 hover:bg-slate-800/50">
        <i class="fa-solid fa-user-shield"></i> Administradores
      </button>
      <button onclick="switchTab('settings')" id="tab-btn-settings" class="tab-btn px-4 py-2 rounded-xl text-xs sm:text-sm font-medium flex items-center gap-2 transition whitespace-nowrap text-slate-400 hover:text-slate-200 hover:bg-slate-800/50">
        <i class="fa-solid fa-gears"></i> Configuración
      </button>
    </div>
  </nav>

  <!-- Contenedor de Contenido Principal -->
  <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full">

    <!-- ── TAB 1: RESUMEN (OVERVIEW) ── -->
    <div id="tab-overview" class="tab-content space-y-8">
      <!-- Tarjetas de Métricas -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div class="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg relative overflow-hidden">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-xs font-medium text-slate-400 uppercase tracking-wider">Revendedores</p>
              <h3 id="stat-resellers-count" class="text-2xl font-bold text-white mt-1">...</h3>
            </div>
            <div class="w-12 h-12 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-2xl flex items-center justify-center text-xl">
              <i class="fa-solid fa-users"></i>
            </div>
          </div>
          <p class="text-xs text-slate-500 mt-3 flex items-center gap-1.5">
            <span class="w-2 h-2 rounded-full bg-blue-500"></span> Con membresía en este servidor
          </p>
        </div>

        <div class="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg relative overflow-hidden">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-xs font-medium text-slate-400 uppercase tracking-wider">Stock KeyAuth</p>
              <h3 id="stat-keyauth-stock" class="text-2xl font-bold text-white mt-1">...</h3>
            </div>
            <div class="w-12 h-12 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-2xl flex items-center justify-center text-xl">
              <i class="fa-solid fa-box-open"></i>
            </div>
          </div>
          <p class="text-xs text-slate-500 mt-3 flex items-center gap-1.5">
            <span class="w-2 h-2 rounded-full bg-amber-500"></span> Claves listas para entrega
          </p>
        </div>

        <div class="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg relative overflow-hidden">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-xs font-medium text-slate-400 uppercase tracking-wider">Licencias Emitidas</p>
              <h3 id="stat-keys-count" class="text-2xl font-bold text-white mt-1">...</h3>
            </div>
            <div class="w-12 h-12 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-2xl flex items-center justify-center text-xl">
              <i class="fa-solid fa-key"></i>
            </div>
          </div>
          <p class="text-xs text-slate-500 mt-3 flex items-center gap-1.5">
            <span class="w-2 h-2 rounded-full bg-emerald-500"></span> Total histórico en servidor
          </p>
        </div>

        <div class="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg relative overflow-hidden">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-xs font-medium text-slate-400 uppercase tracking-wider">Bot en Servidor</p>
              <h3 class="text-2xl font-bold text-emerald-400 mt-1">Conectado</h3>
            </div>
            <div class="w-12 h-12 bg-purple-500/10 border border-purple-500/20 text-purple-400 rounded-2xl flex items-center justify-center text-xl">
              <i class="fa-brands fa-discord"></i>
            </div>
          </div>
          <p class="text-xs text-slate-500 mt-3 flex items-center gap-1.5">
            <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span> Slash commands activos
          </p>
        </div>
      </div>

      <!-- Acciones Rápidas -->
      <div class="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <h2 class="text-base font-bold text-white mb-4 flex items-center gap-2">
          <i class="fa-solid fa-bolt text-brand-400"></i> Acciones Directas
        </h2>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <button onclick="switchTab('resellers'); openAddResellerModal();" class="p-4 bg-slate-950/60 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 rounded-xl flex items-center gap-3 transition group text-left">
            <div class="w-10 h-10 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center group-hover:scale-110 transition">
              <i class="fa-solid fa-user-plus"></i>
            </div>
            <div>
              <span class="block text-sm font-semibold text-white">Nuevo Revendedor</span>
              <span class="text-xs text-slate-400">Asignar tiempo y accesos</span>
            </div>
          </button>

          <button onclick="switchTab('stock')" class="p-4 bg-slate-950/60 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 rounded-xl flex items-center gap-3 transition group text-left">
            <div class="w-10 h-10 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center group-hover:scale-110 transition">
              <i class="fa-solid fa-box-archive"></i>
            </div>
            <div>
              <span class="block text-sm font-semibold text-white">Cargar Stock</span>
              <span class="text-xs text-slate-400">Pegar lote de claves</span>
            </div>
          </button>

          <button onclick="switchTab('generator')" class="p-4 bg-slate-950/60 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 rounded-xl flex items-center gap-3 transition group text-left">
            <div class="w-10 h-10 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center group-hover:scale-110 transition">
              <i class="fa-solid fa-plus-circle"></i>
            </div>
            <div>
              <span class="block text-sm font-semibold text-white">Generar Licencia</span>
              <span class="text-xs text-slate-400">Crear key o cuenta VIP</span>
            </div>
          </button>

          <button onclick="publishDiscordPanels()" class="p-4 bg-slate-950/60 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 rounded-xl flex items-center gap-3 transition group text-left">
            <div class="w-10 h-10 rounded-lg bg-purple-500/10 text-purple-400 flex items-center justify-center group-hover:scale-110 transition">
              <i class="fa-solid fa-paper-plane"></i>
            </div>
            <div>
              <span class="block text-sm font-semibold text-white">Publicar Paneles</span>
              <span class="text-xs text-slate-400">Enviar a Discord</span>
            </div>
          </button>
        </div>

        <!-- Estado en Vivo de Plataformas Web -->
        <div class="mt-8 pt-6 border-t border-slate-800">
          <div class="flex items-center justify-between mb-4">
            <div>
              <h3 class="text-sm font-bold text-white flex items-center gap-2">
                <i class="fa-solid fa-server text-brand-400"></i> Estado de Plataformas Web & APIs
              </h3>
              <p class="text-xs text-slate-400 mt-0.5">Monitoreo en tiempo real de conectividad y respuesta de cada panel.</p>
            </div>
            <button onclick="loadHealth()" class="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg transition flex items-center gap-1.5">
              <i class="fa-solid fa-arrows-rotate text-[11px]"></i> <span>Comprobar</span>
            </button>
          </div>
          <div id="health-cards-grid" class="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div class="col-span-3 bg-slate-950/60 border border-slate-800 rounded-xl p-4 text-center text-xs text-slate-500">
              <i class="fa-solid fa-spinner fa-spin mr-1.5"></i> Comprobando conectividad de plataformas...
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ── TAB 2: REVENDEDORES ── -->
    <div id="tab-resellers" class="tab-content hidden space-y-6">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 class="text-xl font-bold text-white">Revendedores Autorizados</h2>
          <p class="text-xs text-slate-400 mt-0.5">Control de suscripciones, días de vigencia y plataformas permitidas en este servidor.</p>
        </div>
        <button onclick="openAddResellerModal()" class="flex items-center justify-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white text-sm font-medium rounded-xl transition shadow-lg shadow-brand-600/20">
          <i class="fa-solid fa-user-plus text-xs"></i>
          <span>Asignar Revendedor</span>
        </button>
      </div>

      <!-- Tabla de Revendedores -->
      <div class="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div class="overflow-x-auto">
          <table class="w-full text-left text-sm">
            <thead class="bg-slate-950/70 border-b border-slate-800 text-slate-400 text-xs uppercase tracking-wider">
              <tr>
                <th class="py-3.5 px-4">Usuario</th>
                <th class="py-3.5 px-4">Estado & Vencimiento</th>
                <th class="py-3.5 px-4">Cuota Diaria</th>
                <th class="py-3.5 px-4">Plataformas Asignadas</th>
                <th class="py-3.5 px-4">Asignado Por</th>
                <th class="py-3.5 px-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody id="resellers-table-body" class="divide-y divide-slate-800/60">
              <tr>
                <td colspan="6" class="py-8 text-center text-slate-500">Cargando revendedores...</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- ── TAB 3: STOCK & INVENTARIO ── -->
    <div id="tab-stock" class="tab-content hidden space-y-8">
      <div>
        <h2 class="text-xl font-bold text-white">Inventario de Stock (KeyAuth Elite Pro)</h2>
        <p class="text-xs text-slate-400 mt-0.5">Control de claves precargadas para KeyAuth. Las demás plataformas (Bypass APK, Bypass UID y WorldCheats) funcionan con generación automática directa vía API y no requieren stock manual.</p>
      </div>

      <!-- Grid de Stock por Plataforma -->
      <div id="stock-cards-grid" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <!-- Renderizado dinámicamente -->
      </div>

      <!-- Formulario para Cargar Lote de Claves -->
      <div class="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl max-w-2xl">
        <h3 class="text-base font-bold text-white mb-2 flex items-center gap-2">
          <i class="fa-solid fa-boxes-stacked text-amber-400"></i> Cargar Lote de Claves al Stock
        </h3>
        <p class="text-xs text-slate-400 mb-5">Pega una lista de claves para KeyAuth (una por línea o separadas por coma). El sistema filtrará duplicados automáticamente.</p>

        <form id="formAddStock" onsubmit="submitAddStock(event)" class="space-y-4">
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wider">Plataforma</label>
              <select id="stock_provider" required class="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-brand-500">
                <option value="keyauth" selected>KeyAuth (Elite Pro) — Stock Manual</option>
              </select>
              <span class="text-[11px] text-slate-500 mt-1 block">Bypass y WorldCheats generan claves vía API (no requieren stock).</span>
            </div>
            <div>
              <label class="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wider">Duración por Clave (Días)</label>
              <input type="number" id="stock_days" value="30" min="1" max="365" required class="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-brand-500">
            </div>
          </div>

          <div>
            <label class="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wider">Lista de Claves (Una por línea)</label>
            <textarea id="stock_keys" rows="6" required placeholder="VIP-KEY-1\nVIP-KEY-2\nVIP-KEY-3..." class="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-sm font-mono text-slate-200 placeholder-slate-600 focus:outline-none focus:border-brand-500"></textarea>
          </div>

          <button type="submit" class="flex items-center justify-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-sm rounded-xl transition shadow-lg shadow-emerald-600/20">
            <i class="fa-solid fa-upload text-xs"></i>
            <span>Cargar al Inventario</span>
          </button>
        </form>
      </div>
    </div>

    <!-- ── TAB 4: HISTORIAL DE LICENCIAS & RESET HWID ── -->
    <div id="tab-keys" class="tab-content hidden space-y-6">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 class="text-xl font-bold text-white">Historial de Licencias & Restablecimiento</h2>
          <p class="text-xs text-slate-400 mt-0.5">Auditoría completa de todas las claves generadas en este servidor con reset de HWID instantáneo.</p>
        </div>

        <!-- Filtros y Exportación de Claves -->
        <div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
          <div class="relative w-full sm:w-64">
            <span class="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
              <i class="fa-solid fa-magnifying-glass text-xs"></i>
            </span>
            <input type="text" id="searchKeysInput" placeholder="Buscar clave, cliente o ID..." onkeyup="filterKeysTable()" class="w-full pl-9 pr-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-brand-500">
          </div>
          <select id="filterKeysPlatform" onchange="filterKeysTable()" class="px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-brand-500">
            <option value="">Todas las plataformas</option>
            <option value="keyauth">KeyAuth (Elite Pro)</option>
            <option value="bypass">Bypass APK</option>
            <option value="bypass_uid">Bypass UID</option>
            <option value="mycheats">WorldCheats</option>
          </select>
          <button onclick="exportKeysToCSV()" class="flex items-center justify-center gap-2 px-3.5 py-2 bg-emerald-700/30 hover:bg-emerald-600/40 text-emerald-300 border border-emerald-500/30 rounded-xl text-sm font-medium transition whitespace-nowrap shadow-sm">
            <i class="fa-solid fa-file-excel text-xs"></i>
            <span>Exportar Excel</span>
          </button>
        </div>
      </div>

      <!-- Tabla de Claves -->
      <div class="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div class="overflow-x-auto">
          <table class="w-full text-left text-sm" id="keys-table">
            <thead class="bg-slate-950/70 border-b border-slate-800 text-slate-400 text-xs uppercase tracking-wider">
              <tr>
                <th class="py-3.5 px-4">Fecha</th>
                <th class="py-3.5 px-4">Revendedor</th>
                <th class="py-3.5 px-4">Plataforma</th>
                <th class="py-3.5 px-4">Clave / Cuenta</th>
                <th class="py-3.5 px-4">Duración</th>
                <th class="py-3.5 px-4">Nota / Cliente</th>
                <th class="py-3.5 px-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody id="keys-table-body" class="divide-y divide-slate-800/60 font-mono text-xs">
              <tr>
                <td colspan="7" class="py-8 text-center text-slate-500 font-sans text-sm">Cargando licencias...</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- ── TAB 5: EMISIÓN RÁPIDA (FAST GENERATOR) ── -->
    <div id="tab-generator" class="tab-content hidden space-y-6">
      <div>
        <h2 class="text-xl font-bold text-white">Emisión Directa de Licencias</h2>
        <p class="text-xs text-slate-400 mt-0.5">Genera licencias directamente desde esta web con plantilla lista para copiar y enviar a WhatsApp.</p>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <!-- Formulario -->
        <div class="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
          <form id="formFastGen" onsubmit="submitFastGen(event)" class="space-y-4">
            <div>
              <label class="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wider">Plataforma Web</label>
              <select id="gen_provider" onchange="handleGenProviderChange()" required class="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-brand-500">
                <option value="keyauth">KeyAuth (Elite Pro)</option>
                <option value="bypass">Bypass APK</option>
                <option value="bypass_uid">Bypass UID (Auto ON)</option>
                <option value="mycheats">WorldCheats (Panel VIP)</option>
              </select>
            </div>

            <div class="grid grid-cols-2 gap-4">
              <div id="gen_days_container">
                <label class="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wider">Duración (Días)</label>
                <input type="number" id="gen_days" value="30" min="1" max="90" required class="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-brand-500">
              </div>

              <div>
                <label class="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wider">Cantidad (1 a 5)</label>
                <input type="number" id="gen_count" value="1" min="1" max="5" required class="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-brand-500">
              </div>
            </div>

            <div id="gen_prefix_container">
              <label class="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wider">Prefijo (Opcional)</label>
              <input type="text" id="gen_prefix" placeholder="VIP" class="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-brand-500">
            </div>

            <div>
              <label class="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wider">Nota / Nombre de Cliente</label>
              <input type="text" id="gen_note" placeholder="Cliente WhatsApp Juan Perez" class="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-brand-500">
            </div>

            <button type="submit" id="btn-submit-gen" class="w-full flex items-center justify-center gap-2 px-5 py-3 bg-brand-600 hover:bg-brand-500 text-white font-medium text-sm rounded-xl transition shadow-lg shadow-brand-600/20">
              <i class="fa-solid fa-wand-magic-sparkles text-xs"></i>
              <span>Generar Licencia Ahora</span>
            </button>
          </form>
        </div>

        <!-- Salida Formato WhatsApp -->
        <div class="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col justify-between">
          <div>
            <h3 class="text-sm font-bold text-white mb-1 flex items-center gap-2">
              <i class="fa-brands fa-whatsapp text-emerald-400"></i> Formato de Envío para WhatsApp
            </h3>
            <p class="text-xs text-slate-400 mb-4">Copia este mensaje directamente para enviarlo al comprador.</p>

            <textarea id="gen_output" readonly rows="8" placeholder="La licencia generada aparecerá aquí lista para copiar..." class="w-full p-4 bg-slate-950 border border-slate-800 rounded-xl text-sm font-mono text-emerald-400 placeholder-slate-600 focus:outline-none resize-none"></textarea>
          </div>

          <button onclick="copyGenOutput()" class="mt-4 w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-sm rounded-xl transition border border-slate-700">
            <i class="fa-regular fa-copy"></i>
            <span>Copiar al Portapapeles</span>
          </button>
        </div>
      </div>
    </div>

    <!-- ── TAB 6: CONFIGURACIÓN DEL SERVIDOR ── -->
    <div id="tab-settings" class="tab-content hidden space-y-8">
      <div>
        <h2 class="text-xl font-bold text-white">Configuración del Servidor</h2>
        <p class="text-xs text-slate-400 mt-0.5">Asigna los canales de Discord de este servidor, personaliza las credenciales, marca y clona configuraciones.</p>
      </div>

      <!-- BANNER DE ASISTENTE RÁPIDO AUTO-SETUP -->
      <div class="bg-gradient-to-r from-blue-950/80 via-indigo-950/70 to-slate-900 border border-blue-500/30 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div class="absolute -right-6 -bottom-6 text-blue-500/10 text-9xl pointer-events-none">
          <i class="fa-solid fa-wand-magic-sparkles"></i>
        </div>
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div class="max-w-2xl space-y-1.5">
            <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-blue-500/20 text-blue-300 border border-blue-500/30">
              <i class="fa-solid fa-bolt"></i> Auto-Setup en 1 Clic
            </span>
            <h3 class="text-lg font-bold text-white">Asistente de Configuración Automática</h3>
            <p class="text-xs text-slate-300 leading-relaxed">
              ¿Acabas de meter el bot al servidor? Pulsa este botón y el bot creará automáticamente la categoría 
              <span class="text-blue-400 font-mono font-semibold">🔐 PANEL AUTH GATEWAY</span>, los canales 
              <span class="text-blue-400 font-mono">#🔑-licencias</span>, 
              <span class="text-blue-400 font-mono">#🛠️-admin-control</span>, 
              <span class="text-blue-400 font-mono">#📜-auditoria-logs</span>, el canal de voz 
              <span class="text-blue-400 font-mono">🔊-conexion-24-7</span>, configurará los permisos y publicará los paneles automáticamente.
            </p>
          </div>
          <div class="flex items-center">
            <button onclick="runAutoSetupChannels()" id="btnAutoSetup" class="w-full sm:w-auto px-5 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-sm rounded-xl transition shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2 whitespace-nowrap">
              <i class="fa-solid fa-wand-magic-sparkles"></i>
              <span>Auto-Crear Canales Ahora</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Fila 0: Páginas Web / Plataformas Habilitadas en este Servidor -->
      <div class="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
          <div>
            <h3 class="text-base font-bold text-white flex items-center gap-2">
              <i class="fa-solid fa-globe text-cyan-400"></i> Páginas Web Habilitadas en este Servidor
            </h3>
            <p class="text-xs text-slate-400 mt-0.5">Elige qué páginas funcionarán en este servidor. Las páginas desactivadas no aparecerán en el panel de Discord ni en los menús de revendedores de este servidor.</p>
          </div>
          <button onclick="publishDiscordPanel('panel')" type="button" class="text-xs text-slate-300 hover:text-white px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700 transition flex items-center gap-1.5 w-fit">
            <i class="fa-solid fa-arrows-rotate"></i> Actualizar Panel Discord
          </button>
        </div>

        <form id="formEnabledPlatforms" onsubmit="saveEnabledPlatforms(event)" class="space-y-4">
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            
            <!-- Bypass APK -->
            <label class="flex items-start gap-3 p-4 bg-slate-950/70 border border-slate-800 hover:border-slate-700 rounded-xl cursor-pointer transition group">
              <input type="checkbox" id="plat_check_bypass" name="enabled_platforms" value="bypass" class="mt-1 rounded bg-slate-800 border-slate-700 text-brand-600 focus:ring-0">
              <div>
                <span class="block text-sm font-bold text-white group-hover:text-brand-400 transition flex items-center gap-1.5">
                  ⚡ Bypass APK
                </span>
                <span class="text-[11px] text-slate-400 block mt-0.5">Emisión de licencias para APK Bypass</span>
              </div>
            </label>

            <!-- Bypass UID -->
            <label class="flex items-start gap-3 p-4 bg-slate-950/70 border border-slate-800 hover:border-slate-700 rounded-xl cursor-pointer transition group">
              <input type="checkbox" id="plat_check_bypass_uid" name="enabled_platforms" value="bypass_uid" class="mt-1 rounded bg-slate-800 border-slate-700 text-brand-600 focus:ring-0">
              <div>
                <span class="block text-sm font-bold text-white group-hover:text-brand-400 transition flex items-center gap-1.5">
                  🛡️ Bypass UID (Auto ON)
                </span>
                <span class="text-[11px] text-slate-400 block mt-0.5">Licencias con UID activado automáticamente</span>
              </div>
            </label>

            <!-- WorldCheats -->
            <label class="flex items-start gap-3 p-4 bg-slate-950/70 border border-slate-800 hover:border-slate-700 rounded-xl cursor-pointer transition group">
              <input type="checkbox" id="plat_check_mycheats" name="enabled_platforms" value="mycheats" class="mt-1 rounded bg-slate-800 border-slate-700 text-brand-600 focus:ring-0">
              <div>
                <span class="block text-sm font-bold text-white group-hover:text-brand-400 transition flex items-center gap-1.5">
                  👤 WorldCheats (Panel VIP)
                </span>
                <span class="text-[11px] text-slate-400 block mt-0.5">Cuentas VIP con usuario y contraseña</span>
              </div>
            </label>

            <!-- KeyAuth -->
            <label class="flex items-start gap-3 p-4 bg-slate-950/70 border border-slate-800 hover:border-slate-700 rounded-xl cursor-pointer transition group">
              <input type="checkbox" id="plat_check_keyauth" name="enabled_platforms" value="keyauth" class="mt-1 rounded bg-slate-800 border-slate-700 text-brand-600 focus:ring-0">
              <div>
                <span class="block text-sm font-bold text-white group-hover:text-brand-400 transition flex items-center gap-1.5">
                  🔑 KeyAuth (Elite Pro)
                </span>
                <span class="text-[11px] text-slate-400 block mt-0.5">Licencias oficiales KeyAuth con inventario</span>
              </div>
            </label>

          </div>

          <div class="flex items-center justify-between pt-2">
            <span class="text-xs text-slate-500 italic">* Debes dejar al menos una página activada.</span>
            <button type="submit" id="btnSavePlatforms" class="px-5 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white font-medium text-sm rounded-xl transition shadow-lg shadow-cyan-600/20 flex items-center gap-2">
              <i class="fa-solid fa-floppy-disk text-xs"></i>
              <span>Guardar Páginas de este Servidor</span>
            </button>
          </div>
        </form>
      </div>

      <!-- Fila 1: Canales de Discord y Credenciales Exclusivas -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <!-- Canales de Discord -->
        <div class="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
          <div class="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 class="text-base font-bold text-white flex items-center gap-2">
              <i class="fa-brands fa-discord text-[#5865F2]"></i> Canales y Notificaciones
            </h3>
            <button onclick="loadDiscordChannels()" type="button" title="Refrescar lista de canales desde Discord" class="text-xs text-slate-400 hover:text-white flex items-center gap-1">
              <i class="fa-solid fa-arrows-rotate"></i> Refrescar
            </button>
          </div>

          <form id="formChannels" onsubmit="saveChannels(event)" class="space-y-4">
            <div>
              <label class="block text-xs font-medium text-slate-400 mb-1">Canal Panel de Licencias (Revendedores)</label>
              <select id="cfg_sel_panelChannelId" onchange="syncChannelInput('panelChannelId', this.value)" class="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-brand-500 mb-1">
                <option value="">-- Cargando canales de Discord... --</option>
              </select>
              <input type="text" id="cfg_panelChannelId" placeholder="ID numérico (ej: 1569409213812187217)" class="w-full px-3 py-1.5 bg-slate-950/60 border border-slate-800 rounded-lg text-xs font-mono text-slate-400 focus:outline-none focus:border-brand-500">
            </div>

            <div>
              <label class="block text-xs font-medium text-slate-400 mb-1">Canal Panel de Control (Administradores con Botones)</label>
              <select id="cfg_sel_adminPanelChannelId" onchange="syncChannelInput('adminPanelChannelId', this.value)" class="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-brand-500 mb-1">
                <option value="">-- Cargando canales de Discord... --</option>
              </select>
              <input type="text" id="cfg_adminPanelChannelId" placeholder="ID numérico (ej: 1569766838533886032)" class="w-full px-3 py-1.5 bg-slate-950/60 border border-slate-800 rounded-lg text-xs font-mono text-slate-400 focus:outline-none focus:border-brand-500">
            </div>

            <div>
              <label class="block text-xs font-medium text-slate-400 mb-1">Canal de Auditoría y Logs</label>
              <select id="cfg_sel_logsChannelId" onchange="syncChannelInput('logsChannelId', this.value)" class="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-brand-500 mb-1">
                <option value="">-- Cargando canales de Discord... --</option>
              </select>
              <input type="text" id="cfg_logsChannelId" placeholder="ID numérico (ej: 1569409620563464263)" class="w-full px-3 py-1.5 bg-slate-950/60 border border-slate-800 rounded-lg text-xs font-mono text-slate-400 focus:outline-none focus:border-brand-500">
            </div>

            <div>
              <div class="flex items-center justify-between mb-1">
                <label class="block text-xs font-medium text-slate-400">Canal de Voz 24/7</label>
                <button type="button" id="btnConnectVoice" onclick="triggerConnectVoice()" class="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-emerald-300 hover:text-white bg-emerald-500/10 hover:bg-emerald-600 border border-emerald-500/30 rounded-lg transition shadow-sm">
                  <i class="fa-solid fa-volume-high"></i>
                  <span>Conectar a Voz Ahora</span>
                </button>
              </div>
              <select id="cfg_sel_voiceChannelId" onchange="syncChannelInput('voiceChannelId', this.value)" class="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-brand-500 mb-1">
                <option value="">-- Cargando canales de voz... --</option>
              </select>
              <input type="text" id="cfg_voiceChannelId" placeholder="ID numérico (ej: 1569408755085348927)" class="w-full px-3 py-1.5 bg-slate-950/60 border border-slate-800 rounded-lg text-xs font-mono text-slate-400 focus:outline-none focus:border-brand-500">
            </div>

            <div>
              <label class="block text-xs font-medium text-slate-400 mb-1">Rol para Alertas de Seguridad & Stock Bajo (Opcional)</label>
              <select id="cfg_sel_alertRoleId" onchange="syncChannelInput('alertRoleId', this.value)" class="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-brand-500 mb-1">
                <option value="">-- Sin mención especial (solo registro en canal) --</option>
              </select>
              <input type="text" id="cfg_alertRoleId" placeholder="ID numérico del rol (ej: 123456789012345678)" class="w-full px-3 py-1.5 bg-slate-950/60 border border-slate-800 rounded-lg text-xs font-mono text-slate-400 focus:outline-none focus:border-brand-500">
            </div>

            <button type="submit" class="flex items-center justify-center gap-2 px-5 py-2.5 bg-brand-600 hover:bg-brand-500 text-white font-medium text-sm rounded-xl transition shadow-lg shadow-brand-600/20">
              <i class="fa-solid fa-floppy-disk text-xs"></i>
              <span>Guardar Canales & Notificaciones</span>
            </button>
          </form>

          <div class="pt-4 border-t border-slate-800 space-y-2">
            <span class="text-xs text-slate-400 block font-medium">Publicar Mensajes & Acciones en Discord:</span>
            <div class="flex flex-wrap gap-2">
              <button onclick="publishDiscordPanel('panel')" class="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 rounded-lg border border-slate-700 transition">
                <i class="fa-solid fa-share-from-square"></i> Publicar Panel Licencias
              </button>
              <button onclick="publishDiscordPanel('admin-panel')" class="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 rounded-lg border border-slate-700 transition">
                <i class="fa-solid fa-sliders"></i> Publicar Panel Administrativo
              </button>
              <button onclick="triggerConnectVoice()" class="px-3 py-1.5 bg-emerald-950/40 hover:bg-emerald-900/60 text-emerald-300 rounded-lg border border-emerald-700/50 transition text-xs flex items-center gap-1.5">
                <i class="fa-solid fa-volume-high text-emerald-400"></i> Conectar a Voz 24/7
              </button>
            </div>
          </div>
        </div>

        <!-- Credenciales Propias de Plataformas para este Servidor -->
        <div class="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
          <h3 class="text-base font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
            <i class="fa-solid fa-server text-brand-400"></i> Credenciales de Páginas (Este Servidor)
          </h3>
          <p class="text-xs text-slate-400">Si dejas estos campos vacíos, este servidor usará las credenciales por defecto del bot. Si colocas credenciales aquí, serán 100% exclusivas para este servidor.</p>

          <form id="formProvidersConfig" onsubmit="saveProvidersConfig(event)" class="space-y-4">
            <!-- KeyAuth -->
            <div class="p-3.5 bg-slate-950/70 rounded-xl border border-slate-800 space-y-2">
              <span class="text-xs font-bold text-brand-400 block">KeyAuth (Elite Pro)</span>
              <div>
                <label class="block text-[11px] text-slate-400 mb-1">Seller Key Exclusiva</label>
                <input type="password" id="cfg_keyauth_sellerKey" placeholder="Dejar vacío para usar la general" class="w-full px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs font-mono text-slate-200 focus:outline-none focus:border-brand-500">
              </div>
            </div>

            <!-- Bypass APK -->
            <div class="p-3.5 bg-slate-950/70 rounded-xl border border-slate-800 space-y-2">
              <span class="text-xs font-bold text-brand-400 block">Bypass APK (172.96.172.132)</span>
              <div class="grid grid-cols-2 gap-2">
                <div>
                  <label class="block text-[11px] text-slate-400 mb-1">Usuario</label>
                  <input type="text" id="cfg_bypass_username" placeholder="Usuario propio" class="w-full px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs font-mono text-slate-200 focus:outline-none focus:border-brand-500">
                </div>
                <div>
                  <label class="block text-[11px] text-slate-400 mb-1">Contraseña</label>
                  <input type="password" id="cfg_bypass_password" placeholder="••••••••" class="w-full px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs font-mono text-slate-200 focus:outline-none focus:border-brand-500">
                </div>
              </div>
            </div>

            <!-- WorldCheats -->
            <div class="p-3.5 bg-slate-950/70 rounded-xl border border-slate-800 space-y-2">
              <span class="text-xs font-bold text-brand-400 block">WorldCheats (new.mycheats.net)</span>
              <div class="grid grid-cols-2 gap-2">
                <div>
                  <label class="block text-[11px] text-slate-400 mb-1">Usuario</label>
                  <input type="text" id="cfg_mycheats_username" placeholder="Usuario propio" class="w-full px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs font-mono text-slate-200 focus:outline-none focus:border-brand-500">
                </div>
                <div>
                  <label class="block text-[11px] text-slate-400 mb-1">Contraseña</label>
                  <input type="password" id="cfg_mycheats_password" placeholder="••••••••" class="w-full px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs font-mono text-slate-200 focus:outline-none focus:border-brand-500">
                </div>
              </div>
            </div>

            <button type="submit" class="flex items-center justify-center gap-2 px-5 py-2.5 bg-brand-600 hover:bg-brand-500 text-white font-medium text-sm rounded-xl transition">
              <i class="fa-solid fa-floppy-disk text-xs"></i>
              <span>Guardar Credenciales Exclusivas</span>
            </button>
          </form>
        </div>
      </div>

      <!-- Fila 2: Marca (White-Label) & Clonar Configuración -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <!-- Personalización de Marca (White-Label) -->
        <div class="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
          <h3 class="text-base font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
            <i class="fa-solid fa-palette text-indigo-400"></i> Marca & Personalización (White-Label)
          </h3>
          <p class="text-xs text-slate-400">Personaliza el color de los embeds y el prefijo de las licencias generadas en este servidor.</p>

          <form id="formBranding" onsubmit="saveBranding(event)" class="space-y-4">
            <div>
              <label class="block text-xs font-medium text-slate-400 mb-1">Color Principal de Embeds en Discord</label>
              <div class="flex items-center gap-3">
                <input type="color" id="cfg_branding_color_picker" onchange="document.getElementById('cfg_branding_color').value = this.value" class="w-10 h-10 rounded-lg bg-transparent border-0 cursor-pointer">
                <input type="text" id="cfg_branding_color" oninput="document.getElementById('cfg_branding_color_picker').value = this.value" placeholder="#2563eb" class="flex-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm font-mono text-slate-200 focus:outline-none focus:border-brand-500">
              </div>
            </div>

            <div>
              <label class="block text-xs font-medium text-slate-400 mb-1">Prefijo por Defecto para Licencias</label>
              <input type="text" id="cfg_branding_prefix" placeholder="VIP" class="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm font-mono text-slate-200 focus:outline-none focus:border-brand-500">
              <span class="text-[11px] text-slate-500 mt-1 block">Ejemplo: Si pones "VIP", las claves generadas iniciarán con ese prefijo.</span>
            </div>

            <button type="submit" class="flex items-center justify-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm rounded-xl transition shadow-lg shadow-indigo-600/20">
              <i class="fa-solid fa-floppy-disk text-xs"></i>
              <span>Guardar Marca</span>
            </button>
          </form>
        </div>

        <!-- Clonar Configuración de Otro Servidor -->
        <div class="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4 flex flex-col justify-between">
          <div class="space-y-3">
            <h3 class="text-base font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
              <i class="fa-solid fa-copy text-amber-400"></i> Clonar Configuración de Otro Servidor
            </h3>
            <p class="text-xs text-slate-400 leading-relaxed">
              Copia rápidamente los canales, la plantilla de WhatsApp, la marca y las credenciales exclusivas de otro servidor que administres hacia este servidor.
            </p>

            <div>
              <label class="block text-xs font-medium text-slate-400 mb-1">Seleccionar Servidor de Origen</label>
              <select id="cfg_clone_sourceGuildId" class="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-brand-500">
                ${availableGuilds.filter(g => g.id !== gId).length > 0 ?
                  availableGuilds.filter(g => g.id !== gId).map(g => `<option value="${g.id}">${g.name} (${g.id})</option>`).join('')
                  : '<option value="">No hay otros servidores disponibles</option>'
                }
              </select>
            </div>
          </div>

          <div class="pt-4 border-t border-slate-800">
            <button onclick="submitCloneConfig()" id="btnCloneConfig" type="button" class="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-600 hover:bg-amber-500 text-white font-medium text-xs rounded-xl transition shadow-lg shadow-amber-600/20">
              <i class="fa-solid fa-clone"></i>
              <span>Clonar Configuración a este Servidor</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Fila 3: Plantilla de Entrega y Respaldos -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <!-- Plantilla de Entrega (WhatsApp / Telegram) -->
        <div class="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
          <h3 class="text-base font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
            <i class="fa-brands fa-whatsapp text-emerald-400"></i> Plantilla de Entrega (WhatsApp)
          </h3>
          <p class="text-xs text-slate-400">Personaliza el formato del mensaje que recibirán tus clientes cuando se generen licencias en Discord o en este Panel Web.</p>

          <form id="formCustomTemplate" onsubmit="saveCustomTemplate(event)" class="space-y-4">
            <div>
              <label class="block text-xs font-medium text-slate-400 mb-1">Nombre de la Tienda / Encabezado</label>
              <input type="text" id="cfg_template_storeName" oninput="updateTemplatePreview()" placeholder="Gian Store VIP" class="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-brand-500">
            </div>

            <div>
              <label class="block text-xs font-medium text-slate-400 mb-1">Texto de Advertencia / Nota</label>
              <input type="text" id="cfg_template_noteText" oninput="updateTemplatePreview()" placeholder="Válida para 1 solo dispositivo." class="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-brand-500">
            </div>

            <div>
              <label class="block text-xs font-medium text-slate-400 mb-1">Pie de Mensaje / Contacto & Soporte</label>
              <input type="text" id="cfg_template_footerText" oninput="updateTemplatePreview()" placeholder="Soporte: +58 412... | Discord: discord.gg/..." class="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-brand-500">
            </div>

            <div>
              <label class="block text-[11px] text-slate-400 mb-1.5 uppercase tracking-wider font-semibold">Vista Previa en Vivo</label>
              <pre id="templatePreviewBox" class="p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono text-emerald-400 select-all whitespace-pre-wrap"></pre>
            </div>

            <button type="submit" class="flex items-center justify-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-sm rounded-xl transition">
              <i class="fa-solid fa-floppy-disk text-xs"></i>
              <span>Guardar Plantilla de Entrega</span>
            </button>
          </form>
        </div>

        <!-- Copia de Seguridad & Respaldos -->
        <div class="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4 flex flex-col justify-between">
          <div class="space-y-4">
            <h3 class="text-base font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
              <i class="fa-solid fa-database text-amber-400"></i> Base de Datos & Copia de Seguridad
            </h3>
            <p class="text-xs text-slate-400 leading-relaxed">
              Tu servidor cuenta con <strong>escritura atómica segura</strong> (protegida contra apagones y reinicios repentinos) y respaldos automáticos cada 24 horas.
            </p>
            <div class="p-4 bg-slate-950/70 border border-slate-800 rounded-xl space-y-2 text-xs text-slate-300">
              <div class="flex items-center gap-2 text-emerald-400 font-semibold">
                <i class="fa-solid fa-shield-check"></i> Protección de Integridad Atómica: ACTIVA
              </div>
              <div class="flex items-center gap-2 text-brand-400 font-semibold">
                <i class="fa-solid fa-clock-rotate-left"></i> Respaldos Diarios Automáticos: ACTIVOS (data/backups/)
              </div>
            </div>
          </div>

          <div class="pt-4 border-t border-slate-800 space-y-2.5">
            <span class="text-xs text-slate-400 block font-medium">Descarga Inmediata:</span>
            <div class="flex flex-col sm:flex-row gap-2.5">
              <a id="btnDownloadBackup" href="#" download class="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-brand-600 hover:bg-brand-500 text-white font-medium text-xs rounded-xl transition shadow-lg shadow-brand-600/20 text-center">
                <i class="fa-solid fa-download"></i>
                <span>Descargar Backup JSON (Este Servidor)</span>
              </a>
              ${user.isMasterOwner ? `
              <a href="/api/backup/all" download class="flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-600 hover:bg-amber-500 text-white font-medium text-xs rounded-xl transition shadow-lg shadow-amber-600/20 text-center">
                <i class="fa-solid fa-shield-halved"></i>
                <span>Backup Maestro (Global)</span>
              </a>
              ` : ''}
            </div>
          </div>
        </div>
      </div>

      <!-- Fila 4: Registro de Auditoría Web de este Servidor -->
      <div class="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
        <div class="flex items-center justify-between border-b border-slate-800 pb-3">
          <div>
            <h3 class="text-base font-bold text-white flex items-center gap-2">
              <i class="fa-solid fa-clock-rotate-left text-brand-400"></i> Registro de Auditoría Web (Este Servidor)
            </h3>
            <p class="text-xs text-slate-400 mt-0.5">Historial cronológico de cambios de configuración y acciones administrativas ejecutadas en este servidor.</p>
          </div>
          <button onclick="loadAuditLogs()" type="button" class="text-xs text-slate-400 hover:text-white flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg transition">
            <i class="fa-solid fa-arrows-rotate"></i> Actualizar
          </button>
        </div>

        <div class="overflow-x-auto">
          <table class="w-full text-left text-xs">
            <thead class="bg-slate-950/70 border-b border-slate-800 text-slate-400 uppercase tracking-wider">
              <tr>
                <th class="py-3 px-4">Fecha / Hora</th>
                <th class="py-3 px-4">Operador</th>
                <th class="py-3 px-4">Acción</th>
                <th class="py-3 px-4">Detalles</th>
              </tr>
            </thead>
            <tbody id="audit-table-body" class="divide-y divide-slate-800/60 font-mono">
              <tr>
                <td colspan="4" class="py-8 text-center text-slate-500 font-sans">Cargando registros de auditoría...</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- ── TAB 7: ADMINISTRADORES DEL BOT ── -->
    <div id="tab-admins" class="tab-content hidden space-y-6">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 class="text-xl font-bold text-white flex items-center gap-2">
            <i class="fa-solid fa-user-shield text-amber-400"></i> Administradores del Bot
          </h2>
          <p class="text-xs text-slate-400 mt-0.5">Autoriza qué usuarios de Discord tienen permiso para entrar a este Dashboard Web y usar comandos administrativos.</p>
        </div>
      </div>

      <!-- Formulario para Agregar Admin -->
      <div class="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl max-w-xl">
        <h3 class="text-sm font-bold text-white mb-2">Nombrar Nuevo Administrador</h3>
        <p class="text-xs text-slate-400 mb-4">Ingresa el ID de Discord del usuario (ej: 446349128650326021) o menciónalo.</p>
        <form onsubmit="submitAddAdmin(event)" class="flex flex-col sm:flex-row gap-3">
          <input type="text" id="admin_user_input" required placeholder="ID de Discord (números)" class="flex-1 px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm font-mono text-slate-200 focus:outline-none focus:border-brand-500">
          <button type="submit" class="px-5 py-2.5 bg-amber-600 hover:bg-amber-500 text-white font-medium text-sm rounded-xl transition shadow-lg shadow-amber-600/20 whitespace-nowrap flex items-center justify-center gap-2">
            <i class="fa-solid fa-shield-halved text-xs"></i>
            <span>Autorizar Admin</span>
          </button>
        </form>
      </div>

      <!-- Tabla de Administradores -->
      <div class="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl max-w-3xl">
        <div class="overflow-x-auto">
          <table class="w-full text-left text-sm">
            <thead class="bg-slate-950/70 border-b border-slate-800 text-slate-400 text-xs uppercase tracking-wider">
              <tr>
                <th class="py-3.5 px-4">Usuario</th>
                <th class="py-3.5 px-4">Rango</th>
                <th class="py-3.5 px-4 text-right">Acción</th>
              </tr>
            </thead>
            <tbody id="admins-table-body" class="divide-y divide-slate-800/60 font-mono text-xs">
              <tr>
                <td colspan="3" class="py-8 text-center text-slate-500 font-sans">Cargando administradores...</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

  </main>

  <!-- ── MODAL: ASIGNAR / EDITAR REVENDEDOR ── -->
  <div id="modalReseller" class="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 hidden flex items-center justify-center p-4">
    <div class="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl relative">
      <div class="flex items-center justify-between pb-4 border-b border-slate-800 mb-4">
        <h3 id="modalResellerTitle" class="text-base font-bold text-white">Asignar Membresía a Revendedor</h3>
        <button onclick="closeModalReseller()" class="text-slate-400 hover:text-white p-1 rounded-lg">
          <i class="fa-solid fa-xmark text-lg"></i>
        </button>
      </div>

      <form id="formResellerModal" onsubmit="submitResellerModal(event)" class="space-y-4">
        <div>
          <label class="block text-xs font-medium text-slate-400 mb-1 uppercase tracking-wider">ID de Usuario o Mención de Discord</label>
          <input type="text" id="modal_reseller_user" required placeholder="446349128650326021 o @usuario" class="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm font-mono text-slate-200 focus:outline-none focus:border-brand-500">
        </div>

        <div>
          <label class="block text-xs font-medium text-slate-400 mb-1 uppercase tracking-wider">Días a Añadir</label>
          <input type="number" id="modal_reseller_days" value="30" min="1" max="365" required class="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-brand-500">
        </div>

        <div>
          <label class="block text-xs font-medium text-slate-400 mb-1 uppercase tracking-wider">Límite Diario de Claves (0 = Sin Límite)</label>
          <input type="number" id="modal_reseller_limit" value="0" min="0" max="5000" class="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-brand-500" placeholder="Ej: 15 (dejar en 0 para ilimitado)">
          <span class="text-[11px] text-slate-500 mt-1 block">Número máximo de keys que el revendedor puede crear al día.</span>
        </div>

        <div>
          <label class="block text-xs font-medium text-slate-400 mb-2 uppercase tracking-wider">Plataformas Permitidas</label>
          <div class="space-y-2 bg-slate-950 p-3.5 rounded-xl border border-slate-800 text-sm">
            <label class="flex items-center gap-2.5 text-slate-300 hover:text-white cursor-pointer">
              <input type="checkbox" id="check_plat_all" onchange="toggleAllPlatforms(this)" class="rounded bg-slate-800 border-slate-700 text-brand-600 focus:ring-0">
              <span class="font-bold text-brand-400">Todas las Plataformas (Acceso Total)</span>
            </label>
            <div class="border-t border-slate-800/80 my-1"></div>
            <label class="flex items-center gap-2.5 text-slate-300 hover:text-white cursor-pointer">
              <input type="checkbox" name="modal_platforms" value="bypass" class="plat-checkbox rounded bg-slate-800 border-slate-700 text-brand-600 focus:ring-0">
              <span>Bypass APK</span>
            </label>
            <label class="flex items-center gap-2.5 text-slate-300 hover:text-white cursor-pointer">
              <input type="checkbox" name="modal_platforms" value="bypass_uid" class="plat-checkbox rounded bg-slate-800 border-slate-700 text-brand-600 focus:ring-0">
              <span>Bypass UID (Auto ON)</span>
            </label>
            <label class="flex items-center gap-2.5 text-slate-300 hover:text-white cursor-pointer">
              <input type="checkbox" name="modal_platforms" value="mycheats" class="plat-checkbox rounded bg-slate-800 border-slate-700 text-brand-600 focus:ring-0">
              <span>WorldCheats (Panel VIP)</span>
            </label>
            <label class="flex items-center gap-2.5 text-slate-300 hover:text-white cursor-pointer">
              <input type="checkbox" name="modal_platforms" value="keyauth" class="plat-checkbox rounded bg-slate-800 border-slate-700 text-brand-600 focus:ring-0">
              <span>KeyAuth (Elite Pro)</span>
            </label>
          </div>
        </div>

        <div class="flex justify-end gap-3 pt-3">
          <button type="button" onclick="closeModalReseller()" class="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium rounded-xl transition">
            Cancelar
          </button>
          <button type="submit" class="px-5 py-2 bg-brand-600 hover:bg-brand-500 text-white text-sm font-medium rounded-xl transition">
            Guardar
          </button>
        </div>
      </form>
    </div>
  </div>

  <!-- Toast Notification Container -->
  <div id="toast-container" class="fixed bottom-5 right-5 z-50 space-y-2 pointer-events-none"></div>

  <!-- Scripts del Dashboard -->
  <script>
    const currentGuildId = '${gId}';
    let allKeysCache = [];
    let allResellersCache = [];

    // Sistema de Pestañas
    function switchTab(tabId) {
      document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
      document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('bg-brand-600', 'text-white', 'shadow-sm');
        btn.classList.add('text-slate-400');
      });

      const activeContent = document.getElementById('tab-' + tabId);
      const activeBtn = document.getElementById('tab-btn-' + tabId);

      if (activeContent) activeContent.classList.remove('hidden');
      if (activeBtn) {
        activeBtn.classList.add('bg-brand-600', 'text-white', 'shadow-sm');
        activeBtn.classList.remove('text-slate-400');
      }

      // Cargar datos al abrir pestaña
      if (tabId === 'overview') { loadStats(); loadHealth(); }
      if (tabId === 'resellers') loadResellers();
      if (tabId === 'stock') loadStock();
      if (tabId === 'keys') loadKeys();
      if (tabId === 'settings') loadSettings();
      if (tabId === 'admins') loadAdmins();
    }

    // Toast Notificación
    function showToast(message, type = 'success') {
      const container = document.getElementById('toast-container');
      const toast = document.createElement('div');
      const isError = type === 'error';
      toast.className = \`px-4 py-3 rounded-xl border text-sm font-medium shadow-2xl flex items-center gap-3 pointer-events-auto transition-all duration-300 translate-y-2 opacity-0 \${
        isError ? 'bg-red-950/90 border-red-800 text-red-200' : 'bg-emerald-950/90 border-emerald-800 text-emerald-200'
      }\`;
      toast.innerHTML = \`<i class="fa-solid \${isError ? 'fa-circle-xmark' : 'fa-circle-check'}"></i> <span>\${message}</span>\`;
      container.appendChild(toast);

      requestAnimationFrame(() => {
        toast.classList.remove('translate-y-2', 'opacity-0');
      });

      setTimeout(() => {
        toast.classList.add('opacity-0');
        setTimeout(() => toast.remove(), 300);
      }, 4000);
    }

    // ── Cargar Estadísticas del Resumen ──
    async function loadStats() {
      try {
        const res = await fetch(\`/api/guilds/\${currentGuildId}/stats\`);
        const data = await res.json();
        document.getElementById('stat-resellers-count').innerText = data.resellersCount || 0;
        document.getElementById('stat-keyauth-stock').innerText = (data.stock?.keyauth || 0) + ' keys';
        document.getElementById('stat-keys-count').innerText = data.keysCount || 0;
      } catch (err) {
        console.error('Error al cargar stats:', err);
      }
    }

    // ── Cargar Estado en Vivo de Plataformas Web ──
    async function loadHealth() {
      const grid = document.getElementById('health-cards-grid');
      if (!grid) return;
      grid.innerHTML = '<div class="col-span-3 bg-slate-950/60 border border-slate-800 rounded-xl p-4 text-center text-xs text-slate-500"><i class="fa-solid fa-spinner fa-spin mr-1.5"></i> Comprobando conectividad de plataformas...</div>';
      try {
        const res = await fetch(\`/api/guilds/\${currentGuildId}/health\`);
        const data = await res.json();
        const entries = Object.entries(data);
        if (entries.length === 0) {
          grid.innerHTML = '<div class="col-span-3 text-center text-xs text-slate-500">No hay plataformas configuradas.</div>';
          return;
        }

        grid.innerHTML = entries.map(([pid, h]) => {
          const isOk = h.online;
          const statusText = isOk ? 'En Línea' : 'Sin Conexión';
          const badgeClass = isOk ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20';
          const dotColor = isOk ? 'bg-emerald-400' : 'bg-red-400';
          const ms = h.latency ? \`\${h.latency}ms\` : '';
          const detail = isOk ? (h.message || 'Operativo') : (h.error || 'Fallo de conexión');

          return \`
            <div class="bg-slate-950/80 border border-slate-800 rounded-xl p-4 shadow">
              <div class="flex items-center justify-between mb-2">
                <span class="text-xs font-semibold text-white flex items-center gap-2">
                  <span class="w-2 h-2 rounded-full \${dotColor}"></span>
                  \${h.name}
                </span>
                <span class="px-2 py-0.5 text-[10px] font-medium rounded-md border \${badgeClass}">
                  \${statusText}
                </span>
              </div>
              <p class="text-xs text-slate-400 truncate" title="\${detail}">\${detail}</p>
              \${ms ? \`<span class="text-[10px] text-slate-500 font-mono mt-1.5 block">Latencia: \${ms}</span>\` : ''}
            </div>
          \`;
        }).join('');
      } catch (err) {
        grid.innerHTML = \`<div class="col-span-3 text-center text-xs text-red-400">Error al consultar estado: \${err.message}</div>\`;
      }
    }

    // ── Cargar Revendedores ──
    async function loadResellers() {
      const tbody = document.getElementById('resellers-table-body');
      try {
        const res = await fetch(\`/api/guilds/\${currentGuildId}/resellers\`);
        const list = await res.json();
        allResellersCache = list;

        if (list.length === 0) {
          tbody.innerHTML = '<tr><td colspan="6" class="py-8 text-center text-slate-500">No hay revendedores registrados en este servidor. Haz clic en "Asignar Revendedor".</td></tr>';
          return;
        }

        tbody.innerHTML = list.map(r => {
          const isExp = r.isExpired;
          const statusBadge = isExp 
            ? '<span class="px-2 py-0.5 text-xs rounded-md bg-red-500/10 text-red-400 border border-red-500/20 font-medium">Expirado (0d)</span>'
            : \`<span class="px-2 py-0.5 text-xs rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">\${r.daysLeft} días restantes</span>\`;

          const quotaBadge = (r.dailyLimit && r.dailyLimit > 0)
            ? \`<span class="px-2 py-0.5 text-xs rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20 font-mono font-medium">\${r.usedToday || 0} / \${r.dailyLimit} hoy</span>\`
            : '<span class="text-slate-500 text-xs">Sin límite</span>';

          const platBadges = (r.allowedProviders || []).map(p => \`<span class="px-1.5 py-0.5 text-[10px] rounded bg-slate-800 text-slate-300 font-mono">\${p}</span>\`).join(' ');

          const avatarUrl = r.avatar || 'https://cdn.discordapp.com/embed/avatars/0.png';
          const userDisplay = r.tag || r.userId;

          return \`
            <tr class="hover:bg-slate-800/30 transition">
              <td class="py-3 px-4">
                <div class="flex items-center gap-3">
                  <img src="\${avatarUrl}" class="w-8 h-8 rounded-full border border-slate-700 bg-slate-800 object-cover shrink-0" />
                  <div>
                    <div class="font-sans font-bold text-white text-sm flex items-center gap-2">
                      \${userDisplay}
                    </div>
                    <div class="text-[11px] text-slate-400 font-mono">\${r.userId}</div>
                  </div>
                </div>
              </td>
              <td class="py-3 px-4">\${statusBadge}</td>
              <td class="py-3 px-4 font-sans">\${quotaBadge}</td>
              <td class="py-3 px-4">\${platBadges || '<span class="text-slate-600 text-xs">Ninguna</span>'}</td>
              <td class="py-3 px-4 text-slate-400 text-xs font-sans">\${r.addedBy || 'Admin'}</td>
              <td class="py-3 px-4 text-right space-x-1">
                <button onclick="editReseller('\${r.userId}')" title="Modificar" class="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition">
                  <i class="fa-solid fa-pen-to-square text-xs"></i>
                </button>
                <button onclick="deleteReseller('\${r.userId}')" title="Quitar" class="p-1.5 rounded-lg bg-slate-800 hover:bg-red-900/40 text-slate-400 hover:text-red-400 transition">
                  <i class="fa-solid fa-trash text-xs"></i>
                </button>
              </td>
            </tr>
          \`;
        }).join('');
      } catch (err) {
        tbody.innerHTML = '<tr><td colspan="6" class="py-8 text-center text-red-400">Error al cargar revendedores.</td></tr>';
      }
    }

    // Modal Revendedor
    function openAddResellerModal() {
      document.getElementById('modalResellerTitle').innerText = 'Asignar Membresía a Revendedor';
      document.getElementById('modal_reseller_user').value = '';
      document.getElementById('modal_reseller_user').readOnly = false;
      document.getElementById('modal_reseller_days').value = '30';
      document.getElementById('modal_reseller_limit').value = '0';
      document.getElementById('check_plat_all').checked = true;
      toggleAllPlatforms(document.getElementById('check_plat_all'));
      document.getElementById('modalReseller').classList.remove('hidden');
    }

    function editReseller(userId) {
      const r = allResellersCache.find(x => x.userId === userId);
      if (!r) return;
      document.getElementById('modalResellerTitle').innerText = 'Modificar Membresía de Revendedor';
      document.getElementById('modal_reseller_user').value = userId;
      document.getElementById('modal_reseller_user').readOnly = true;
      document.getElementById('modal_reseller_days').value = r.daysLeft > 0 ? r.daysLeft : 30;
      document.getElementById('modal_reseller_limit').value = r.dailyLimit || 0;
      
      document.querySelectorAll('.plat-checkbox').forEach(cb => {
        cb.checked = (r.allowedProviders || []).includes(cb.value);
      });
      document.getElementById('check_plat_all').checked = false;
      document.getElementById('modalReseller').classList.remove('hidden');
    }

    function closeModalReseller() {
      document.getElementById('modalReseller').classList.add('hidden');
    }

    function toggleAllPlatforms(source) {
      document.querySelectorAll('.plat-checkbox').forEach(cb => {
        cb.checked = source.checked;
      });
    }

    async function submitResellerModal(e) {
      e.preventDefault();
      const rawUser = document.getElementById('modal_reseller_user').value.trim();
      const userId = rawUser.replace(/[^0-9]/g, '');
      const days = parseInt(document.getElementById('modal_reseller_days').value, 10);
      const dailyLimit = parseInt(document.getElementById('modal_reseller_limit').value || '0', 10);
      
      const platforms = [];
      document.querySelectorAll('.plat-checkbox:checked').forEach(cb => {
        platforms.push(cb.value);
      });

      if (!userId) {
        alert('Por favor ingresa una ID válida o mención.');
        return;
      }

      try {
        const res = await fetch(\`/api/guilds/\${currentGuildId}/resellers\`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, days, platforms, dailyLimit })
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        showToast('Revendedor configurado correctamente.');
        closeModalReseller();
        loadResellers();
        loadStats();
      } catch (err) {
        showToast(err.message, 'error');
      }
    }

    async function deleteReseller(userId) {
      if (!confirm(\`¿Estás seguro de que deseas quitar la membresía a \${userId}?\`)) return;
      try {
        const res = await fetch(\`/api/guilds/\${currentGuildId}/resellers/\${userId}\`, { method: 'DELETE' });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        showToast('Membresía revocada exitosamente.');
        loadResellers();
        loadStats();
      } catch (err) {
        showToast(err.message, 'error');
      }
    }

    // ── Cargar Stock ──
    async function loadStock() {
      const grid = document.getElementById('stock-cards-grid');
      try {
        const res = await fetch(\`/api/guilds/\${currentGuildId}/stock\`);
        const stockData = await res.json();
        const keyauthCount = stockData.keyauth || 0;
        const isCritical = keyauthCount === 0;

        const breakdown = stockData.keyauthBreakdown || {};
        const breakdownEntries = Object.entries(breakdown).filter(([_, c]) => c > 0);
        const breakdownHtml = breakdownEntries.length > 0
          ? breakdownEntries.map(([d, c]) => \`<span class="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-amber-300 font-mono text-[11px] font-semibold">\${d} das: \${c}</span>\`).join(' ')
          : '<span class="text-[11px] text-slate-500">Sin claves cargadas</span>';

        grid.innerHTML = \`
          <div class="bg-slate-900 border border-amber-500/30 rounded-2xl p-5 shadow-xl relative overflow-hidden">
            <div class="flex items-center justify-between">
              <span class="text-xs text-amber-400 font-bold block uppercase tracking-wider">KeyAuth (Elite Pro)</span>
              <span class="px-2 py-0.5 text-[10px] font-semibold rounded bg-amber-500/10 text-amber-300 border border-amber-500/20">Stock Manual</span>
            </div>
            <div class="flex items-center justify-between mt-3">
              <span class="text-2xl font-bold \${isCritical ? 'text-red-400' : 'text-white'}">\${keyauthCount} <span class="text-xs font-normal text-slate-400">claves</span></span>
              <span class="px-2 py-0.5 text-xs font-semibold rounded-lg \${isCritical ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'}">
                \${isCritical ? 'Agotado' : 'Disponible'}
              </span>
            </div>
            <div class="mt-3 pt-2.5 border-t border-slate-800/80">
              <span class="text-[10px] text-slate-400 uppercase font-medium block mb-1.5">Duraciones en Stock:</span>
              <div class="flex flex-wrap gap-1.5">\${breakdownHtml}</div>
            </div>
          </div>

          <div class="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow">
            <div class="flex items-center justify-between">
              <span class="text-xs text-slate-400 font-medium block uppercase tracking-wider">Bypass APK</span>
              <span class="px-2 py-0.5 text-[10px] font-semibold rounded bg-brand-500/10 text-brand-400 border border-brand-500/20">API Directa</span>
            </div>
            <div class="flex items-center justify-between mt-3">
              <span class="text-sm font-semibold text-emerald-400 flex items-center gap-1.5"><i class="fa-solid fa-bolt"></i> Automático</span>
              <span class="px-2 py-0.5 text-xs font-semibold rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Online</span>
            </div>
            <p class="text-[11px] text-slate-500 mt-2">No necesita precargar stock.</p>
          </div>

          <div class="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow">
            <div class="flex items-center justify-between">
              <span class="text-xs text-slate-400 font-medium block uppercase tracking-wider">Bypass UID (Auto ON)</span>
              <span class="px-2 py-0.5 text-[10px] font-semibold rounded bg-brand-500/10 text-brand-400 border border-brand-500/20">API Directa</span>
            </div>
            <div class="flex items-center justify-between mt-3">
              <span class="text-sm font-semibold text-emerald-400 flex items-center gap-1.5"><i class="fa-solid fa-bolt"></i> Automático</span>
              <span class="px-2 py-0.5 text-xs font-semibold rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Online</span>
            </div>
            <p class="text-[11px] text-slate-500 mt-2">No necesita precargar stock.</p>
          </div>

          <div class="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow">
            <div class="flex items-center justify-between">
              <span class="text-xs text-slate-400 font-medium block uppercase tracking-wider">WorldCheats (Panel VIP)</span>
              <span class="px-2 py-0.5 text-[10px] font-semibold rounded bg-brand-500/10 text-brand-400 border border-brand-500/20">API Directa</span>
            </div>
            <div class="flex items-center justify-between mt-3">
              <span class="text-sm font-semibold text-emerald-400 flex items-center gap-1.5"><i class="fa-solid fa-bolt"></i> Automático</span>
              <span class="px-2 py-0.5 text-xs font-semibold rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Online</span>
            </div>
            <p class="text-[11px] text-slate-500 mt-2">No necesita precargar stock.</p>
          </div>
        \`;
      } catch (err) {
        console.error('Error al cargar stock:', err);
      }
    }

    async function submitAddStock(e) {
      e.preventDefault();
      const providerId = document.getElementById('stock_provider').value;
      const days = parseInt(document.getElementById('stock_days').value, 10);
      const rawKeys = document.getElementById('stock_keys').value;

      try {
        const res = await fetch(\`/api/guilds/\${currentGuildId}/stock\`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ providerId, days, rawKeys })
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        showToast(\`Se añadieron +\${data.added} claves al stock. Total ahora: \${data.total}.\`);
        document.getElementById('stock_keys').value = '';
        loadStock();
        loadStats();
      } catch (err) {
        showToast(err.message, 'error');
      }
    }

    // ── Cargar Historial de Licencias ──
    async function loadKeys() {
      const tbody = document.getElementById('keys-table-body');
      try {
        const res = await fetch(\`/api/guilds/\${currentGuildId}/keys\`);
        const list = await res.json();
        allKeysCache = list;
        renderKeysTable(list);
      } catch (err) {
        tbody.innerHTML = '<tr><td colspan="7" class="py-8 text-center text-red-400 font-sans">Error al cargar claves.</td></tr>';
      }
    }

    function renderKeysTable(list) {
      const tbody = document.getElementById('keys-table-body');
      if (list.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="py-8 text-center text-slate-500 font-sans">No hay licencias registradas aún.</td></tr>';
        return;
      }

      tbody.innerHTML = list.map(k => {
        const dateStr = new Date(k.createdAt).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' });
        return \`
          <tr class="hover:bg-slate-800/30 transition">
            <td class="py-3 px-4 text-slate-400">\${dateStr}</td>
            <td class="py-3 px-4 text-slate-300 font-mono">\${k.userId || 'Sistema'}</td>
            <td class="py-3 px-4 text-brand-400">\${k.providerId}</td>
            <td class="py-3 px-4">
              <span class="bg-slate-950 px-2 py-1 rounded border border-slate-800 select-all">\${k.key}</span>
            </td>
            <td class="py-3 px-4 text-slate-300">\${k.days}d</td>
            <td class="py-3 px-4 text-slate-400 font-sans">\${k.note || 'Sin nota'}</td>
            <td class="py-3 px-4 text-right space-x-1 font-sans">
              <button onclick="resetHwidDirect('\${k.providerId}', '\${k.key}')" title="Reset HWID" class="px-2 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded text-xs transition">
                <i class="fa-solid fa-arrows-rotate"></i> Reset
              </button>
              <button onclick="deleteKeyDirect('\${k.providerId}', '\${k.key}', '\${k.id}')" title="Eliminar" class="px-2 py-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 rounded text-xs transition">
                <i class="fa-solid fa-trash"></i>
              </button>
            </td>
          </tr>
        \`;
      }).join('');
    }

    function filterKeysTable() {
      const q = (document.getElementById('searchKeysInput')?.value || '').toLowerCase().trim();
      const selectedPlat = (document.getElementById('filterKeysPlatform')?.value || '').toLowerCase().trim();

      let filtered = allKeysCache;

      if (selectedPlat) {
        filtered = filtered.filter(k => (k.providerId || '').toLowerCase() === selectedPlat);
      }

      if (q) {
        filtered = filtered.filter(k => 
          (k.key || '').toLowerCase().includes(q) ||
          (k.userId || '').toLowerCase().includes(q) ||
          (k.providerId || '').toLowerCase().includes(q) ||
          (k.note || '').toLowerCase().includes(q)
        );
      }

      renderKeysTable(filtered);
    }

    function exportKeysToCSV() {
      if (!allKeysCache || allKeysCache.length === 0) {
        alert('No hay licencias para exportar.');
        return;
      }

      const q = (document.getElementById('searchKeysInput')?.value || '').toLowerCase().trim();
      const selectedPlat = (document.getElementById('filterKeysPlatform')?.value || '').toLowerCase().trim();

      let listToExport = allKeysCache;
      if (selectedPlat) {
        listToExport = listToExport.filter(k => (k.providerId || '').toLowerCase() === selectedPlat);
      }
      if (q) {
        listToExport = listToExport.filter(k => 
          (k.key || '').toLowerCase().includes(q) ||
          (k.userId || '').toLowerCase().includes(q) ||
          (k.providerId || '').toLowerCase().includes(q) ||
          (k.note || '').toLowerCase().includes(q)
        );
      }

      const headers = ['Fecha de Creación', 'ID de Revendedor', 'Plataforma', 'Clave / Cuenta', 'Duración (Días)', 'Prefijo', 'Nota / Cliente'];
      
      const escapeCSV = (val) => {
        if (val === null || val === undefined) return '""';
        const str = String(val).replace(/"/g, '""');
        return '"' + str + '"';
      };

      const rows = listToExport.map(k => [
        escapeCSV(new Date(k.createdAt).toLocaleString('es-ES')),
        escapeCSV(k.userId || 'Sistema'),
        escapeCSV(k.providerId || ''),
        escapeCSV(k.key || ''),
        escapeCSV(k.days || 30),
        escapeCSV(k.prefix || ''),
        escapeCSV(k.note || 'Sin nota')
      ].join(';'));

      // Inclusión de BOM UTF-8 (\uFEFF) para compatibilidad total con Excel en español
      const csvContent = '\uFEFF' + [headers.map(escapeCSV).join(';'), ...rows].join(String.fromCharCode(13, 10));
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const dateStr = new Date().toISOString().slice(0, 10);
      link.setAttribute('href', url);
      link.setAttribute('download', 'historial_licencias_' + currentGuildId + '_' + dateStr + '.csv');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      showToast('Exportadas ' + listToExport.length + ' licencias a archivo CSV (Excel).');
    }

    async function resetHwidDirect(providerId, key) {
      if (!confirm(\`¿Resetear el HWID de la clave: \${key}?\`)) return;
      try {
        const res = await fetch(\`/api/guilds/\${currentGuildId}/keys/reset-hwid\`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ providerId, key })
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        showToast(\`HWID reseteado con éxito: \${data.result}\`);
      } catch (err) {
        showToast(err.message, 'error');
      }
    }

    async function deleteKeyDirect(providerId, key, keyId) {
      if (!confirm(\`¿Eliminar la clave \${key} permanentemente?\`)) return;
      try {
        const res = await fetch(\`/api/guilds/\${currentGuildId}/keys/delete\`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ providerId, key, keyId })
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        showToast('Clave eliminada exitosamente.');
        loadKeys();
        loadStats();
      } catch (err) {
        showToast(err.message, 'error');
      }
    }

    // ── Emisión Rápida ──
    function handleGenProviderChange() {
      const pid = document.getElementById('gen_provider').value;
      const isKeyauth = pid === 'keyauth';
      document.getElementById('gen_prefix_container').style.display = isKeyauth ? 'none' : '';
    }

    async function submitFastGen(e) {
      e.preventDefault();
      const providerId = document.getElementById('gen_provider').value;
      const days = parseInt(document.getElementById('gen_days').value || '30', 10);
      const count = parseInt(document.getElementById('gen_count').value || '1', 10);
      const prefix = (document.getElementById('gen_prefix').value || '').trim();
      const note = (document.getElementById('gen_note').value || '').trim();

      const btn = document.getElementById('btn-submit-gen');
      btn.disabled = true;
      btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Generando...';

      try {
        const res = await fetch(\`/api/guilds/\${currentGuildId}/keys/create\`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ providerId, days, count, prefix, note })
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        document.getElementById('gen_output').value = data.forwardText;
        showToast('Licencia creada exitosamente.');
        loadStats();
      } catch (err) {
        showToast(err.message, 'error');
      } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles text-xs"></i> <span>Generar Licencia Ahora</span>';
      }
    }

    function copyGenOutput() {
      const text = document.getElementById('gen_output').value;
      if (!text) return;
      navigator.clipboard.writeText(text);
      showToast('Copiado al portapapeles.');
    }

    // ── Configuración del Servidor ──
    async function loadSettings() {
      try {
        const res = await fetch(\`/api/guilds/\${currentGuildId}/config\`);
        const cfg = await res.json();
        
        // Páginas Web Habilitadas en este Servidor
        const enabledP = cfg.enabledProviders || ['bypass', 'bypass_uid', 'mycheats', 'keyauth'];
        if (document.getElementById('plat_check_bypass')) document.getElementById('plat_check_bypass').checked = enabledP.includes('bypass');
        if (document.getElementById('plat_check_bypass_uid')) document.getElementById('plat_check_bypass_uid').checked = enabledP.includes('bypass_uid');
        if (document.getElementById('plat_check_mycheats')) document.getElementById('plat_check_mycheats').checked = enabledP.includes('mycheats');
        if (document.getElementById('plat_check_keyauth')) document.getElementById('plat_check_keyauth').checked = enabledP.includes('keyauth');
        updateGeneratorProviderOptions(enabledP);
        updateModalResellerPlatforms(enabledP);

        // Canales y Alertas
        document.getElementById('cfg_panelChannelId').value = cfg.channels?.panelChannelId || '';
        document.getElementById('cfg_adminPanelChannelId').value = cfg.channels?.adminPanelChannelId || '';
        document.getElementById('cfg_logsChannelId').value = cfg.channels?.logsChannelId || '';
        document.getElementById('cfg_voiceChannelId').value = cfg.channels?.voiceChannelId || '';
        document.getElementById('cfg_alertRoleId').value = cfg.channels?.alertRoleId || '';

        // Marca (White-Label)
        const branding = cfg.branding || {};
        const color = branding.embedColor || '#2563eb';
        document.getElementById('cfg_branding_color').value = color;
        document.getElementById('cfg_branding_color_picker').value = color;
        document.getElementById('cfg_branding_prefix').value = branding.defaultPrefix || 'VIP';

        // Cargar listas desplegables de Discord
        loadDiscordChannels();

        // Cargar Registro de Auditoría
        loadAuditLogs();

        // Proveedores
        const prov = cfg.providersConfig || {};
        document.getElementById('cfg_keyauth_sellerKey').value = prov.keyauth?.sellerKey || '';
        document.getElementById('cfg_bypass_username').value = prov.bypass?.username || '';
        document.getElementById('cfg_bypass_password').value = prov.bypass?.password || '';
        document.getElementById('cfg_mycheats_username').value = prov.mycheats?.username || '';
        document.getElementById('cfg_mycheats_password').value = prov.mycheats?.password || '';

        // Plantilla de Entrega Personalizable
        const tmpl = cfg.customTemplate || {};
        document.getElementById('cfg_template_storeName').value = tmpl.storeName || '';
        document.getElementById('cfg_template_noteText').value = tmpl.noteText || 'Válida para 1 solo dispositivo.';
        document.getElementById('cfg_template_footerText').value = tmpl.footerText || '';
        updateTemplatePreview();

        // Enlace de descarga de Backup
        const btnBackup = document.getElementById('btnDownloadBackup');
        if (btnBackup) {
          btnBackup.href = '/api/guilds/' + currentGuildId + '/backup';
        }
      } catch (err) {
        console.error('Error al cargar config:', err);
      }
    }

    async function loadDiscordChannels() {
      try {
        const res = await fetch(\`/api/guilds/\${currentGuildId}/discord-channels\`);
        const data = await res.json();
        if (data.error) return;

        const textList = data.textChannels || [];
        const voiceList = data.voiceChannels || [];
        const roleList = data.roles || [];

        function buildChannelOptions(list, currentVal, placeholder) {
          let html = '<option value="">' + placeholder + '</option>';
          let hasMatch = false;
          list.forEach(c => {
            const isSel = String(c.id) === String(currentVal);
            if (isSel) hasMatch = true;
            const parent = c.parentName ? ' [' + c.parentName + ']' : '';
            html += '<option value="' + c.id + '"' + (isSel ? ' selected' : '') + '>#' + c.name + parent + '</option>';
          });
          if (currentVal && !hasMatch) {
            html += '<option value="' + currentVal + '" selected>[ID Configurado: ' + currentVal + ']</option>';
          }
          return html;
        }

        function buildRoleOptions(list, currentVal) {
          let html = '<option value="">-- Sin mención especial (solo registro en canal) --</option>';
          let hasMatch = false;
          list.forEach(r => {
            const isSel = String(r.id) === String(currentVal);
            if (isSel) hasMatch = true;
            html += '<option value="' + r.id + '"' + (isSel ? ' selected' : '') + '>@' + r.name + '</option>';
          });
          if (currentVal && !hasMatch) {
            html += '<option value="' + currentVal + '" selected>[ID Configurado: ' + currentVal + ']</option>';
          }
          return html;
        }

        const pVal = document.getElementById('cfg_panelChannelId').value;
        const apVal = document.getElementById('cfg_adminPanelChannelId').value;
        const lVal = document.getElementById('cfg_logsChannelId').value;
        const vVal = document.getElementById('cfg_voiceChannelId').value;
        const aVal = document.getElementById('cfg_alertRoleId').value;

        document.getElementById('cfg_sel_panelChannelId').innerHTML = buildChannelOptions(textList, pVal, '-- Seleccionar canal de texto --');
        document.getElementById('cfg_sel_adminPanelChannelId').innerHTML = buildChannelOptions(textList, apVal, '-- Seleccionar canal de texto --');
        document.getElementById('cfg_sel_logsChannelId').innerHTML = buildChannelOptions(textList, lVal, '-- Seleccionar canal de texto --');
        document.getElementById('cfg_sel_voiceChannelId').innerHTML = buildChannelOptions(voiceList, vVal, '-- Seleccionar canal de voz --');
        document.getElementById('cfg_sel_alertRoleId').innerHTML = buildRoleOptions(roleList, aVal);
      } catch (err) {
        console.error('Error cargando canales de Discord:', err);
      }
    }

    function syncChannelInput(field, val) {
      const input = document.getElementById('cfg_' + field);
      if (input) input.value = val || '';
    }

    async function runAutoSetupChannels() {
      if (!confirm('¿Deseas ejecutar el Asistente de Auto-Configuración?\\n\\nSe creará automáticamente la categoría [🔐 PANEL AUTH GATEWAY], los 4 canales correspondientes, los permisos de seguridad y se publicarán los paneles interactivos.')) return;

      const btn = document.getElementById('btnAutoSetup');
      const prevHtml = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-1"></i> Creando Canales y Paneles...';

      try {
        const res = await fetch(\`/api/guilds/\${currentGuildId}/auto-setup-channels\`, { method: 'POST' });
        const data = await res.json();
        if (data.error) throw new Error(data.error);

        showToast('¡Auto-Setup completado! Canales creados y paneles publicados.');
        await loadSettings();
      } catch (err) {
        showToast(err.message, 'error');
      } finally {
        btn.disabled = false;
        btn.innerHTML = prevHtml;
      }
    }

    async function saveEnabledPlatforms(e) {
      e.preventDefault();
      const checkboxes = document.querySelectorAll('input[name="enabled_platforms"]:checked');
      const enabledProviders = Array.from(checkboxes).map(cb => cb.value);

      if (enabledProviders.length === 0) {
        showToast('Debes seleccionar al menos una página para este servidor.', 'error');
        return;
      }

      const btn = document.getElementById('btnSavePlatforms');
      const prevHtml = btn ? btn.innerHTML : '';
      if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-1"></i> Guardando...';
      }

      try {
        const res = await fetch(\`/api/guilds/\${currentGuildId}/config\`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ enabledProviders })
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);

        showToast('Páginas web actualizadas correctamente.');
        updateGeneratorProviderOptions(enabledProviders);
        updateModalResellerPlatforms(enabledProviders);
      } catch (err) {
        showToast(err.message, 'error');
      } finally {
        if (btn) {
          btn.disabled = false;
          btn.innerHTML = prevHtml;
        }
      }
    }

    function updateGeneratorProviderOptions(enabledList) {
      const select = document.getElementById('gen_provider');
      if (!select) return;

      const providerMap = {
        keyauth: 'KeyAuth (Elite Pro)',
        bypass: 'Bypass APK',
        bypass_uid: 'Bypass UID (Auto ON)',
        mycheats: 'WorldCheats (Panel VIP)'
      };

      const curVal = select.value;
      const valid = enabledList && enabledList.length > 0 ? enabledList : ['keyauth', 'bypass', 'bypass_uid', 'mycheats'];
      
      let html = '';
      valid.forEach(pid => {
        if (providerMap[pid]) {
          html += '<option value="' + pid + '">' + providerMap[pid] + '</option>';
        }
      });

      select.innerHTML = html;
      if (valid.includes(curVal)) {
        select.value = curVal;
      } else if (valid.length > 0) {
        select.value = valid[0];
      }
      handleGenProviderChange();
    }

    function updateModalResellerPlatforms(enabledList) {
      const valid = enabledList && enabledList.length > 0 ? enabledList : ['keyauth', 'bypass', 'bypass_uid', 'mycheats'];
      const checkboxes = document.querySelectorAll('.plat-checkbox');
      checkboxes.forEach(cb => {
        const parentLabel = cb.closest('label');
        if (parentLabel) {
          parentLabel.style.display = valid.includes(cb.value) ? '' : 'none';
        }
      });
    }

    async function submitCloneConfig() {
      const sourceSelect = document.getElementById('cfg_clone_sourceGuildId');
      const sourceGuildId = sourceSelect ? sourceSelect.value : null;

      if (!sourceGuildId) {
        showToast('Selecciona un servidor de origen válido.', 'error');
        return;
      }

      const sourceName = sourceSelect.options[sourceSelect.selectedIndex]?.text || sourceGuildId;
      if (!confirm('¿Estás seguro de clonar la configuración desde \"' + sourceName + '\"?\\n\\nSe copiarán canales, credenciales, plantilla de entrega y marca a este servidor.')) return;

      const btn = document.getElementById('btnCloneConfig');
      const prevHtml = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-1"></i> Clonando...';

      try {
        const res = await fetch(\`/api/guilds/\${currentGuildId}/clone-config\`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sourceGuildId })
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);

        showToast('Configuración clonada exitosamente.');
        await loadSettings();
      } catch (err) {
        showToast(err.message, 'error');
      } finally {
        btn.disabled = false;
        btn.innerHTML = prevHtml;
      }
    }

    async function saveBranding(e) {
      e.preventDefault();
      const branding = {
        embedColor: document.getElementById('cfg_branding_color').value.trim() || '#2563eb',
        defaultPrefix: document.getElementById('cfg_branding_prefix').value.trim() || 'VIP'
      };

      try {
        const res = await fetch(\`/api/guilds/\${currentGuildId}/config\`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ branding })
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        showToast('Personalización de marca guardada.');
      } catch (err) {
        showToast(err.message, 'error');
      }
    }

    async function loadAuditLogs() {
      const tbody = document.getElementById('audit-table-body');
      if (!tbody) return;
      tbody.innerHTML = '<tr><td colspan="4" class="py-6 text-center text-slate-500 font-sans"><i class="fa-solid fa-spinner fa-spin mr-2"></i>Cargando registros...</td></tr>';
      try {
        const res = await fetch(\`/api/guilds/\${currentGuildId}/audit-logs\`);
        const logs = await res.json();
        if (!Array.isArray(logs) || logs.length === 0) {
          tbody.innerHTML = '<tr><td colspan="4" class="py-6 text-center text-slate-500 font-sans">No hay registros de auditoría en este servidor aún.</td></tr>';
          return;
        }

        tbody.innerHTML = logs.map(l => {
          const dateStr = l.timestamp ? new Date(l.timestamp).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' }) : 'Reciente';
          return \`
            <tr class="hover:bg-slate-800/30 transition">
              <td class="py-3 px-4 text-slate-400 whitespace-nowrap">\${dateStr}</td>
              <td class="py-3 px-4">
                <span class="font-bold text-slate-200">\${l.operatorTag || 'Admin'}</span>
                \${l.operatorId ? '<span class="text-[10px] text-slate-500 block font-mono">' + l.operatorId + '</span>' : ''}
              </td>
              <td class="py-3 px-4">
                <span class="px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">\${l.action || 'CONFIG'}</span>
              </td>
              <td class="py-3 px-4 text-slate-300 font-sans text-xs">\${l.details || '-'}</td>
            </tr>
          \`;
        }).join('');
      } catch (err) {
        tbody.innerHTML = '<tr><td colspan="4" class="py-6 text-center text-red-400 font-sans">Error al cargar auditoría: ' + err.message + '</td></tr>';
      }
    }

    function updateTemplatePreview() {
      const store = document.getElementById('cfg_template_storeName')?.value.trim();
      const note = document.getElementById('cfg_template_noteText')?.value.trim() || 'Válida para 1 solo dispositivo.';
      const footer = document.getElementById('cfg_template_footerText')?.value.trim();

      const lines = [];
      if (store) lines.push('⭐ ' + store.toUpperCase() + ' ⭐');
      lines.push('🔑 Clave: Tryhard-3BxbSVFBhxP');
      lines.push('⏳ Duración: 30 Días');
      lines.push('📱 Plataforma: KeyAuth (Elite Pro)');
      lines.push('⚠️ Nota: ' + note);
      if (footer) lines.push('💬 ' + footer);

      const box = document.getElementById('templatePreviewBox');
      if (box) box.innerText = lines.join(String.fromCharCode(10));
    }

    async function saveCustomTemplate(e) {
      e.preventDefault();
      const customTemplate = {
        storeName: document.getElementById('cfg_template_storeName').value.trim(),
        noteText: document.getElementById('cfg_template_noteText').value.trim(),
        footerText: document.getElementById('cfg_template_footerText').value.trim(),
      };

      try {
        const res = await fetch('/api/guilds/' + currentGuildId + '/config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ customTemplate })
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        showToast('Plantilla de entrega guardada correctamente.');
      } catch (err) {
        showToast(err.message, 'error');
      }
    }

    async function saveChannels(e) {
      e.preventDefault();
      const channels = {
        panelChannelId: document.getElementById('cfg_panelChannelId').value.trim(),
        adminPanelChannelId: document.getElementById('cfg_adminPanelChannelId').value.trim(),
        logsChannelId: document.getElementById('cfg_logsChannelId').value.trim(),
        voiceChannelId: document.getElementById('cfg_voiceChannelId').value.trim(),
        alertRoleId: document.getElementById('cfg_alertRoleId').value.trim(),
      };

      try {
        const res = await fetch(\`/api/guilds/\${currentGuildId}/config\`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ channels })
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        showToast('Canales guardados exitosamente.');
      } catch (err) {
        showToast(err.message, 'error');
      }
    }

    async function saveProvidersConfig(e) {
      e.preventDefault();
      const providersConfig = {
        keyauth: { sellerKey: document.getElementById('cfg_keyauth_sellerKey').value.trim() },
        bypass: {
          username: document.getElementById('cfg_bypass_username').value.trim(),
          password: document.getElementById('cfg_bypass_password').value.trim(),
        },
        mycheats: {
          username: document.getElementById('cfg_mycheats_username').value.trim(),
          password: document.getElementById('cfg_mycheats_password').value.trim(),
        }
      };

      try {
        const res = await fetch(\`/api/guilds/\${currentGuildId}/config\`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ providersConfig })
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        showToast('Credenciales exclusivas guardadas.');
      } catch (err) {
        showToast(err.message, 'error');
      }
    }

    async function publishDiscordPanel(panelType) {
      if (!confirm(\`¿Publicar panel \${panelType} en el canal configurado de Discord?\`)) return;
      try {
        const endpoint = panelType === 'panel' ? 'publish-panel' : 'publish-admin-panel';
        const res = await fetch(\`/api/guilds/\${currentGuildId}/\${endpoint}\`, { method: 'POST' });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        showToast('Panel publicado exitosamente en Discord.');
      } catch (err) {
        showToast(err.message, 'error');
      }
    }

    async function triggerConnectVoice() {
      const btn = document.getElementById('btnConnectVoice');
      const prevHtml = btn ? btn.innerHTML : '';
      if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Conectando...';
      }
      try {
        const res = await fetch(\`/api/guilds/\${currentGuildId}/connect-voice\`, { method: 'POST' });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        showToast(\`Bot conectado exitosamente al canal de voz "\${data.channelName}" (24/7 activo).\`, 'success');
      } catch (err) {
        showToast(err.message, 'error');
      } finally {
        if (btn) {
          btn.disabled = false;
          btn.innerHTML = prevHtml;
        }
      }
    }

    async function loadAdmins() {
      const tbody = document.getElementById('admins-table-body');
      tbody.innerHTML = '<tr><td colspan="3" class="py-8 text-center text-slate-500 font-sans"><i class="fa-solid fa-spinner fa-spin mr-2"></i>Cargando administradores...</td></tr>';
      try {
        const res = await fetch(\`/api/guilds/\${currentGuildId}/admins\`);
        const data = await res.json();
        if (data.error) throw new Error(data.error);

        if (!data.admins || data.admins.length === 0) {
          tbody.innerHTML = '<tr><td colspan="3" class="py-8 text-center text-slate-500 font-sans">No hay administradores registrados aún.</td></tr>';
          return;
        }

        tbody.innerHTML = data.admins.map(adm => {
          const avatarUrl = adm.avatar || 'https://cdn.discordapp.com/embed/avatars/0.png';
          return \`
            <tr class="hover:bg-slate-800/30 transition">
              <td class="py-3 px-4">
                <div class="flex items-center gap-3">
                  <img src="\${avatarUrl}" class="w-8 h-8 rounded-full border border-slate-700 bg-slate-800 object-cover" />
                  <div>
                    <div class="font-sans font-bold text-white flex items-center gap-2">
                      \${adm.tag}
                      \${adm.isOwner ? '<span class="px-1.5 py-0.5 rounded text-[10px] bg-amber-500/20 text-amber-300 font-mono border border-amber-500/30">OWNER</span>' : ''}
                    </div>
                    <div class="text-[11px] text-slate-400 font-mono">\${adm.userId}</div>
                  </div>
                </div>
              </td>
              <td class="py-3 px-4">
                <span class="px-2 py-1 rounded-md text-xs font-sans font-medium \${adm.isOwner ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'bg-brand-500/10 text-brand-400 border border-brand-500/20'}">
                  \${adm.role}
                </span>
              </td>
              <td class="py-3 px-4 text-right">
                \${adm.canRemove ? \`
                  <button onclick="removeAdmin('\${adm.userId}')" class="px-2.5 py-1.5 bg-red-950/40 hover:bg-red-900/60 text-red-300 border border-red-800/50 rounded-lg text-xs font-sans font-medium transition flex items-center gap-1.5 ml-auto">
                    <i class="fa-solid fa-user-xmark"></i>
                    <span>Revocar</span>
                  </button>
                \` : \`
                  <span class="text-xs text-slate-500 font-sans italic">Inmutable</span>
                \`}
              </td>
            </tr>
          \`;
        }).join('');
      } catch (err) {
        tbody.innerHTML = \`<tr><td colspan="3" class="py-8 text-center text-red-400 font-sans">Error al cargar: \${err.message}</td></tr>\`;
      }
    }

    async function submitAddAdmin(e) {
      e.preventDefault();
      const input = document.getElementById('admin_user_input');
      const userId = input.value.trim();
      if (!userId) return;

      try {
        const res = await fetch(\`/api/guilds/\${currentGuildId}/admins\`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId })
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);

        input.value = '';
        showToast('Administrador autorizado exitosamente.');
        loadAdmins();
      } catch (err) {
        showToast(err.message, 'error');
      }
    }

    async function removeAdmin(userId) {
      if (!confirm(\`¿Estás seguro de revocar los permisos de administrador al usuario \${userId}?\`)) return;

      try {
        const res = await fetch(\`/api/guilds/\${currentGuildId}/admins/\${userId}\`, {
          method: 'DELETE'
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);

        showToast('Permisos de administrador revocados.');
        loadAdmins();
      } catch (err) {
        showToast(err.message, 'error');
      }
    }

    // Inicializar
    loadStats();
    loadHealth();
    handleGenProviderChange();
  </script>
</body>
</html>`;
}

module.exports = { renderDashboardPage };
