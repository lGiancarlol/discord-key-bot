const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

const commands = [
  new SlashCommandBuilder()
    .setName('panel')
    .setDescription('Publicar o actualizar el panel interactivo de licencias')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  new SlashCommandBuilder()
    .setName('permisos')
    .setDescription('Administrar permisos de acceso a las páginas y generadores')
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
        .addIntegerOption((opt) =>
          opt
            .setName('max_dias')
            .setDescription('Días máximos permitidos para generar (ej: 30)')
            .setRequired(false)
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
