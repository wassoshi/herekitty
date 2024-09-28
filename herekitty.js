import { AlchemyProvider, Contract } from 'ethers';
import fetch from 'node-fetch';
import { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } from 'discord.js';
import dotenv from 'dotenv';

dotenv.config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds
  ]
});

const commands = [
  new SlashCommandBuilder()
    .setName('mc')
    .setDescription('Fetch details for a specific MoonCat')
    .addIntegerOption(option => 
      option.setName('tokenid')
        .setDescription('The MoonCat token ID')
        .setRequired(true)),
  new SlashCommandBuilder()
    .setName('dna')
    .setDescription('Fetch DNA image for a specific token')
    .addIntegerOption(option => 
      option.setName('tokenid')
        .setDescription('The token ID for the DNA image')
        .setRequired(true)),
  new SlashCommandBuilder()
    .setName('wrp')
    .setDescription('Fetch rescue index from old wrapper token ID')
    .addIntegerOption(option => 
      option.setName('tokenid')
        .setDescription('The old wrapper token ID')
        .setRequired(true))
].map(command => command.toJSON());

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

client.once('ready', async () => {
  try {
    await rest.put(
      Routes.applicationGuildCommands(client.user.id, process.env.GUILD_ID),
      { body: commands }
    );
  } catch (error) {
    console.error(error);
  }
  console.log('Discord bot is ready!');
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isCommand()) return;

  const { commandName, options } = interaction;

  if (commandName === 'mc') {
    const tokenId = options.getInteger('tokenid');

    try {
      const moonCatDetails = await getMoonCatNameOrId(tokenId);
      const imageUrl = await getMoonCatImageURL(tokenId);

      if (moonCatDetails && imageUrl) {
        const rescueIndex = moonCatDetails.details.rescueIndex;
        const hexId = moonCatDetails.details.catId;

        let name = moonCatDetails.details.name;
        if (name) {
          name = name.replace(" (accessorized)", "");
        }

        const title = name ? `${name}: MoonCat #${rescueIndex}` : `MoonCat #${rescueIndex}: ${hexId}`;

        const chainStationLink = `https://chainstation.mooncatrescue.com/mooncats/${tokenId}`;

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

  if (commandName === 'dna') {
    const tokenId = options.getInteger('tokenid');

    try {
      const dnaImageUrl = await getDNAImageURL(tokenId);

      if (dnaImageUrl) {
        const embed = {
          image: { url: dnaImageUrl }
        };
        await interaction.reply({ embeds: [embed] });
      } else {
        await interaction.reply(`Sorry, I couldn't fetch the DNA image for token ID: ${tokenId}`);
      }
    } catch (error) {
      console.error('Error fetching DNA image URL:', error);
      await interaction.reply('An error occurred while retrieving the DNA image.');
    }
  }

  if (commandName === 'wrp') {
    const tokenId = options.getInteger('tokenid');

    try {
      const rescueIndex = await getRescueIndexFromWrapper(tokenId);

      if (rescueIndex) {
        await interaction.reply(`Rescue Index: ${rescueIndex}`);
      } else {
        await interaction.reply('Could not fetch rescue index.');
      }
    } catch (error) {
      console.error('Error fetching rescue index from wrapper token:', error);
      await interaction.reply('An error occurred while retrieving the rescue index.');
    }
  }
});

client.login(process.env.DISCORD_TOKEN);

async function getRescueIndexFromWrapper(tokenId) {
  const provider = new AlchemyProvider('homestead', process.env.ALCHEMY_API_KEY);
  const OLD_WRAPPER_CONTRACT_ADDRESS = '0x7c40c393dc0f283f318791d746d894ddd3693572';
  const OLD_WRAPPER_CONTRACT_ABI = [
    {
      "inputs": [{ "internalType": "uint256", "name": "tokenId", "type": "uint256" }],
      "name": "_tokenIDToCatID",
      "outputs": [{ "internalType": "bytes5", "name": "", "type": "bytes5" }],
      "stateMutability": "view",
      "type": "function"
    }
  ];
  const contract = new Contract(OLD_WRAPPER_CONTRACT_ADDRESS, OLD_WRAPPER_CONTRACT_ABI, provider);

  try {
    const realTokenIdHex = await contract._tokenIDToCatID(tokenId);  // Fetch the real token ID (catId)
    const rescueIndex = await fetchRescueIndex(realTokenIdHex);       // Fetch the rescue index
    return rescueIndex;
  } catch (error) {
    console.error(`Error fetching real token ID for wrapped token ${tokenId}:`, error);
    return null;
  }
}

async function fetchRescueIndex(realTokenIdHex) {
  try {
    const response = await fetch(`https://api.mooncat.community/traits/${realTokenIdHex}`); // Fetch the details
    if (!response.ok) {
      throw new Error(`Failed to fetch MoonCat details: ${response.statusText}`);
    }
    const data = await response.json();
    return data.details.rescueIndex;  // Return the rescue index
  } catch (error) {
    console.error('Error fetching rescue index:', error);
    return null;
  }
}

async function getMoonCatNameOrId(tokenId) {
  const tokenIdStr = tokenId.toString();
  const tokenIdHex = tokenIdStr.startsWith('0x') ? tokenIdStr.slice(2) : tokenIdStr;

  try {
    const response = await fetch(`https://api.mooncat.community/traits/${tokenIdHex}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch MoonCat details: ${response.statusText}`);
    }
    const data = await response.json();
    return data;
  } catch (error) {
    return null;
  }
}

async function getMoonCatImageURL(tokenId) {
  try {
    const response = await fetch(`https://api.mooncat.community/regular-image/${tokenId}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch MoonCat image: ${response.statusText}`);
    }
    const imageUrl = response.url;
    return imageUrl;
  } catch (error) {
    return null;
  }
}

async function getDNAImageURL(tokenId) {
  try {
    const dnaUrl = `https://ipfs.io/ipfs/bafybeicp3ke3rrhakwlre4gexzcjx7uxotvtscda7kz3wdbkxa5usrbmwu/${tokenId}.png`;
    return dnaUrl;
  } catch (error) {
    return null;
  }
}
