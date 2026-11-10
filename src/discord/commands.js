const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

const commands = [
  new SlashCommandBuilder()
    .setName('panel')
    .setDescription('Publicar o actualizar el panel interactivo de licencias')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  new SlashCommandBuilder()
    .setName('revendedor')
    .setDescription('Gestión de membresías y tiempos para revendedores')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((sub) =>
      sub
        .setName('asignar')
        .setDescription('Asignar o extender membresía en días a un revendedor')
        .addUserOption((opt) =>
          opt
            .setName('usuario')
            .setDescription('Usuario revendedor')
            .setRequired(true)
        )
        .addIntegerOption((opt) =>
          opt
            .setName('dias')
            .setDescription('Días de membresía (ej: 30)')
            .setRequired(true)
        )
        .addStringOption((opt) =>
          opt
            .setName('plataformas')
            .setDescription('Plataformas separadas por coma: bypass, bypass_uid, mycheats, keyauth o all')
            .setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('quitar')
        .setDescription('Quitar membresía de revendedor a un usuario')
        .addUserOption((opt) =>
          opt
            .setName('usuario')
            .setDescription('Usuario a remover')
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('info')
        .setDescription('Ver estado y tiempo restante de un revendedor')
        .addUserOption((opt) =>
          opt
            .setName('usuario')
            .setDescription('Usuario a consultar')
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('lista')
        .setDescription('Listar todos los revendedores y sus vencimientos')
    ),

  new SlashCommandBuilder()
    .setName('stock')
    .setDescription('Administrar stock de claves precargadas (ej: KeyAuth)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((sub) =>
      sub
        .setName('add')
        .setDescription('Cargar lote de claves al stock')
        .addStringOption((opt) =>
          opt
            .setName('proveedor')
            .setDescription('Plataforma del stock')
            .setRequired(true)
            .addChoices(
              { name: 'KeyAuth (Elite Pro)', value: 'keyauth' },
              { name: 'Bypass APK', value: 'bypass' },
              { name: 'Bypass UID (Auto ON)', value: 'bypass_uid' },
              { name: 'WorldCheats (Panel VIP)', value: 'mycheats' }
            )
        )
        .addStringOption((opt) =>
          opt
            .setName('claves')
            .setDescription('Claves separadas por coma, espacio o salto de línea')
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('list')
        .setDescription('Ver cantidad de claves disponibles en stock')
    ),

  new SlashCommandBuilder()
    .setName('mi-perfil')
    .setDescription('Ver tus días restantes de membresía y plataformas autorizadas'),

  new SlashCommandBuilder()
    .setName('mis-keys')
    .setDescription('Ver tu lista personal de licencias creadas y gestionar HWID'),

  new SlashCommandBuilder()
    .setName('permisos')
    .setDescription('Administrar permisos por rol o usuario (Legado)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((sub) =>
      sub
        .setName('asignar')
        .setDescription('Asignar permisos a un usuario o rol')
        .addMentionableOption((opt) =>
          opt
            .setName('destino')
            .setDescription('Usuario o Rol a quien dar permiso')
            .setRequired(true)
        )
        .addStringOption((opt) =>
          opt
            .setName('plataformas')
            .setDescription('Plataformas separadas por coma: bypass, mycheats, keyauth, all')
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('revocar')
        .setDescription('Revocar permisos a un usuario o rol')
        .addMentionableOption((opt) =>
          opt
            .setName('destino')
            .setDescription('Usuario o Rol a quien revocar')
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('listar')
        .setDescription('Listar todos los permisos activos configurados')
    ),

  new SlashCommandBuilder()
    .setName('stats')
    .setDescription('Ver estadísticas de keys generadas y estado de las APIs')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
];

module.exports = { commands };
