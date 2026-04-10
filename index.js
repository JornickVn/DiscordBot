import { Client, GatewayIntentBits, SlashCommandBuilder } from "discord.js";
import { Player, QueryType } from "discord-player";
import extractorPkg from "@discord-player/extractor";
const { DefaultExtractors } = extractorPkg; // Removed the buggy Bridge settings!
import { YoutubeiExtractor } from "discord-player-youtubei";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

// Create the Discord client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// Initialize the player
const player = new Player(client);

// --- ERROR HANDLERS ---
player.events.on('error', (queue, error) => {
    console.log(`[Queue Error] ${error.message}`);
});
player.events.on('playerError', (queue, error) => {
    console.log(`[Audio Player Error] ${error.message}`);
});

// --- READY EVENT ---
client.once("clientReady", async () => {
  console.log(`Logged in as ${client.user.tag}`);
  
  // 1. Register YouTube (with TV bypass)
  await player.extractors.register(YoutubeiExtractor, {
    streamOptions: { useClient: 'TV_EMBEDDED' }
  });

  // 2. Load the rest of the stable extractors
  await player.extractors.loadMulti(DefaultExtractors);

  // --- REGISTER COMMANDS ---
  const commands = [
    new SlashCommandBuilder()
      .setName("playyt")
      .setDescription("Play a song from YouTube (May be blocked)")
      .addStringOption(option => option.setName("query").setDescription("YouTube URL or search term").setRequired(true)),
    
    new SlashCommandBuilder()
      .setName("playspot")
      .setDescription("Play a song from Spotify (Bridged via SoundCloud)")
      .addStringOption(option => option.setName("query").setDescription("Spotify URL or search term").setRequired(true)),
        
    new SlashCommandBuilder()
      .setName("playsc")
      .setDescription("Play a song from SoundCloud (Most Stable!)")
      .addStringOption(option => option.setName("query").setDescription("SoundCloud URL or search term").setRequired(true)),
    
    new SlashCommandBuilder().setName("skip").setDescription("Skip the current song"),
    new SlashCommandBuilder().setName("stop").setDescription("Stop the music and leave the voice channel")
  ].map(command => command.toJSON());

  await client.application.commands.set(commands);
  console.log("Commands registered and extractors loaded!");
});

// --- COMMAND HANDLER ---
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isCommand()) return;

  const { commandName, options, member, guild } = interaction;
  const channel = member.voice.channel;

  if (!channel) return interaction.reply("You need to join a voice channel first!");

  // --- MUSIC PLAYING COMMANDS ---
  if (["playyt", "playspot", "playsc"].includes(commandName)) {
    let query = options.getString("query");
    await interaction.deferReply();

    // FIX 1: Clean up messy SoundCloud tracking links
    if (query.includes("soundcloud.com") && query.includes("?")) {
        query = query.split("?")[0]; // Cuts off the ?utm_source junk
    }

    let searchEngine = QueryType.AUTO;
    const isUrl = query.startsWith("http://") || query.startsWith("https://");

    // FIX 2: The Manual Spotify Bridge
    if (commandName === "playspot") {
        if (query.includes("spotify.com")) {
            // Secretly read the Spotify link
            const spotResult = await player.search(query, { searchEngine: QueryType.SPOTIFY_SEARCH });
            if (spotResult.tracks.length > 0) {
                // Delete the link and turn it into pure text (e.g., "Fukashigi no Carte Mai Sakurajima")
                query = `${spotResult.tracks[0].title} ${spotResult.tracks[0].author}`;
            }
        }
        // Force the engine to search SoundCloud for that exact text
        searchEngine = QueryType.SOUNDCLOUD_SEARCH;
    } 
    else if (commandName === "playsc") {
        searchEngine = isUrl ? QueryType.AUTO : QueryType.SOUNDCLOUD_SEARCH;
    } 
    else if (commandName === "playyt") {
        searchEngine = isUrl ? QueryType.AUTO : QueryType.YOUTUBE_SEARCH;
    }

    try {
      const { track } = await player.play(channel, query, {
        searchEngine: searchEngine,
        nodeOptions: {
          metadata: interaction.channel,
          leaveOnEmpty: true,
          leaveOnEmptyCooldown: 300000,
          leaveOnEnd: true,
          leaveOnEndCooldown: 300000,
        }
      });

      return interaction.followUp(`🎶 Added **${track.title}** to the queue!`);
    } catch (error) {
      console.error(error);
      return interaction.followUp("❌ Failed to play the track. If you used `/playyt`, YouTube is likely blocking the connection.");
    }
  }

  // --- SKIP COMMAND ---
  if (commandName === "skip") {
    const queue = player.nodes.get(guild.id);
    if (!queue || !queue.isPlaying()) return interaction.reply("No song is currently playing.");
    queue.node.skip();
    return interaction.reply("⏭️ Skipped!");
  }

  // --- STOP COMMAND ---
  if (commandName === "stop") {
    const queue = player.nodes.get(guild.id);
    if (!queue) return interaction.reply("No music is playing.");
    queue.delete();
    return interaction.reply("🛑 Stopped and left the channel.");
  }
});

client.login(process.env.BOT_TOKEN);