import { AlchemyProvider, Contract } from 'ethers';
import fetch from 'node-fetch';
import { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import dotenv from 'dotenv';
// Dynamically import the JSON rescueOrder map
import { readFile } from 'fs/promises';
const categoryPath = new URL('./mooncat_rescueOrder_by_category.json', import.meta.url);
const categoryJson = JSON.parse(await readFile(categoryPath, 'utf-8'));

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
  new SlashCommandBuilder().setName('collection').setDescription('Fetch the collection categories image'),
  new SlashCommandBuilder().setName('citadel').setDescription('Fetch the citadel image'),
  new SlashCommandBuilder()
  .setName('floor')
  .setDescription('Check the floor price of MoonCats with optional filters')
  .addStringOption(option =>
    option.setName('category')
      .setDescription('Optional MoonCat category filter')
      .addChoices(
        { name: 'sub100', value: 'sub100' },
        { name: 'day1', value: 'day1' },
        { name: 'week1', value: 'week1' },
        { name: '2017', value: '2017' },
        { name: '2018', value: '2018' },
        { name: '2019', value: '2019' },
        { name: '2020', value: '2020' },
        { name: 'garfield', value: 'garfield' },
        { name: 'cheshire', value: 'cheshire' },
        { name: 'pinkpanther', value: 'pinkpanther' },
        { name: 'alien', value: 'alien' },
        { name: 'zombie', value: 'zombie' },
        { name: 'simba', value: 'simba' },
        { name: 'golden', value: 'golden' },
        { name: 'pikachu', value: 'pikachu' },
        { name: 'genesis', value: 'genesis' }
      )
  )
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

    } else if (commandName === 'collection') { 
      /* -------------- collection -------------- */
      const url = `https://ratemymoon.cat/collection.jpg`;
      await interaction.editReply(url);

    } else if (commandName === 'citadel') { 
      /* -------------- citadel -------------- */
      const url = `https://ratemymoon.cat/citadel.jpg`;
      await interaction.editReply(url);  
      
    } else if (commandName === 'floor') {
      /* -------------- floor -------------- */
      const category = options.getString('category');
      const slug = 'acclimatedmooncats';
      const contractAddress = '0xc3f733ca98e0dad0386979eb96fb1722a1a05e69';
      const emojiMap = {
        sub100: '<:hue_240_blue_pure:1138567084234788994>',
        day1: '<:hue_240_blue_pure:1138567084234788994>',
        week1: '<:hue_240_blue_pure:1138567084234788994>',
        '2017': '<:hue_270_purple_tabby:1138567535550279832>',
        '2018': '<:hue_000_red_tortie:1138528166059716650>',
        '2019': '<:hue_120_green_spotted:1138546767739232276>',
        '2020': '<:hue_180_cyan_tortie:1138566375334481960>',
        garfield: '<:character_garfield_grumpy:938880748751061043>',
        cheshire: '<:character_cheshire:938882483733278790>',
        pinkpanther: '<:character_pink_panther:939083117451436072>',
        alien: '<:character_alien_shy:938881921981755494>',
        zombie: '<:character_zombie_pouting:938882752684630087>',
        simba: '<:character_simba_shy:1138627065822842890>',
        golden: '<:character_gold_shy:1138612059249049610>',
        pikachu: '<:character_pika_smiling:1138628582780960768>',
        genesis: '<:genesis_black:1166065497679335524>'
      };
      const emojiMap2 = {
        sub100: '<:hue_180_cyan_tortie:1138566375334481960>',
        day1: '<:hue_180_cyan_tortie:1138566375334481960>',
        week1: '<:hue_180_cyan_tortie:1138566375334481960>',
        '2017': '<:hue_000_red_tortie:1138528166059716650>',
        '2018': '<:hue_120_green_spotted:1138546767739232276>',
        '2019': '<:hue_270_purple_tabby:1138567535550279832>',
        '2020': '<:hue_240_blue_pure:1138567084234788994>',
        garfield: '<a:character_garf_toes:1145029269681086564>',
        cheshire: '<a:character_cheshire_roll:1145029265679720498>',
        pinkpanther: '<a:character_pp_thank:1145029276463280148>',
        alien: '<a:character_alien_walk_standing_12:1143965778379550861>',
        zombie: '<a:character_zombie_pouncing_right:1143965944956325999>',
        simba: '<a:character_simba_walk_standing_12:1143965938694234214>',
        golden: '<a:character_golden_sleeper_128:1143965856947240971>',
        pikachu: '<a:pikahi:1400214842492850336>',
        genesis: '<:genesis_white:938883398032818206>'
      };
      const osUrlMap = {
        sub100: 'https://opensea.io/collection/acclimatedmooncats?numericTraits=[{"traitType":"Rescue+Index","min":0,"max":99}]',
        day1: 'https://opensea.io/collection/acclimatedmooncats?numericTraits=[{"traitType":"Rescue+Index","min":0,"max":491}]',
        week1: 'https://opensea.io/collection/acclimatedmooncats?numericTraits=[{"traitType":"Rescue+Index","min":0,"max":1568}]',
        '2017': 'https://opensea.io/collection/acclimatedmooncats?traits=[{"traitType":"Rescue+Year","values":["2017"]}]',
        '2018': 'https://opensea.io/collection/acclimatedmooncats?traits=[{"traitType":"Rescue+Year","values":["2018"]}]',
        '2019': 'https://opensea.io/collection/acclimatedmooncats?traits=[{"traitType":"Rescue+Year","values":["2019"]}]',
        '2020': 'https://opensea.io/collection/acclimatedmooncats?traits=[{"traitType":"Rescue+Year","values":["2020"]}]',
        garfield: 'https://opensea.io/collection/acclimatedmooncats?traits=[{"traitType":"Coat+Pattern","values":["Tabby"]},{"traitType":"Coat+Saturation","values":["Normal"]}]&numericTraits=[{"traitType":"Hue","min":20,"max":45}]',
        cheshire: 'https://opensea.io/collection/acclimatedmooncats?traits=[{"traitType":"Coat+Pattern","values":["Tabby"]},{"traitType":"Coat+Saturation","values":["Pale"]}]&numericTraits=[{"traitType":"Hue","min":265,"max":315}]',
        pinkpanther: 'https://opensea.io/collection/acclimatedmooncats?traits=[{"traitType":"Coat+Pattern","values":["Pure"]},{"traitType":"Coat+Saturation","values":["Pale"]}]&numericTraits=[{"traitType":"Hue","min":325,"max":359}]',
        alien: 'https://opensea.io/collection/acclimatedmooncats?traits=[{"traitType":"Coat+Pattern","values":["Pure"]},{"traitType":"Coat+Saturation","values":["Pale"]}]&numericTraits=[{"traitType":"Hue","min":195,"max":235}]',
        zombie: 'https://opensea.io/collection/acclimatedmooncats?traits=[{"traitType":"Coat+Pattern","values":["Pure"]},{"traitType":"Coat+Saturation","values":["Pale"]}]&numericTraits=[{"traitType":"Hue","min":115,"max":165}]',
        simba: 'https://opensea.io/collection/acclimatedmooncats?traits=[{"traitType":"Coat+Pattern","values":["Pure"]},{"traitType":"Coat+Saturation","values":["Normal"]}]&numericTraits=[{"traitType":"Hue","min":20,"max":45}]',
        golden: 'https://opensea.io/collection/acclimatedmooncats?traits=[{"traitType":"Coat+Pattern","values":["Pure"]},{"traitType":"Coat+Saturation","values":["Normal"]}]&numericTraits=[{"traitType":"Hue","min":46,"max":58}]',
        pikachu: 'https://opensea.io/collection/acclimatedmooncats?traits=[{"traitType":"Coat+Pattern","values":["Tabby"]},{"traitType":"Coat+Saturation","values":["Normal"]}]&numericTraits=[{"traitType":"Hue","min":50,"max":60}]',
        genesis: 'https://opensea.io/collection/acclimatedmooncats?traits=[{"traitType":"Classification","values":["Genesis"]}]'
      };
      /*const blurUrlMap = {
        sub100: 'https://blur.io/collection/acclimatedmooncats',
        day1: 'https://blur.io/collection/acclimatedmooncats',
        week1: 'https://blur.io/collection/acclimatedmooncats',
        '2017': 'https://blur.io/collection/acclimatedmooncats?traits={"Rescue Year":["2017"]}',
        '2018': 'https://blur.io/collection/acclimatedmooncats?traits={"Rescue Year":["2018"]}',
        '2019': 'https://blur.io/collection/acclimatedmooncats?traits={"Rescue Year":["2019"]}',
        '2020': 'https://blur.io/collection/acclimatedmooncats?traits={"Rescue Year":["2020"]}',
        garfield: 'https://blur.io/collection/acclimatedmooncats?traits={"Hue":["20","21","22","23","24","25","26","27","28","29","30","31","32","33","34","35","36","37","38","39","40","41","42","43","44","45"],"Coat Pattern":["Tabby"],"Coat Saturation":["Normal"]}',
        cheshire: 'https://blur.io/collection/acclimatedmooncats?traits={"Hue":["265","270","275","280","285","290","295","300","305","310","315"],"Coat Pattern":["Tabby"],"Coat Saturation":["Pale"]}',
        pinkpanther: 'https://blur.io/collection/acclimatedmooncats?traits={"Hue":["325","330","335","340","345","350","355","0","5","10"],"Coat Pattern":["Pure"],"Coat Saturation":["Pale"]}',
        alien: 'https://blur.io/collection/acclimatedmooncats?traits={"Hue":["195","200","205","210","215","220","225","230","235"],"Coat Pattern":["Pure"],"Coat Saturation":["Pale"]}',
        zombie: 'https://blur.io/collection/acclimatedmooncats?traits={"Hue":["115","120","125","130","135","140","145","150","155","160","165"],"Coat Pattern":["Pure"],"Coat Saturation":["Pale"]}',
        simba: 'https://blur.io/collection/acclimatedmooncats?traits={"Hue":["20","25","30","35","40","45"],"Coat Pattern":["Pure"],"Coat Saturation":["Normal"]}',
        golden: 'https://blur.io/collection/acclimatedmooncats?traits={"Hue":["46","48","50","52","54","56","58"],"Coat Pattern":["Pure"],"Coat Saturation":["Normal"]}',
        pikachu: 'https://blur.io/collection/acclimatedmooncats?traits={"Hue":["50","52","54","56","58","60"],"Coat Pattern":["Tabby"],"Coat Saturation":["Normal"]}',
        genesis: 'https://blur.io/collection/acclimatedmooncats?traits={"Classification":["Genesis"]}'
      };*/

      if (!category) {
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
          const floor = data?.total?.floor_price;
          if (floor != null) {
            await interaction.editReply(`<a:mooncats:939489975819464714> Floor price of MoonCats is **${floor.toFixed(2)} E**. <a:mooncatbotpfp:1290340466449055825>`);
          } else {
            await interaction.editReply(`❌ No floor price found for MoonCats.`);
          }
        } catch (error) {
          console.error('Error fetching floor price:', error);
          await interaction.editReply('❌ An error occurred while fetching the floor price.');
        }
        return;
      }

      const tokenIds = categoryJson[category]?.map(String);
      if (!tokenIds || tokenIds.length === 0) {
        return await interaction.editReply(`❌ No MoonCats found for \`${category}\`.`);
      }

      await interaction.editReply(`🔍 Fetching listings for \`${category}\` MoonCats...`);

      const allListings = [];
      const batchSize = 30;
      for (let i = 0; i < tokenIds.length; i += batchSize) {
        const batch = tokenIds.slice(i, i + batchSize);
        const url = new URL('https://api.opensea.io/api/v2/orders/ethereum/seaport/listings');
        url.searchParams.append('asset_contract_address', contractAddress);
        batch.forEach(id => url.searchParams.append('token_ids', id));

        try {
          const res = await fetch(url.toString(), {
            headers: {
              'Accept': 'application/json',
              ...(process.env.OPENSEA_API_KEY && { 'X-API-KEY': process.env.OPENSEA_API_KEY })
            }
          });

          if (!res.ok) {
            console.warn(`❗ Failed to fetch batch starting with token ${batch[0]}: ${res.status}`);
            continue;
          }

          const data = await res.json();
          const listings = data.orders || [];

          for (const order of listings) {
            const considerations = order?.protocol_data?.parameters?.consideration;
            if (!Array.isArray(considerations) || considerations.length === 0) continue;

            const ethTotal = considerations
              .filter(c => c.token === '0x0000000000000000000000000000000000000000')
              .reduce((sum, c) => sum + parseFloat(c.startAmount), 0);

            const ethPrice = ethTotal / 1e18;
            if (ethPrice <= 0) continue;

            allListings.push(ethPrice);

            const tokenId = order?.maker_asset_bundle?.assets?.[0]?.token_id;
            console.log(`Token ${tokenId}: ${ethPrice} ETH`);
          }

          await new Promise(r => setTimeout(r, 300));
        } catch (err) {
          console.error(`Error fetching batch starting with token ${batch[0]}:`, err);
        }
      }

      if (!allListings.length) {
        return await interaction.editReply(`❌ No active listings found for \`${category}\`.`);
      }

      const floor = Math.min(...allListings);
      const emoji = emojiMap[category] || '';
      const emoji2 = emojiMap2[category] || '';
      const osUrl = osUrlMap[category] || '';
      //const blurUrl = blurUrlMap[category] || '';
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setLabel('opensea')
          .setStyle(ButtonStyle.Link)
          .setURL(osUrl)
      
        //new ButtonBuilder()
        //  .setLabel('blur')
        //  .setStyle(ButtonStyle.Link)
        //  .setURL(blurUrl)
      );
      await interaction.editReply({content: `${emoji} **${category}** MoonCats: **${floor.toFixed(2)} E** (${allListings.length} listed) ${emoji2}`, components: [row],});
    
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
