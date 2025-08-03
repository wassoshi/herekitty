import { AlchemyProvider, Contract } from 'ethers';
import fetch from 'node-fetch';
import { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } from 'discord.js';
import dotenv from 'dotenv';

dotenv.config();

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

const commands = [
  new SlashCommandBuilder().setName('mc').setDescription('Fetch details for a specific MoonCat')
    .addStringOption(o => o.setName('identifier').setDescription('The MoonCat rescue index or hex ID').setRequired(true)),
  new SlashCommandBuilder().setName('mcacc').setDescription('Fetch accessorized image for a specific MoonCat')
    .addStringOption(o => o.setName('identifier').setDescription('The MoonCat rescue index or hex ID').setRequired(true)),
  new SlashCommandBuilder().setName('dna').setDescription('Fetch DNA image for a specific token')
    .addStringOption(o => o.setName('identifier').setDescription('The MoonCat rescue index or hex ID').setRequired(true)),
  new SlashCommandBuilder().setName('catme').setDescription('Fetch image for a random MoonCat'),
  new SlashCommandBuilder().setName('acc').setDescription('Fetch a random MoonCat with a specified accessory')
    .addIntegerOption(o => o.setName('accessoryid').setDescription('The accessory ID').setRequired(true)),
  new SlashCommandBuilder().setName('wrp').setDescription('Fetch rescue index from old wrapper token ID')
    .addIntegerOption(o => o.setName('tokenid').setDescription('The old wrapper token ID').setRequired(true)),
  new SlashCommandBuilder().setName('accsale').setDescription('Check which MoonCats with a specific accessory are listed for sale')
    .addIntegerOption(o => o.setName('accessoryid').setDescription('The accessory ID').setRequired(true)),
  new SlashCommandBuilder().setName('floor').setDescription('Check the floor price of MoonCats')
].map(c => c.toJSON());

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

async function clearOldCommands() {
  try {
    await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: [] });
  } catch (_) {}
  if (process.env.GUILD_ID) {
    try {
      await rest.put(
        Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
        { body: [] }
      );
    } catch (_) {}
  }
}

