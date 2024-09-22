import { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } from 'discord.js';
import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();

// Create the client with appropriate intents
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds // Only need access to guilds for slash commands
  ]
});

// Register the slash command on bot startup
const commands = [
  new SlashCommandBuilder()
    .setName('mc')
    .setDescription('Fetch details for a specific MoonCat')
    .addIntegerOption(option => 
      option.setName('tokenid')
        .setDescription('The MoonCat token ID')
        .setRequired(true))
].map(command => command.toJSON());

// Register the slash command with Discord
const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

client.once('ready', async () => {
  try {
    console.log('Started refreshing application (/) commands.');

    await rest.put(
      Routes.applicationGuildCommands(client.user.id, process.env.GUILD_ID), // Replace GUILD_ID with your guild ID
      { body: commands }
    );

    console.log('Successfully reloaded application (/) commands.');
  } catch (error) {
    console.error(error);
  }
  console.log('Discord bot is ready!');
});

// Handle the slash command interaction
client.on('interactionCreate', async interaction => {
  if (!interaction.isCommand()) return;

  const { commandName, options } = interaction;

  if (commandName === 'mc') {
    const tokenId = options.getInteger('tokenid'); // Extract the token ID

    try {
      // Fetch MoonCat image URL and metadata
      const moonCatDetails = await getMoonCatNameOrId(tokenId);
      const imageUrl = await getMoonCatImageURL(tokenId);

      if (moonCatDetails && imageUrl) {
        const rescueIndex = moonCatDetails.details.rescueIndex;
        const hexId = moonCatDetails.details.catId; // Fetch hexId from 'details.catId'

        // Extract the name and strip "accessorized" part if it exists
        let name = moonCatDetails.details.name;
        if (name) {
          name = name.replace(" (accessorized)", ""); // Strip "accessorized"
        }

        // Set the title based on whether the cat is named or not
        const title = name ? `${name} (MoonCat #${rescueIndex})` : `MoonCat #${rescueIndex}: ${hexId}`;

        const chainStationLink = `https://chainstation.mooncatrescue.com/mooncats/${tokenId}`;

        // Send the response to Discord
        const embed = {
          color: 3447003,
          title: title,
          url: chainStationLink,
          image: { url: imageUrl }
        };
        await interaction.reply({ embeds: [embed] });
      } else {
        await interaction.reply(`Sorry, I couldn't find details for MoonCat with token ID: ${tokenId}`);
      }
    } catch (error) {
      console.error('Error fetching MoonCat details:', error);
      await interaction.reply('An error occurred while retrieving MoonCat details.');
    }
  }
});

// Log in to Discord with your bot token
client.login(process.env.DISCORD_TOKEN);

// Function to fetch the MoonCat's name or ID
async function getMoonCatNameOrId(tokenId) {
  console.log(`Fetching MoonCat name or ID for tokenId: ${tokenId}`);
  const tokenIdStr = tokenId.toString();
  const tokenIdHex = tokenIdStr.startsWith('0x') ? tokenIdStr.slice(2) : tokenIdStr;

  try {
    const response = await fetch(`https://api.mooncat.community/traits/${tokenIdHex}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch MoonCat details: ${response.statusText}`);
    }
    const data = await response.json();
    console.log(`Fetched MoonCat details for tokenId: ${tokenId}:`, data);
    return data;
  } catch (error) {
    console.error(`Error fetching MoonCat name or ID for token ${tokenIdHex}:`, error);
    return null;
  }
}

// Function to fetch the MoonCat's image URL
async function getMoonCatImageURL(tokenId) {
  console.log(`Fetching MoonCat image URL for tokenId: ${tokenId}`);
  try {
    const response = await fetch(`https://api.mooncat.community/regular-image/${tokenId}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch MoonCat image: ${response.statusText}`);
    }
    const imageUrl = response.url;
    console.log(`Fetched image URL for tokenId: ${tokenId}: ${imageUrl}`);
    return imageUrl;
  } catch (error) {
    console.error('Error fetching MoonCat image URL:', error);
    return null;
  }
}
