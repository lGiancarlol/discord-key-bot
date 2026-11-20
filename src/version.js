/**
 * Registro de Versión y Novedades del Último Despliegue
 * Este archivo contiene ÚNICAMENTE los cambios realizados en el deploy actual.
 */
module.exports = {
  version: '2.5.2',
  build: '20261120_1415',
  releaseDate: '2026-11-20',
  releaseTitle: '🧹 Depuración de Código & Optimización de Rendimiento',
  highlights: [
    '🗑️ **KeyAuth 100% Nativo:** Retirado el script puente de Python (`keyauth_bridge.py`). Ahora KeyAuth corre en Node.js puro sin dependencias externas ni consumo innecesario de RAM en Sparked Host.',
    '🗑️ **Unificación de Comandos:** Retirado el comando legado `/permisos` para evitar confusiones y unificar toda la administración en `/revendedor` y el Panel Web.',
    '📋 **Novedades Exclusivas por Deploy:** Los logs de inicio ahora muestran única y exclusivamente las novedades del último deploy subido, sin acumular cambios anteriores.'
  ],
  categories: {
    agregado: [],
    arreglado: [
      'El anuncio de inicio en logs ahora muestra única y exclusivamente los cambios del último despliegue subido.'
    ],
    mejorado: [
      'Rendimiento y velocidad de respuesta de KeyAuth al operar 100% nativo en Node.js.',
      'Formato del embed de despliegue en logs: solo muestra las categorías que tuvieron cambios reales.'
    ],
    eliminado: [
      'Puente de Python (`keyauth_bridge.py`) y llamadas a subprocesos hijos (`child_process`).',
      'Comando legado `/permisos`.'
    ]
  }
};