client.once('ready', async () => {
  await clearOldCommands();
  const route = process.env.GUILD_ID
    ? Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID)
    : Routes.applicationCommands(process.env.CLIENT_ID);
  await rest.put(route, { body: commands });
  console.log('Discord bot is ready!');
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isCommand()) return;
  const { commandName, options } = interaction;

  try {
    await interaction.deferReply();

    if (commandName === 'mc' || commandName === 'mcacc' || commandName === 'dna') {
      /* -------------- mc / mcacc / dna -------------- */
      const identifier = options.getString('identifier');
      let tokenId;
      if (identifier && identifier.startsWith('0x')) {
        const m = await getMoonCatNameOrId(identifier);
        if (!m) return await interaction.editReply(`Sorry, I couldn't find details for MoonCat with hex ID: ${identifier}`);
        tokenId = m.details.rescueIndex;
      } else if (!isNaN(parseInt(identifier))) {
        tokenId = parseInt(identifier);
      } else {
        return await interaction.editReply(`Invalid identifier: ${identifier}`);
      }

      if (commandName === 'mc') {
        const d = await getMoonCatNameOrId(tokenId);
        const img = await getMoonCatImageURL(tokenId);
        if (!d || !img) return await interaction.editReply(`Sorry, I couldn't find details for MoonCat with token ID: ${tokenId}`);
        const name = d.details.name?.replace(' (accessorized)', '') || null;
        const hex  = d.details.catId;
        const title = name ? `MoonCat #${d.details.rescueIndex}: ${name}` : `MoonCat #${d.details.rescueIndex}: ${hex}`;
        await interaction.editReply({ embeds: [{ color: 3447003, title, url: `https://chainstation.mooncatrescue.com/mooncats/${d.details.rescueIndex}`, image: { url: img } }] });
      }

      if (commandName === 'mcacc') {
        const d = await getMoonCatNameOrId(tokenId);
        if (!d) return await interaction.editReply(`Sorry, I couldn't find details for MoonCat with token ID: ${tokenId}`);
        const name = d.details.name?.replace(' (accessorized)', '') || null;
        const hex  = d.details.catId;
        const title = name ? `MoonCat #${d.details.rescueIndex}: ${name}` : `MoonCat #${d.details.rescueIndex}: ${hex}`;
        const img = `https://api.mooncat.community/accessorized-image/${tokenId}.png`;
        await interaction.editReply({ embeds: [{ color: 3447003, title, url: `https://chainstation.mooncatrescue.com/mooncats/${d.details.rescueIndex}`, image: { url: img } }] });
      }

      if (commandName === 'dna') {
        const d = await getMoonCatNameOrId(tokenId);
        if (!d) return await interaction.editReply(`Sorry, I couldn't fetch MoonCat ${identifier}`);
        const name = d.details.name?.replace(' (accessorized)', '') || null;
        const hex  = d.details.catId;
        const img  = await getDNAImageURL(tokenId);
        const txt  = name ? `[${name}](${img})` : `[${hex}](${img})`;
        await interaction.editReply({ content: `MoonCat #${tokenId}: ${txt}` });
      }

    } else if (commandName === 'catme') {
      /* -------------- catme -------------- */
      const tokenId = Math.floor(Math.random() * 25440);
      const d = await getMoonCatNameOrId(tokenId);
      const img = await getMoonCatImageURL(tokenId);
      if (!d || !img) return await interaction.editReply(`Sorry, I couldn't find details for MoonCat with token ID: ${tokenId}`);
      const name = d.details.name?.replace(' (accessorized)', '') || null;
      const hex  = d.details.catId;
      const title = name ? `MoonCat #${d.details.rescueIndex}: ${name}` : `MoonCat #${d.details.rescueIndex}: ${hex}`;
      await interaction.editReply({ embeds: [{ color: 3447003, title, url: `https://chainstation.mooncatrescue.com/mooncats/${d.details.rescueIndex}`, image: { url: img } }] });

    } else if (commandName === 'acc') {
      /* -------------- acc -------------- */
      const accId = options.getInteger('accessoryid');
      const accD = await fetchAccessoryDetails(accId);
      if (!accD) return await interaction.editReply(`Could not fetch accessory details for ${accId}`);
      const owners = accD.ownedBy?.list || [];
      if (!owners.length) {
        const img = `https://api.mooncat.community/accessory-image/${accId}.png`;
        return await interaction.editReply({ embeds: [{ color: 3447003, title: `Accessory #${accId}: ${accD.name}`, url: `https://chainstation.mooncatrescue.com/accessories/${accId}`, image: { url: img } }] });
      }
      const pick = owners[Math.floor(Math.random() * owners.length)].rescueOrder;
      const img = `https://api.mooncat.community/image/${pick}?costumes=true&acc=${accId}`;
      await interaction.editReply({ embeds: [{ color: 3447003, title: `Accessory #${accId}: ${accD.name}`, url: `https://chainstation.mooncatrescue.com/accessories/${accId}`, image: { url: img } }] });

    } else if (commandName === 'accsale') {
      /* -------------- accsale -------------- */
      const accId = options.getInteger('accessoryid');
      const accD = await fetchAccessoryDetails(accId);
      if (!accD) return await interaction.editReply(`Could not fetch accessory details for ${accId}`);
      const owners = accD.ownedBy?.list || [];
      if (!owners.length) return await interaction.editReply(`No MoonCats found with accessory ID: ${accId}`);

      const listings = [];
      for (const o of owners) {
        listings.push(await checkMoonCatListing(o.rescueOrder, 350));
      }
      const actives = listings.filter(l => l.isActive);
      if (!actives.length) return await interaction.editReply(`None of the MoonCats with accessory ID ${accId} are currently listed for sale.`);
      await interaction.editReply({
        content: `Active listings for accessory ID ${accId}:`,
        embeds: actives.map(l => ({
          color: 3447003,
          title: `MoonCat #${l.tokenId} is listed for ${l.price} ETH`,
          url: l.url,
          image: { url: `https://api.mooncat.community/image/${l.tokenId}?costumes=true&acc=${accId}` }
        }))
      });

    } else if (commandName === 'wrp') {
      /* -------------- wrp -------------- */
      const tokenId = options.getInteger('tokenid');
      if (!tokenId) return await interaction.editReply('Invalid token ID provided.');
      const idx = await getRescueIndexFromWrapper(tokenId);
      if (!idx) return await interaction.editReply('Could not fetch rescue index.');
      const d = await getMoonCatNameOrId(idx);
      const img = await getMoonCatImageURL(idx);
      if (!d || !img) return await interaction.editReply(`Wrapped token ID ${tokenId} is Rescue Index #${idx}, but could not fetch additional details.`);
      const name = d.details.name?.replace(' (accessorized)', '') || null;
      const hex  = d.details.catId;
      const title = name ? `MoonCat #${idx}: ${name}` : `MoonCat #${idx}: ${hex}`;
      await interaction.editReply({ content: `Wrapped token ID ${tokenId} is Rescue Index #${idx}`, embeds: [{ color: 3447003, title, url: `https://chainstation.mooncatrescue.com/mooncats/${idx}`, image: { url: img } }] });

    } else if (commandName === 'floor') {
      /* -------------- floor -------------- */
      const slug = 'acclimatedmooncats'; // Official OpenSea slug for MoonCats
      const url = `https://api.opensea.io/api/v2/collections/${slug}/stats`;
      try {
      const response = await fetch(url, {
        headers: {
          'Accept': 'application/json',
          ...(process.env.OPENSEA_API_KEY && { 'X-API-KEY': process.env.OPENSEA_API_KEY })
        }
      });
      if (!response.ok) {
        return await interaction.editReply('⚠️ Could not fetch data from OpenSea.');
      }
      const data = await response.json();
      const floor = data?.stats?.floor_price;
      if (floor != null) {
        await interaction.editReply(`🏷️ The current floor price of **MoonCats** is **${floor} ETH**.`);
      } else {
        await interaction.editReply(`❌ No floor price found for MoonCats.`);
      }
      } catch (error) {
        console.error('Error fetching floor price:', error);
        await interaction.editReply('❌ An error occurred while fetching the floor price.');
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

/* ---------- helper functions below (unchanged) ---------- */
async function fetchAccessoryDetails(id) {
  try {
    const r = await fetch(`https://api.mooncatrescue.com/accessory/traits/${id}`);
    if (!r.ok) throw new Error(r.statusText);
    return r.json();
  } catch (e) { return null; }
}
function delay(ms) { return new Promise(r => setTimeout(r, ms)); }
async function fetchOpenSeaEvents(id, type, gap = 350) {
  await delay(gap);
  try {
    const url = `https://api.opensea.io/api/v2/events/chain/ethereum/contract/0xc3f733ca98E0daD0386979Eb96fb1722A1A05E69/nfts/${id}?event_type=${type}`;
    const r = await fetch(url, { headers: { accept: 'application/json', 'x-api-key': process.env.OPENSEA_API_KEY } });
    if (!r.ok) throw new Error(await r.text());
    const d = await r.json();
    return d.asset_events || [];
  } catch { return []; }
}
async function checkMoonCatListing(id, gap = 350) {
  const listings = await fetchOpenSeaEvents(id, 'listing', gap);
  if (!listings.length) return { isActive: false, tokenId: id };
  const now = Date.now() / 1000;
  const l = listings.find(e => e.order_type === 'listing' && e.start_date <= now && e.expiration_date > now);
  if (!l) return { isActive: false, tokenId: id };
  const sales = await fetchOpenSeaEvents(id, 'sale', gap);
  const transfers = await fetchOpenSeaEvents(id, 'transfer', gap);
  if (sales.some(e => e.event_timestamp > l.start_date) || transfers.some(e => e.event_timestamp > l.start_date)) return { isActive: false, tokenId: id };
  return { isActive: true, tokenId: id, price: (parseInt(l.payment.quantity) / 10 ** l.payment.decimals).toFixed(2), url: l.asset.opensea_url };
}
async function getRescueIndexFromWrapper(tokenId) {
  const provider = new AlchemyProvider('homestead', process.env.ALCHEMY_API_KEY);
  const addr = '0x7c40c393dc0f283f318791d746d894ddd3693572';
  const abi = [{ inputs: [{ internalType: 'uint256', name: 'tokenId', type: 'uint256' }], name: '_tokenIDToCatID', outputs: [{ internalType: 'bytes5', name: '', type: 'bytes5' }], stateMutability: 'view', type: 'function' }];
  const c = new Contract(addr, abi, provider);
  try {
    const catHex = await c._tokenIDToCatID(tokenId);
    const r = await fetch(`https://api.mooncat.community/traits/${catHex}`);
    if (!r.ok) throw new Error('API fail');
    const d = await r.json();
    return d.details.rescueIndex;
  } catch { return null; }
}
async function getMoonCatNameOrId(id) {
  try {
    const r = await fetch(`https://api.mooncat.community/traits/${id.toString().replace(/^0x/, '')}`);
    if (!r.ok) throw new Error('API fail');
    return r.json();
  } catch { return null; }
}
async function getMoonCatImageURL(id) {
  try {
    const r = await fetch(`https://api.mooncat.community/regular-image/${id}`);
    if (!r.ok) throw new Error('img 404');
    return r.url;
  } catch { return null; }
}
async function getDNAImageURL(id) {
  return `https://ipfs.infura.io/ipfs/bafybeibsfarvkx7cowc2uta55mw76aczjqkund6htjiq5pzvg4ljr7yeqi/${id}.png`;
}
