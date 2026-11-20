/**
 * Registro de Versión y Changelog del Despliegue
 * Cada vez que se actualiza el bot, este archivo describe detalladamente
 * las novedades, arreglos y mejoras que se anuncian en el canal de logs al encender.
 */
module.exports = {
  version: '2.5.0',
  build: '20261120',
  releaseDate: '2026-11-20',
  releaseTitle: '⚡ Auto-Recuperación de Sesiones, Multi-Cuentas & Multi-Suscripciones',
  highlights: [
    '🔄 **Auto-Recuperación y Keep-Alive (25 min):** Las sesiones web de MyCheats, Bypass y RealAuthX se renuevan y auto-reparan automáticamente sin necesidad de reiniciar el bot.',
    '👥 **Soporte Multi-Cuentas:** Posibilidad de configurar 2 o más cuentas independientes de la misma plataforma en un servidor (ej: MyCheats Cuenta 1 y Cuenta 2).',
    '🏷️ **KeyAuth Multi-App Stock:** Soporte para clasificar y reclamar stock de KeyAuth por juego/cuenta (ej: Free Fire, Warzone).',
    '🎯 **Multi-Suscripciones en MyCheats:** Ahora puedes seleccionar 1, 2, 3 o todas las suscripciones simultáneamente con casillas de verificación al crear un usuario.',
    '📋 **Registro Automático de Despliegues:** Anuncio visual y detallado en este canal de auditoría cada vez que el bot arranca con una nueva actualización.'
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
      'Plantillas de entrega de WhatsApp con desglose de múltiples suscripciones combinadas.'
    ]
  }
};
