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
    .setName('mcacc')
    .setDescription('Fetch accessorized image for a specific MoonCat')
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
    .setName('acc')
    .setDescription('Fetch a random MoonCat with a specified accessory')
    .addIntegerOption(option => 
      option.setName('accessoryid')
        .setDescription('The accessory ID')
        .setRequired(true)),
  new SlashCommandBuilder()
    .setName('wrp')
    .setDescription('Fetch rescue index from old wrapper token ID')
    .addIntegerOption(option => 
      option.setName('tokenid')
        .setDescription('The old wrapper token ID')
        .setRequired(true)),
  new SlashCommandBuilder()
    .setName('accsale')
    .setDescription('Check which MoonCats with a specific accessory are listed for sale')
    .addIntegerOption(option => 
      option.setName('accessoryid')
        .setDescription('The accessory ID')
        .setRequired(true))
].map(command => command.toJSON());

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

client.once('ready', async () => {
  try {
    await rest.put(
      Routes.applicationCommands(client.user.id),
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

  try {
    await interaction.deferReply();

    if (commandName === 'mc') {
      const tokenId = options.getInteger('tokenid');
      const moonCatDetails = await getMoonCatNameOrId(tokenId);
      const imageUrl = await getMoonCatImageURL(tokenId);

      if (moonCatDetails && imageUrl) {
        const rescueIndex = moonCatDetails.details.rescueIndex;
        const hexId = moonCatDetails.details.catId;

        let name = moonCatDetails.details.name;
        if (name) {
          name = name.replace(" (accessorized)", "");
        }

        const title = name ? `MoonCat #${rescueIndex}: ${name}` : `MoonCat #${rescueIndex}: ${hexId}`;

        const chainStationLink = `https://chainstation.mooncatrescue.com/mooncats/${tokenId}`;

        const embed = {
          color: 3447003,
          title: title,
          url: chainStationLink,
          image: { url: imageUrl }
        };
        await interaction.editReply({ embeds: [embed] });
      } else {
        await interaction.editReply(`Sorry, I couldn't find details for MoonCat with token ID: ${tokenId}`);
      }
    }

    if (commandName === 'mcacc') {
      const tokenId = options.getInteger('tokenid');
      const moonCatDetails = await getMoonCatNameOrId(tokenId);
      const accessorizedImageUrl = `https://api.mooncat.community/accessorized-image/${tokenId}.png`;

      if (moonCatDetails) {
        const rescueIndex = moonCatDetails.details.rescueIndex;
        const hexId = moonCatDetails.details.catId;

        let name = moonCatDetails.details.name;
        if (name) {
          name = name.replace(" (accessorized)", "");
        }

        const title = name ? `MoonCat #${rescueIndex}: ${name}` : `MoonCat #${rescueIndex}: ${hexId}`;

        const chainStationLink = `https://chainstation.mooncatrescue.com/mooncats/${tokenId}`;

        const embed = {
          color: 3447003,
          title: title,
          url: chainStationLink,
          image: { url: accessorizedImageUrl }
        };
        await interaction.editReply({ embeds: [embed] });
      } else {
        await interaction.editReply(`Sorry, I couldn't find details for MoonCat with token ID: ${tokenId}`);
      }
    }

    if (commandName === 'acc') {
      const accessoryId = options.getInteger('accessoryid');
      
      const accessoryDetails = await fetchAccessoryDetails(accessoryId);

      if (!accessoryDetails) {
        await interaction.editReply(`Could not fetch accessory details for accessory ID: ${accessoryId}`);
        return;
      }

      console.log("Accessory Details: ", accessoryDetails);
      console.log("OwnedBy List: ", accessoryDetails.ownedBy);

      const ownersList = accessoryDetails.ownedBy?.list;
      console.log("Owners List: ", ownersList);

      if (ownersList && ownersList.length > 0) {
        const randomIndex = Math.floor(Math.random() * ownersList.length);
        const randomMoonCatId = ownersList[randomIndex].rescueOrder;

        console.log(`Selected MoonCat ID: ${randomMoonCatId} for Accessory ID: ${accessoryId}`);


        const accessorizedImageUrl = `https://api.mooncat.community/image/${randomMoonCatId}?costumes=true&acc=${accessoryId}`;

        const chainStationLink = `https://chainstation.mooncatrescue.com/accessories/${accessoryId}`;

        const embed = {
          color: 3447003,
          title: `Accessory #${accessoryId}: ${accessoryDetails.name}`,
          url: chainStationLink,
          image: { url: accessorizedImageUrl }
        };

        await interaction.editReply({ embeds: [embed] });
      } else {
        console.log("Fallback: No MoonCats own this accessory");
        const accessorizedImageUrl = `https://api.mooncat.community/accessory-image/${accessoryId}.png`;
        const chainStationLink = `https://chainstation.mooncatrescue.com/accessories/${accessoryId}`;

        const embed = {
          color: 3447003,
          title: `Accessory #${accessoryId}: ${accessoryDetails.name}`,
          url: chainStationLink,
          image: { url: accessorizedImageUrl }
        };

        await interaction.editReply({ embeds: [embed] });
      }
    }

    if (commandName === 'accsale') {
      const accessoryId = options.getInteger('accessoryid');
      console.log(`Fetching details for accessory ID: ${accessoryId}`);
      const accessoryDetails = await fetchAccessoryDetails(accessoryId);

      if (!accessoryDetails) {
      console.log(`Could not fetch accessory details for accessory ID: ${accessoryId}`);
        await interaction.editReply(`Could not fetch accessory details for accessory ID: ${accessoryId}`);
        return;
      }
      
      console.log(`Accessory Details for ID ${accessoryId}:`, accessoryDetails);
      const moonCatOwners = accessoryDetails.ownedBy?.list;
      console.log(`MoonCat owners with this accessory (${accessoryId}):`, moonCatOwners);

      if (!moonCatOwners || moonCatOwners.length === 0) {
        await interaction.editReply(`No MoonCats found with accessory ID: ${accessoryId}`);
        return;
      }
      
      moonCatOwners.forEach(owner => {
        console.log(`MoonCat with rescue order ${owner.rescueOrder} owns accessory ID: ${accessoryId}`);
      });

      console.log(`Checking OpenSea listings for MoonCats with accessory ID: ${accessoryId}`);
      const listings = await Promise.all(moonCatOwners.map(owner => checkMoonCatListing(owner.rescueOrder)));

      listings.forEach(listing => {
        console.log(`Listing for MoonCat #${listing.tokenId}:`, listing);
      });

      const activeListings = listings.filter(listing => listing.isActive);

      if (activeListings.length > 0) {
        const listingMessages = activeListings.map(listing => `MoonCat #${listing.tokenId} is listed for ${listing.price} ETH: ${listing.url}`);

        console.log(`Active listings found:`, listingMessages);

        await interaction.editReply(listingMessages.join('\n'));
      } else {
        console.log(`No active listings found for MoonCats with accessory ID: ${accessoryId}`);
        await interaction.editReply(`None of the MoonCats with this accessory are currently listed for sale.`);
      }
    }


    if (commandName === 'dna') {
      const tokenId = options.getInteger('tokenid');
      const moonCatDetails = await getMoonCatNameOrId(tokenId);
      const dnaImageUrl = await getDNAImageURL(tokenId);

      if (dnaImageUrl) {
        let name = moonCatDetails?.details?.name || null;
        const hexId = moonCatDetails?.details?.catId || tokenId;

        if (name) {
          name = name.replace(" (accessorized)", "");
        }

        const title = `MoonCat #${tokenId}:`;
        const clickableText = name ? `[${name}](${dnaImageUrl})` : `[${hexId}](${dnaImageUrl})`;

        const message = `${title} ${clickableText}`;

        await interaction.editReply({ content: message });
      } else {
        await interaction.editReply(`Sorry, I couldn't fetch the DNA image for MoonCat with token ID: ${tokenId}`);
      }
    }

    if (commandName === 'wrp') {
      const tokenId = options.getInteger('tokenid');
      const rescueIndex = await getRescueIndexFromWrapper(tokenId);

      if (rescueIndex) {
        await interaction.editReply(`Old-wrapped token ID ${tokenId} is Rescue Order ${rescueIndex}`);
      } else {
        await interaction.editReply('Could not fetch rescue index.');
      }
    }
  } catch (error) {
    console.error('Error handling interaction:', error);
    await interaction.editReply('An error occurred while processing the command.');
  }
});

client.login(process.env.DISCORD_TOKEN);

async function fetchAccessoryDetails(accessoryId) {
  try {
    const response = await fetch(`https://api.mooncatrescue.com/accessory/traits/${accessoryId}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch accessory details: ${response.statusText}`);
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching accessory details:', error);
    return null;
  }
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function checkMoonCatListing(tokenId, delayBetweenCalls = 100) {
  await delay(delayBetweenCalls);
  
  try {
    const response = await fetch(`https://api.opensea.io/api/v2/events/chain/ethereum/contract/0xc3f733ca98E0daD0386979Eb96fb1722A1A05E69/nfts/${tokenId}?event_type=listing`, {
      headers: {
        'accept': 'application/json',
        'x-api-key': process.env.OPENSEA_API_KEY
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch OpenSea listings for tokenId ${tokenId}`);
    }

    const data = await response.json();
    const events = data.asset_events;

    if (events.length === 0) {
      console.log(`No events found for token ${tokenId}`);
      return { isActive: false, tokenId };
    }

    const latestEvent = events[0];
    if (latestEvent.event_type === 'order' && latestEvent.order_type === 'listing') {
      const now = Math.floor(Date.now() / 1000)

      console.log(`Token ${tokenId}: start_date = ${latestEvent.start_date}, expiration_date = ${latestEvent.expiration_date}, now = ${now}`);

      if (latestEvent.start_date <= now && latestEvent.expiration_date > now) {
        const price = (parseInt(latestEvent.payment.quantity) / Math.pow(10, latestEvent.payment.decimals)).toFixed(2);
        return {
          isActive: true,
          tokenId,
          price,
          url: latestEvent.asset.opensea_url
        };
      } else {
        console.log(`Listing not active for token ${tokenId}. now = ${now}, start_date = ${latestEvent.start_date}, expiration_date = ${latestEvent.expiration_date}`);
        return { isActive: false, tokenId };
      }
    }

    return { isActive: false, tokenId };
  } catch (error) {
    console.error(`Error fetching listing for tokenId ${tokenId}:`, error);
    return { isActive: false, tokenId };
  }
}

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
    const realTokenIdHex = await contract._tokenIDToCatID(tokenId);
    const rescueIndex = await fetchRescueIndex(realTokenIdHex);
    return rescueIndex;
  } catch (error) {
    console.error(`Error fetching real token ID for wrapped token ${tokenId}:`, error);
    return null;
  }
}

async function fetchRescueIndex(realTokenIdHex) {
  try {
    const response = await fetch(`https://api.mooncat.community/traits/${realTokenIdHex}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch MoonCat details: ${response.statusText}`);
    }
    const data = await response.json();
    return data.details.rescueIndex;
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
    const dnaUrl = `https://ipfs.infura.io/ipfs/bafybeibsfarvkx7cowc2uta55mw76aczjqkund6htjiq5pzvg4ljr7yeqi/${tokenId}.png`;
    return dnaUrl;
  } catch (error) {
    console.error('Error fetching DNA image URL:', error);
    return null;
  }
}
