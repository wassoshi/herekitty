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
    .addStringOption(option => 
      option.setName('identifier')
        .setDescription('The MoonCat rescue index or hex ID')
        .setRequired(true)),
  new SlashCommandBuilder()
    .setName('mcacc')
    .setDescription('Fetch accessorized image for a specific MoonCat')
    .addStringOption(option => 
      option.setName('identifier')
        .setDescription('The MoonCat rescue index or hex ID')
        .setRequired(true)),
  new SlashCommandBuilder()
    .setName('dna')
    .setDescription('Fetch DNA image for a specific token')
    .addStringOption(option => 
      option.setName('identifier')
        .setDescription('The MoonCat rescue index or hex ID')
        .setRequired(true)),
  new SlashCommandBuilder()
    .setName('catme')
    .setDescription('Fetch image for a random MoonCat'),
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

async function clearOldCommands() {
  try {
    const currentCommands = await rest.get(
      Routes.applicationCommands(process.env.CLIENT_ID)
    );
    for (const command of currentCommands) {
      await rest.delete(
        Routes.applicationCommand(process.env.CLIENT_ID, command.id)
      );
    }
  } catch (error) {
    console.error('Error deleting old commands:', error);
  }
}

client.once('ready', async () => {
  try {
    const route = process.env.GUILD_ID
      ? Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID)
      : Routes.applicationCommands(process.env.CLIENT_ID);

    await rest.put(route, { body: commands });
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

    if (commandName === 'mc' || commandName === 'mcacc' || commandName === 'dna') {
      const identifier = options.getString('identifier');
      let tokenId;

      if (identifier && identifier.startsWith('0x')) {
        const moonCatDetails = await getMoonCatNameOrId(identifier);
        if (moonCatDetails) {
          tokenId = moonCatDetails.details.rescueIndex;
        } else {
          await interaction.editReply(`Sorry, I couldn't find details for MoonCat with hex ID: ${identifier}`);
          return;
        }
      } else if (identifier && !isNaN(parseInt(identifier))) {
        tokenId = parseInt(identifier);
      } else {
        await interaction.editReply(`Invalid identifier: ${identifier}`);
        return;
      }

      if (commandName === 'mc') {
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
          const chainStationLink = `https://chainstation.mooncatrescue.com/mooncats/${rescueIndex}`;

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
        const accessorizedImageUrl = `https://api.mooncat.community/accessorized-image/${tokenId}.png`;
        const moonCatDetails = await getMoonCatNameOrId(tokenId);

        if (moonCatDetails) {
          const rescueIndex = moonCatDetails.details.rescueIndex;
          const hexId = moonCatDetails.details.catId;

          let name = moonCatDetails.details.name;
          if (name) {
            name = name.replace(" (accessorized)", "");
          }

          const title = name ? `MoonCat #${rescueIndex}: ${name}` : `MoonCat #${rescueIndex}: ${hexId}`;
          const chainStationLink = `https://chainstation.mooncatrescue.com/mooncats/${rescueIndex}`;

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

      if (commandName === 'dna') {
        let rescueIndex = null;
        let moonCatDetails = null;

        if (identifier.startsWith('0x')) {
          moonCatDetails = await getMoonCatNameOrId(identifier);
          if (moonCatDetails) {
            rescueIndex = moonCatDetails.details.rescueIndex;
          } else {
            await interaction.editReply(`Sorry, couldn't find details for MoonCat with hex ID: ${identifier}`);
            return;
          }
        } else if (!isNaN(identifier)) {
          rescueIndex = identifier;
          moonCatDetails = await getMoonCatNameOrId(rescueIndex);
        } else {
          await interaction.editReply(`Invalid identifier format.`);
          return;
        }

        const dnaImageUrl = await getDNAImageURL(rescueIndex);

        if (dnaImageUrl) {
          let name = moonCatDetails?.details?.name || null;
          const hexId = moonCatDetails?.details?.catId || identifier;

          if (name) {
              name = name.replace(" (accessorized)", "");
          }

          const clickableText = name ? `[${name}](${dnaImageUrl})` : `[${hexId}](${dnaImageUrl})`;
          const message = `MoonCat #${rescueIndex}: ${clickableText}`;

          await interaction.editReply({ content: message });
        } else {
          await interaction.editReply(`Sorry, I couldn't fetch the DNA image for MoonCat with token ID: ${identifier}`);
        }
      }

    } else if (commandName === 'catme') {
		const tokenId = Math.floor(Math.random() * 25440);
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
          const chainStationLink = `https://chainstation.mooncatrescue.com/mooncats/${rescueIndex}`;

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
      
    } else if (commandName === 'acc') {
      const accessoryId = options.getInteger('accessoryid');

      const accessoryDetails = await fetchAccessoryDetails(accessoryId);

      if (!accessoryDetails) {
        await interaction.editReply(`Could not fetch accessory details for accessory ID: ${accessoryId}`);
        return;
      }

      const ownersList = accessoryDetails.ownedBy?.list;
      if (ownersList && ownersList.length > 0) {
        const randomIndex = Math.floor(Math.random() * ownersList.length);
        const randomMoonCatId = ownersList[randomIndex].rescueOrder;

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

    } else if (commandName === 'accsale') {
      const accessoryId = options.getInteger('accessoryid');
      const accessoryDetails = await fetchAccessoryDetails(accessoryId);

      if (!accessoryDetails) {
        await interaction.editReply(`Could not fetch accessory details for accessory ID: ${accessoryId}`);
        return;
      }
      const moonCatOwners = accessoryDetails.ownedBy?.list;

      if (!moonCatOwners || moonCatOwners.length === 0) {
        await interaction.editReply(`No MoonCats found with accessory ID: ${accessoryId}`);
        return;
      }

      const delayBetweenCalls = 350;
      const listings = [];

      for (let i = 0; i < moonCatOwners.length; i++) {
        const owner = moonCatOwners[i];
        const listing = await checkMoonCatListing(owner.rescueOrder, delayBetweenCalls);
        listings.push(listing);
      }

      const activeListings = listings.filter(listing => listing.isActive);

      if (activeListings.length > 0) {
        const listingMessages = activeListings.map(listing => {
          const moonCatImageUrl = `https://api.mooncat.community/image/${listing.tokenId}?costumes=true&acc=${accessoryId}`;
          return {
            embed: {
              color: 3447003,
              title: `MoonCat #${listing.tokenId} is listed for ${listing.price} ETH`,
              url: listing.url,
              image: { url: moonCatImageUrl },
            }
          };
        });

        await interaction.editReply({
          content: `Active listings for accessory ID ${accessoryId}:`,
          embeds: listingMessages.map(message => message.embed)
        });
      } else {
        await interaction.editReply(`None of the MoonCats with accessory ID ${accessoryId} are currently listed for sale.`);
      }

    } else if (commandName === 'wrp') {
      const tokenId = options.getInteger('tokenid');
      if (!tokenId) {
        await interaction.editReply('Invalid token ID provided.');
        return;
      }

      const rescueIndex = await getRescueIndexFromWrapper(tokenId);

      if (rescueIndex) {
        const moonCatDetails = await getMoonCatNameOrId(rescueIndex);
        const imageUrl = await getMoonCatImageURL(rescueIndex);

        if (moonCatDetails && imageUrl) {
          const hexId = moonCatDetails.details.catId;

          let name = moonCatDetails.details.name;
          if (name) {
            name = name.replace(" (accessorized)", "");
          }

          const title = name ? `MoonCat #${rescueIndex}: ${name}` : `MoonCat #${rescueIndex}: ${hexId}`;
          const chainStationLink = `https://chainstation.mooncatrescue.com/mooncats/${rescueIndex}`;

          const embed = {
            color: 3447003,
            title: title,
            url: chainStationLink,
            image: { url: imageUrl }
          };

          await interaction.editReply({
            content: `Wrapped token ID ${tokenId} is Rescue Index #${rescueIndex}`,
            embeds: [embed]
          });
        } else {
          await interaction.editReply(`Wrapped token ID ${tokenId} is Rescue Index #${rescueIndex}, but could not fetch additional details.`);
        }
      } else {
        await interaction.editReply('Could not fetch rescue index.');
      }

    } else {
      await interaction.editReply('Unknown command.');
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

async function fetchOpenSeaEvents(tokenId, eventType, delayBetweenCalls = 350) {
  await delay(delayBetweenCalls);

  try {
    const url = `https://api.opensea.io/api/v2/events/chain/ethereum/contract/0xc3f733ca98E0daD0386979Eb96fb1722A1A05E69/nfts/${tokenId}?event_type=${eventType}`;
    const options = {
      headers: {
        'accept': 'application/json',
        'x-api-key': process.env.OPENSEA_API_KEY
      }
    };

    const response = await fetch(url, options);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to fetch OpenSea ${eventType} events for tokenId ${tokenId}: ${errorText}`);
    }

    const data = await response.json();
    return data.asset_events || [];
  } catch (error) {
    console.error(`Error fetching ${eventType} events for tokenId ${tokenId}:`, error);
    return [];
  }
}

async function checkMoonCatListing(tokenId, delayBetweenCalls = 350) {
  const listingEvents = await fetchOpenSeaEvents(tokenId, 'listing', delayBetweenCalls);

  if (listingEvents.length === 0) {
    return { isActive: false, tokenId };
  }

  const now = Math.floor(Date.now() / 1000);
  let isActive = false;
  let price = null;
  let listingUrl = null;

  const latestListing = listingEvents.find(event => event.event_type === 'order' && event.order_type === 'listing');
  if (latestListing) {
    const { start_date, expiration_date, asset, payment } = latestListing;

    if (start_date <= now && expiration_date > now) {
      isActive = true;
      price = (parseInt(payment.quantity) / Math.pow(10, payment.decimals)).toFixed(2);
      listingUrl = asset.opensea_url;
    }
  }

  const saleEvents = await fetchOpenSeaEvents(tokenId, 'sale', delayBetweenCalls);
  const latestSale = saleEvents.find(event => event.event_timestamp > latestListing?.start_date);

  const transferEvents = await fetchOpenSeaEvents(tokenId, 'transfer', delayBetweenCalls);
  const latestTransfer = transferEvents.find(event => event.event_timestamp > latestListing?.start_date);

  if (latestSale || latestTransfer) {
    isActive = false;
  }

  if (isActive) {
    return { isActive, tokenId, price, url: listingUrl };
  } else {
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
