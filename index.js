const { Client, GatewayIntentBits, SlashCommandBuilder } = require("discord.js");
const { Player } = require("discord-player");
const { SpotifyExtractor, SoundCloudExtractor } = require("@discord-player/extractor");
require("dotenv").config();

// Create the Discord client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,    // Required for voice state updates
    GatewayIntentBits.GuildMessages,       // Required for reading messages
    GatewayIntentBits.MessageContent,      // Required to read message content (important for newer versions)
    GatewayIntentBits.GuildMembers,        // Required for tracking members joining/leaving
  ],
});

// Initialize the player
const player = new Player(client);

// Register the extractors
player.extractors.register(SpotifyExtractor);
player.extractors.register(SoundCloudExtractor);

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
  
    // Create or get the music queue for the guild
    const queue = player.getQueue(guild.id);
    
    if (!queue) {
      // Create the queue if it doesn't exist
      queue = player.createQueue(guild.id, {
        metadata: interaction.channel,
      });
    }
  
    try {
      await queue.connect(channel);
    } catch (error) {
      queue.destroy();
      return interaction.reply("Failed to join the voice channel.");
    }
  
    let searchResult;
    if (query.includes("soundcloud.com")) {
      // For SoundCloud URLs, force search to use SoundCloud extractor
      searchResult = await player.search(query, {
        requestedBy: member.user,
        searchEngine: "soundcloud",
      });
    } else if (query.includes("youtube.com")) {
      // For YouTube URLs, force search to use YouTube extractor
      searchResult = await player.search(query, {
        requestedBy: member.user,
        searchEngine: "youtube",
      });
    } else {
      // Default search (for non-URL queries)
      searchResult = await player.search(query, {
        requestedBy: member.user,
      });
    }
  
    console.log(searchResult); // Log the search result for debugging
  
    if (!searchResult.tracks.length) {
      return interaction.reply("No results found.");
    }
  
    queue.addTrack(searchResult.tracks[0]);
  
    if (!queue.isPlaying()) await queue.play();
    interaction.reply(`🎶 Now playing: **${searchResult.tracks[0].title}**`);
  }

  if (commandName === "skip") {
    const queue = player.getQueue(guild.id);
    if (!queue || !queue.isPlaying()) return interaction.reply("No song is currently playing.");
    
    // Skip the current song
    queue.skip();
    interaction.reply("⏭️ Skipped!");
  }

  if (commandName === "stop") {
    const queue = player.getQueue(guild.id);
    if (!queue) return interaction.reply("No music is playing.");
    
    // Stop the music and leave the voice channel
    queue.destroy();
    interaction.reply("🛑 Stopped and left the channel.");
  }
});

client.login(process.env.BOT_TOKEN);
