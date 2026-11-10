function renderLoginPage(errorMessage = '') {
  return `<!DOCTYPE html>
<html lang="es" class="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Auth Cloud Gateway • Iniciar Sesión</title>
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
</head>
<body class="bg-slate-950 text-slate-100 min-h-screen flex items-center justify-center p-4 selection:bg-brand-500 selection:text-white">
  
  <div class="w-full max-w-md">
    <!-- Card Principal -->
    <div class="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-8 backdrop-blur-xl relative overflow-hidden">
      <!-- Glow superior -->
      <div class="absolute -top-24 -left-24 w-48 h-48 bg-brand-600/20 rounded-full blur-3xl pointer-events-none"></div>
      <div class="absolute -bottom-24 -right-24 w-48 h-48 bg-purple-600/20 rounded-full blur-3xl pointer-events-none"></div>

      <!-- Logo & Título -->
      <div class="text-center mb-8 relative z-10">
        <div class="w-16 h-16 bg-gradient-to-tr from-brand-600 to-indigo-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-brand-500/20">
          <i class="fa-solid fa-shield-halved text-2xl text-white"></i>
        </div>
        <h1 class="text-2xl font-bold tracking-tight text-white">Auth Cloud Gateway</h1>
        <p class="text-slate-400 text-sm mt-1">Panel de Control & Distribución Multi-Servidor</p>
      </div>

      ${errorMessage ? `
      <div class="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm flex items-center gap-3">
        <i class="fa-solid fa-triangle-exclamation"></i>
        <span>${errorMessage}</span>
      </div>
      ` : ''}

      <!-- Botón Iniciar con Discord -->
      <div class="space-y-4 relative z-10">
        <a href="/auth/discord" class="w-full flex items-center justify-center gap-3 px-6 py-3.5 bg-[#5865F2] hover:bg-[#4752C4] text-white font-medium rounded-xl transition duration-200 shadow-lg shadow-[#5865F2]/25">
          <i class="fa-brands fa-discord text-xl"></i>
          <span>Continuar con Discord</span>
        </a>

        <div class="relative flex items-center justify-center my-6">
          <div class="border-t border-slate-800 w-full"></div>
          <span class="bg-slate-900 px-3 text-xs text-slate-500 uppercase tracking-wider">o ingresar como</span>
          <div class="border-t border-slate-800 w-full"></div>
        </div>

        <!-- Formulario Acceso Maestro -->
        <form action="/login/admin" method="POST" class="space-y-4">
          <div>
            <label class="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wider">Contraseña Maestra de Administrador</label>
            <div class="relative">
              <span class="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                <i class="fa-solid fa-key"></i>
              </span>
              <input type="password" name="password" required placeholder="••••••••••••" class="w-full pl-10 pr-4 py-2.5 bg-slate-950/70 border border-slate-800 rounded-xl focus:border-brand-500 focus:ring-1 focus:ring-brand-500 text-sm placeholder-slate-600 text-white outline-none transition">
            </div>
          </div>
          <button type="submit" class="w-full flex items-center justify-center gap-2 px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-medium rounded-xl text-sm transition duration-150 border border-slate-700/60">
            <i class="fa-solid fa-lock text-xs"></i>
            <span>Acceso Maestro Directo</span>
          </button>
        </form>
      </div>

      <!-- Pie de página de tarjeta -->
      <div class="mt-8 pt-6 border-t border-slate-800/80 text-center text-xs text-slate-500">
        <p>Sistema protegido con aislamiento multi-inquilino v2.4</p>
      </div>
    </div>
  </div>

</body>
</html>`;
}

module.exports = { renderLoginPage };
