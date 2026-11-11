const config = require('../../config');

function renderDashboardPage(user, guild, guildData, providersConfig) {
  const gId = guild.id;
  const gName = guild.name;
  const gIcon = guild.iconURL ? guild.iconURL() : null;

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
                <th class="py-3.5 px-4">Plataformas Asignadas</th>
                <th class="py-3.5 px-4">Asignado Por</th>
                <th class="py-3.5 px-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody id="resellers-table-body" class="divide-y divide-slate-800/60">
              <tr>
                <td colspan="5" class="py-8 text-center text-slate-500">Cargando revendedores...</td>
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

        <!-- Buscador de Claves -->
        <div class="w-full sm:w-72 relative">
          <span class="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
            <i class="fa-solid fa-magnifying-glass text-xs"></i>
          </span>
          <input type="text" id="searchKeysInput" placeholder="Buscar por clave, cliente o ID..." onkeyup="filterKeysTable()" class="w-full pl-9 pr-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-brand-500">
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
        <p class="text-xs text-slate-400 mt-0.5">Asigna los canales de Discord de este servidor y personaliza las credenciales de tus páginas de forma independiente.</p>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <!-- Canales de Discord -->
        <div class="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
          <h3 class="text-base font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
            <i class="fa-brands fa-discord text-[#5865F2]"></i> Canales de Discord
          </h3>

          <form id="formChannels" onsubmit="saveChannels(event)" class="space-y-4">
            <div>
              <label class="block text-xs font-medium text-slate-400 mb-1">ID Canal Panel de Licencias (Revendedores)</label>
              <input type="text" id="cfg_panelChannelId" placeholder="1569409213812187217" class="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm font-mono text-slate-200 focus:outline-none focus:border-brand-500">
            </div>

            <div>
              <label class="block text-xs font-medium text-slate-400 mb-1">ID Canal Panel de Control (Administradores con Botones)</label>
              <input type="text" id="cfg_adminPanelChannelId" placeholder="1569766838533886032" class="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm font-mono text-slate-200 focus:outline-none focus:border-brand-500">
            </div>

            <div>
              <label class="block text-xs font-medium text-slate-400 mb-1">ID Canal de Auditoría y Logs</label>
              <input type="text" id="cfg_logsChannelId" placeholder="1569409620563464263" class="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm font-mono text-slate-200 focus:outline-none focus:border-brand-500">
            </div>

            <div>
              <label class="block text-xs font-medium text-slate-400 mb-1">ID Canal de Voz 24/7</label>
              <input type="text" id="cfg_voiceChannelId" placeholder="1569408755085348927" class="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm font-mono text-slate-200 focus:outline-none focus:border-brand-500">
            </div>

            <button type="submit" class="flex items-center justify-center gap-2 px-5 py-2.5 bg-brand-600 hover:bg-brand-500 text-white font-medium text-sm rounded-xl transition">
              <i class="fa-solid fa-floppy-disk text-xs"></i>
              <span>Guardar Canales</span>
            </button>
          </form>

          <div class="pt-4 border-t border-slate-800 space-y-2">
            <span class="text-xs text-slate-400 block font-medium">Publicar Mensajes en Discord:</span>
            <div class="flex flex-wrap gap-2">
              <button onclick="publishDiscordPanel('panel')" class="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 rounded-lg border border-slate-700 transition">
                <i class="fa-solid fa-share-from-square"></i> Publicar Panel Licencias
              </button>
              <button onclick="publishDiscordPanel('admin-panel')" class="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 rounded-lg border border-slate-700 transition">
                <i class="fa-solid fa-sliders"></i> Publicar Panel Administrativo
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
          tbody.innerHTML = '<tr><td colspan="5" class="py-8 text-center text-slate-500">No hay revendedores registrados en este servidor. Haz clic en "Asignar Revendedor".</td></tr>';
          return;
        }

        tbody.innerHTML = list.map(r => {
          const isExp = r.isExpired;
          const statusBadge = isExp 
            ? '<span class="px-2 py-0.5 text-xs rounded-md bg-red-500/10 text-red-400 border border-red-500/20 font-medium">Expirado (0d)</span>'
            : \`<span class="px-2 py-0.5 text-xs rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">\${r.daysLeft} días restantes</span>\`;

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
        tbody.innerHTML = '<tr><td colspan="5" class="py-8 text-center text-red-400">Error al cargar revendedores.</td></tr>';
      }
    }

    // Modal Revendedor
    function openAddResellerModal() {
      document.getElementById('modalResellerTitle').innerText = 'Asignar Membresía a Revendedor';
      document.getElementById('modal_reseller_user').value = '';
      document.getElementById('modal_reseller_user').readOnly = false;
      document.getElementById('modal_reseller_days').value = '30';
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
          body: JSON.stringify({ userId, days, platforms })
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
      const q = document.getElementById('searchKeysInput').value.toLowerCase().trim();
      if (!q) {
        renderKeysTable(allKeysCache);
        return;
      }
      const filtered = allKeysCache.filter(k => 
        (k.key || '').toLowerCase().includes(q) ||
        (k.userId || '').toLowerCase().includes(q) ||
        (k.providerId || '').toLowerCase().includes(q) ||
        (k.note || '').toLowerCase().includes(q)
      );
      renderKeysTable(filtered);
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
        
        // Canales
        document.getElementById('cfg_panelChannelId').value = cfg.channels?.panelChannelId || '';
        document.getElementById('cfg_adminPanelChannelId').value = cfg.channels?.adminPanelChannelId || '';
        document.getElementById('cfg_logsChannelId').value = cfg.channels?.logsChannelId || '';
        document.getElementById('cfg_voiceChannelId').value = cfg.channels?.voiceChannelId || '';

        // Proveedores
        const prov = cfg.providersConfig || {};
        document.getElementById('cfg_keyauth_sellerKey').value = prov.keyauth?.sellerKey || '';
        document.getElementById('cfg_bypass_username').value = prov.bypass?.username || '';
        document.getElementById('cfg_bypass_password').value = prov.bypass?.password || '';
        document.getElementById('cfg_mycheats_username').value = prov.mycheats?.username || '';
        document.getElementById('cfg_mycheats_password').value = prov.mycheats?.password || '';
      } catch (err) {
        console.error('Error al cargar config:', err);
      }
    }

    async function saveChannels(e) {
      e.preventDefault();
      const channels = {
        panelChannelId: document.getElementById('cfg_panelChannelId').value.trim(),
        adminPanelChannelId: document.getElementById('cfg_adminPanelChannelId').value.trim(),
        logsChannelId: document.getElementById('cfg_logsChannelId').value.trim(),
        voiceChannelId: document.getElementById('cfg_voiceChannelId').value.trim(),
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
