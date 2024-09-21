import { Client, GatewayIntentBits } from 'discord.js';
import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds, // Access to guilds (servers)
    GatewayIntentBits.GuildMessages, // Access to guild messages
    GatewayIntentBits.MessageContent // Access to the content of the messages
  ]
});

client.once('ready', () => {
  console.log('Discord bot is ready!');
});

client.on('messageCreate', async (message) => {
  // Ignore messages from bots
  if (message.author.bot) return;

  // Ensure the message starts with '!'
  if (message.content.startsWith('!')) {
    const tokenId = message.content.slice(1);  // Extract the token ID from the message

    // Prevent duplicate responses
    if (!/^\d+$/.test(tokenId)) {
      return message.channel.send("Invalid token ID. Please enter a valid number.");
    }

    try {
      // Fetch MoonCat image URL and metadata
      const moonCatDetails = await getMoonCatNameOrId(tokenId);
      const imageUrl = await getMoonCatImageURL(tokenId);

      if (moonCatDetails && imageUrl) {
        const rescueIndex = moonCatDetails.details.rescueIndex;
        const hexId = moonCatDetails.catId; // Get hex ID from catId

        // Extract the name and strip the "accessorized" part if it exists
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
        await message.channel.send({ embeds: [embed] });
      } else {
        await message.channel.send(`Sorry, I couldn't find details for MoonCat with token ID: ${tokenId}`);
      }
    } catch (error) {
      console.error('Error fetching MoonCat details:', error);
      await message.channel.send('An error occurred while retrieving MoonCat details.');
    }
  }
});

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
