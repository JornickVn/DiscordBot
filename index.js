const { Client, GatewayIntentBits, SlashCommandBuilder } = require("discord.js");
const { Player } = require("discord-player");
const { joinVoiceChannel } = require("@discordjs/voice");
const { useMainPlayer, useExtractor } = require("discord-player");
const { SpotifyExtractor, SoundCloudExtractor } = require("@discord-player/extractor");

const mainPlayer = useMainPlayer(); 
useExtractor(SoundCloudExtractor);
useExtractor(SpotifyExtractor);

require("dotenv").config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

const player = new Player(client);

// Registering Slash Commands
client.on("ready", async () => {
  console.log(`Logged in as ${client.user.tag}`);
  
  // Register the slash commands globally
  const commands = [
    new SlashCommandBuilder()
      .setName("play")
      .setDescription("Play a song")
      .addStringOption(option =>
        option.setName("query")
          .setDescription("The song or URL to play")
          .setRequired(true)),
    
    new SlashCommandBuilder()
      .setName("skip")
      .setDescription("Skip the current song"),
    
    new SlashCommandBuilder()
      .setName("stop")
      .setDescription("Stop the music and leave the voice channel")
  ]
  .map(command => command.toJSON());

  // Register commands to all guilds the bot is in
  await client.application.commands.set(commands);
});

// Slash Command Handler
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isCommand()) return;

  const { commandName, options, member, guild } = interaction;

  if (commandName === "play") {
    const query = options.getString("query");
    const channel = member.voice.channel;
    if (!channel) return interaction.reply("You need to join a voice channel first!");

    const queue = player.nodes.create(guild.id, {
      metadata: interaction.channel,
    });

    try {
      await queue.connect(channel);
    } catch {
      queue.delete();
      return interaction.reply("Failed to join the voice channel.");
    }

    const searchResult = await player.search(query, {
      requestedBy: member.user,
    });

    if (!searchResult.tracks.length) return interaction.reply("No results found.");

    queue.addTrack(searchResult.tracks[0]);

    if (!queue.isPlaying()) await queue.play();
    interaction.reply(`🎶 Now playing: **${searchResult.tracks[0].title}**`);
  }

  if (commandName === "skip") {
    const queue = player.nodes.get(guild.id);
    if (!queue || !queue.isPlaying()) return interaction.reply("No song is currently playing.");
    queue.node.skip();
    interaction.reply("⏭️ Skipped!");
  }

  if (commandName === "stop") {
    const queue = player.nodes.get(guild.id);
    if (!queue) return interaction.reply("No music is playing.");
    queue.delete();
    interaction.reply("🛑 Stopped and left the channel.");
  }
});

client.login(process.env.BOT_TOKEN);
