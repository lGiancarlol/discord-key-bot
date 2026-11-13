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
    <div class="bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl p-8 backdrop-blur-xl relative overflow-hidden">
      <!-- Glow superior -->
      <div class="absolute -top-24 -left-24 w-48 h-48 bg-brand-600/20 rounded-full blur-3xl pointer-events-none"></div>
      <div class="absolute -bottom-24 -right-24 w-48 h-48 bg-[#5865F2]/20 rounded-full blur-3xl pointer-events-none"></div>

      <!-- Logo & Título -->
      <div class="text-center mb-8 relative z-10">
        <div class="w-16 h-16 bg-gradient-to-tr from-[#5865F2] to-brand-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-xl shadow-[#5865F2]/25">
          <i class="fa-solid fa-shield-halved text-2xl text-white"></i>
        </div>
        <h1 class="text-2xl font-extrabold tracking-tight text-white">Auth Cloud Gateway</h1>
        <p class="text-slate-400 text-xs mt-1.5">Panel Administrativo Exclusivo con Autenticación de Discord</p>
      </div>

      ${errorMessage ? `
      <div class="mb-6 p-4 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-start gap-3">
        <i class="fa-solid fa-circle-exclamation text-red-400 text-base mt-0.5"></i>
        <div class="flex-1 leading-relaxed">
          <span class="font-bold block text-red-400 mb-0.5">Acceso no autorizado</span>
          <span>${errorMessage}</span>
        </div>
      </div>
      ` : ''}

      <!-- Botón Iniciar con Discord -->
      <div class="space-y-4 relative z-10">
        <a href="/auth/discord" class="w-full flex items-center justify-center gap-3 px-6 py-4 bg-[#5865F2] hover:bg-[#4752C4] text-white font-semibold rounded-2xl transition duration-200 shadow-xl shadow-[#5865F2]/30 text-base">
          <i class="fa-brands fa-discord text-2xl"></i>
          <span>Iniciar Sesión con Discord</span>
        </a>

        <div class="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80 text-center">
          <p class="text-xs text-slate-400 leading-relaxed">
            <i class="fa-solid fa-lock text-brand-400 mr-1.5"></i>
            Acceso privado y restringido. Solo el <strong>Dueño del Bot</strong> y cuentas de Discord autorizadas expresamente por ID tienen acceso a este panel.
          </p>
        </div>
      </div>

      <!-- Pie de página de tarjeta -->
      <div class="mt-8 pt-6 border-t border-slate-800/80 text-center text-xs text-slate-500">
        <p>Sistema protegido con autorización centralizada v2.4</p>
      </div>
    </div>
  </div>

</body>
</html>`;
}

module.exports = { renderLoginPage };
