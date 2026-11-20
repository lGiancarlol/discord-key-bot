/**
 * Registro de Versión y Changelog del Despliegue
 * Cada vez que se actualiza el bot, este archivo describe detalladamente
 * las novedades, arreglos y mejoras que se anuncian en el canal de logs al encender.
 */
module.exports = {
  version: '2.5.1',
  build: '20261120_2',
  releaseDate: '2026-11-20',
  releaseTitle: '⚡ Auto-Recuperación de Sesiones, Multi-Suscripciones & Optimización de Código',
  highlights: [
    '🔄 **Auto-Recuperación y Keep-Alive (25 min):** Las sesiones web de MyCheats, Bypass y RealAuthX se renuevan y auto-reparan automáticamente sin necesidad de reiniciar el bot.',
    '👥 **Soporte Multi-Cuentas:** Posibilidad de configurar 2 o más cuentas independientes de la misma plataforma en un servidor (ej: MyCheats Cuenta 1 y Cuenta 2).',
    '🏷️ **KeyAuth Multi-App Stock:** Soporte para clasificar y reclamar stock de KeyAuth por juego/cuenta (ej: Free Fire, Warzone).',
    '🎯 **Multi-Suscripciones en MyCheats:** Ahora puedes seleccionar 1, 2, 3 o todas las suscripciones simultáneamente con casillas de verificación al crear un usuario.',
    '🧹 **Limpieza y Optimización:** Eliminación de dependencias obsoletas de Python (`keyauth_bridge.py`) y del comando legado `/permisos`.'
  ],
  categories: {
    agregado: [
      'Selección múltiple de suscripciones en WorldCheats (MyCheats).',
      'Soporte multi-cuentas por plataforma con credenciales y sesiones aisladas.',
      'Stock de KeyAuth clasificado por aplicación con menú selector interactivo.',
      'Sistema de Changelog automático en canal de logs al iniciar el bot.'
    ],
    arreglado: [
      'Error de sesión expirada y captcha en MyCheats y Bypass UID solucionado con auto-relogin y purga limpia de cookies.',
      'Títulos y campos de logs de auditoría 100% dinámicos con los nombres personalizados del servidor.'
    ],
    mejorado: [
      'Bucle Keep-Alive en segundo plano cada 25 minutos.',
      'Plantillas de entrega de WhatsApp con desglose de múltiples suscripciones combinadas.',
      'Ejecución de KeyAuth en Node.js puro sin procesos hijos de Python ni consumo innecesario de RAM.'
    ],
    eliminado: [
      'Puente de Python (`keyauth_bridge.py`) obsoleto retirado del repositorio.',
      'Comando legado `/permisos` retirado para unificar todo en `/revendedor`.'
    ]
  }
};
