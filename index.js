const { Client, GatewayIntentBits, SlashCommandBuilder } = require("discord.js");
const { Player } = require("discord-player");
const { DefaultExtractors } = require("@discord-player/extractor");
require("dotenv").config();

// Create the Discord client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,    // Required for voice state updates
    GatewayIntentBits.GuildMessages,       // Required for reading messages
    GatewayIntentBits.MessageContent,      // Required to read message content
  ],
});

// Initialize the player
const player = new Player(client);

// Registering Slash Commands
client.on("ready", async () => {
  console.log(`Logged in as ${client.user.tag}`);
  
  // Load all standard extractors (YouTube, Spotify, SoundCloud, etc.)
  await player.extractors.loadMulti(DefaultExtractors);

  // Register the slash commands globally
  const commands = [
    new SlashCommandBuilder()
      .setName("play")
      .setDescription("Play a song")
      .addStringOption(option =>
        option.setName("query")
          .setDescription("The song name or URL to play")
          .setRequired(true)),
    
    new SlashCommandBuilder()
      .setName("skip")
      .setDescription("Skip the current song"),
    
    new SlashCommandBuilder()
      .setName("stop")
      .setDescription("Stop the music and leave the voice channel")
  ].map(command => command.toJSON());

  // Register commands to all guilds the bot is in
  await client.application.commands.set(commands);
});

// Slash Command Handler
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isCommand()) return;

  const { commandName, options, member, guild } = interaction;
  const channel = member.voice.channel;

  if (!channel) return interaction.reply("You need to join a voice channel first!");

  // --- PLAY COMMAND ---
  if (commandName === "play") {
    const query = options.getString("query");
    
    // We defer the reply because connecting and searching can take a few seconds.
    // If we don't do this, Discord will say "The application did not respond".
    await interaction.deferReply();

    try {
      // In discord-player v6, player.play() handles EVERYTHING:
      // It creates the queue, joins the channel, searches for the song, and plays it.
      const { track } = await player.play(channel, query, {
        nodeOptions: {
          metadata: interaction.channel, // Store the text channel so we can send updates
          leaveOnEmpty: true,
          leaveOnEmptyCooldown: 300000,  // Leave after 5 mins if empty
          leaveOnEnd: true,
          leaveOnEndCooldown: 300000,    // Leave 5 mins after the queue finishes
        }
      });

      return interaction.followUp(`🎶 Added **${track.title}** to the queue!`);
    } catch (error) {
      console.error(error);
      return interaction.followUp("Failed to play the track. YouTube might be blocking the request, or no results were found.");
    }
  }

  // --- SKIP COMMAND ---
  if (commandName === "skip") {
    // In v6, queues are accessed via player.nodes
    const queue = player.nodes.get(guild.id);
    if (!queue || !queue.isPlaying()) return interaction.reply("No song is currently playing.");
    
    queue.node.skip();
    return interaction.reply("⏭️ Skipped!");
  }

  // --- STOP COMMAND ---
  if (commandName === "stop") {
    const queue = player.nodes.get(guild.id);
    if (!queue) return interaction.reply("No music is playing.");
    
    // Destroying the queue makes the bot stop playing and leave
    queue.delete();
    return interaction.reply("🛑 Stopped and left the channel.");
  }
});

// Use your custom variable
client.login(process.env.BOT_TOKEN);