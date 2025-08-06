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
        sub100: 'https://opensea.io/collection/acclimatedmooncats?status=all&numericTraits=[{%22traitType%22:%22Rescue+Index%22,%22min%22:0,%22max%22:99}]',
        day1: 'https://opensea.io/collection/acclimatedmooncats?numericTraits=[{%22traitType%22:%22Rescue+Index%22,%22min%22:0,%22max%22:491}]',
        week1: 'https://opensea.io/collection/acclimatedmooncats?status=all&numericTraits=[{%22traitType%22:%22Rescue+Index%22,%22min%22:0,%22max%22:1568}]',
        '2017': 'https://opensea.io/collection/acclimatedmooncats?traits=[{%22traitType%22:%22Rescue+Year%22,%22values%22:[%222017%22]}]',
        '2018': 'https://opensea.io/collection/acclimatedmooncats?traits=[{%22traitType%22:%22Rescue+Year%22,%22values%22:[%222018%22]}]',
        '2019': 'https://opensea.io/collection/acclimatedmooncats?traits=[{%22traitType%22:%22Rescue+Year%22,%22values%22:[%222019%22]}]',
        '2020': 'https://opensea.io/collection/acclimatedmooncats?traits=[{%22traitType%22:%22Rescue+Year%22,%22values%22:[%222020%22]}]',
        garfield: 'https://opensea.io/collection/acclimatedmooncats?search[resultModel]=ASSETS&search[sortAscending]=true&search[sortBy]=PRICE&traits=[{%22traitType%22:%22Coat+Hue%22,%22values%22:[%22Orange%22]},{%22traitType%22:%22Coat+Pattern%22,%22values%22:[%22Tabby%22]},{%22traitType%22:%22Coat+Saturation%22,%22values%22:[%22Normal%22]}]&numericTraits=[{%22traitType%22:%22Hue%22,%22min%22:20,%22max%22:45}]',
        cheshire: 'https://opensea.io/collection/acclimatedmooncats?search[resultModel]=ASSETS&search[sortAscending]=true&search[sortBy]=PRICE&traits=[{%22traitType%22:%22Coat+Hue%22,%22values%22:[%22Purple%22,%22Magenta%22]},{%22traitType%22:%22Coat+Pattern%22,%22values%22:[%22Tabby%22]},{%22traitType%22:%22Coat+Saturation%22,%22values%22:[%22Pale%22]}]&numericTraits=[{%22traitType%22:%22Hue%22,%22min%22:265,%22max%22:315}]',
        pinkpanther: 'https://opensea.io/collection/acclimatedmooncats?search[resultModel]=ASSETS&search[sortAscending]=true&search[sortBy]=PRICE&traits=[{%22traitType%22:%22Coat+Hue%22,%22values%22:[%22Fuchsia%22,%22Red%22]},{%22traitType%22:%22Coat+Pattern%22,%22values%22:[%22Pure%22]},{%22traitType%22:%22Coat+Saturation%22,%22values%22:[%22Pale%22]}]&numericTraits=[{%22traitType%22:%22Hue%22,%22min%22:325,%22max%22:359}]',
        alien: 'https://opensea.io/collection/acclimatedmooncats?search[resultModel]=ASSETS&search[sortAscending]=true&search[sortBy]=PRICE&traits=[{%22traitType%22:%22Coat+Hue%22,%22values%22:[%22Sky%20Blue%22,%22Blue%22]},{%22traitType%22:%22Coat+Pattern%22,%22values%22:[%22Pure%22]},{%22traitType%22:%22Coat+Saturation%22,%22values%22:[%22Pale%22]}]&numericTraits=[{%22traitType%22:%22Hue%22,%22min%22:195,%22max%22:235}]',
        zombie: 'https://opensea.io/collection/acclimatedmooncats?search[resultModel]=ASSETS&search[sortAscending]=true&search[sortBy]=PRICE&traits=[{%22traitType%22:%22Coat+Hue%22,%22values%22:[%22Green%22,%22Teal%22]},{%22traitType%22:%22Coat+Pattern%22,%22values%22:[%22Pure%22]},{%22traitType%22:%22Coat+Saturation%22,%22values%22:[%22Pale%22]}]&numericTraits=[{%22traitType%22:%22Hue%22,%22min%22:115,%22max%22:165}]',
        simba: 'https://opensea.io/collection/acclimatedmooncats?search[resultModel]=ASSETS&search[sortAscending]=true&search[sortBy]=PRICE&traits=[{%22traitType%22:%22Coat+Hue%22,%22values%22:[%22Orange%22]},{%22traitType%22:%22Coat+Pattern%22,%22values%22:[%22Pure%22]},{%22traitType%22:%22Coat+Saturation%22,%22values%22:[%22Normal%22]}]&numericTraits=[{%22traitType%22:%22Hue%22,%22min%22:20,%22max%22:45}]',
        golden: 'https://opensea.io/collection/acclimatedmooncats?search[resultModel]=ASSETS&search[sortAscending]=true&search[sortBy]=PRICE&traits=[{%22traitType%22:%22Coat+Hue%22,%22values%22:[%22Yellow%22]},{%22traitType%22:%22Coat+Pattern%22,%22values%22:[%22Pure%22]},{%22traitType%22:%22Coat+Saturation%22,%22values%22:[%22Normal%22]}]&numericTraits=[{%22traitType%22:%22Hue%22,%22min%22:46,%22max%22:58}]',
        pikachu: 'https://opensea.io/collection/acclimatedmooncats?search[resultModel]=ASSETS&search[sortAscending]=true&search[sortBy]=PRICE&traits=[{%22traitType%22:%22Coat+Hue%22,%22values%22:[%22Yellow%22]},{%22traitType%22:%22Coat+Pattern%22,%22values%22:[%22Tabby%22]},{%22traitType%22:%22Coat+Saturation%22,%22values%22:[%22Normal%22]}]&numericTraits=[{%22traitType%22:%22Hue%22,%22min%22:50,%22max%22:60}]',
        genesis: 'https://opensea.io/collection/acclimatedmooncats?status=all&traits=[{%22traitType%22:%22Classification%22,%22values%22:[%22Genesis%22]}]'
      };

      const blurUrlMap = {
        sub100: 'https://blur.io/collection/acclimatedmooncats',
        day1: 'https://blur.io/collection/acclimatedmooncats',
        week1: 'https://blur.io/collection/acclimatedmooncats',
        '2017': 'https://blur.io/collection/acclimatedmooncats?traits=%7B%22Rescue%20Year%22%3A%5B%222017%22%5D%7D',
        '2018': 'https://blur.io/collection/acclimatedmooncats?traits=%7B%22Rescue%20Year%22%3A%5B%222018%22%5D%7D',
        '2019': 'https://blur.io/collection/acclimatedmooncats?traits=%7B%22Rescue%20Year%22%3A%5B%222019%22%5D%7D',
        '2020': 'https://blur.io/collection/acclimatedmooncats?traits=%7B%22Rescue%20Year%22%3A%5B%222020%22%5D%7D',
        garfield: 'https://blur.io/collection/acclimatedmooncats?traits={%22Hue%22:[%2220%22,%2221%22,%2222%22,%2223%22,%2224%22,%2225%22,%2226%22,%2227%22,%2228%22,%2229%22,%2230%22,%2231%22,%2232%22,%2233%22,%2234%22,%2235%22,%2236%22,%2237%22,%2238%22,%2239%22,%2240%22,%2241%22,%2242%22,%2243%22,%2244%22,%2245%22],%22Coat+Hue%22:[%22Orange%22],%22Coat+Pattern%22:[%22Tabby%22],%22Coat+Saturation%22:[%22Normal%22]}',
        cheshire: 'https://blur.io/collection/acclimatedmooncats?traits={%22Hue%22:[%22265%22,%22266%22,%22267%22,%22268%22,%22269%22,%22270%22,%22271%22,%22272%22,%22273%22,%22274%22,%22275%22,%22276%22,%22277%22,%22278%22,%22279%22,%22280%22,%22281%22,%22282%22,%22283%22,%22284%22,%22285%22,%22286%22,%22287%22,%22288%22,%22289%22,%22290%22,%22291%22,%22292%22,%22293%22,%22294%22,%22295%22,%22296%22,%22297%22,%22298%22,%22299%22,%22300%22,%22301%22,%22302%22,%22303%22,%22304%22,%22305%22,%22306%22,%22307%22,%22308%22,%22309%22,%22310%22,%22311%22,%22312%22,%22313%22,%22314%22,%22315%22],%22Coat+Hue%22:[%22Purple%22,%22Magenta%22],%22Coat+Pattern%22:[%22Tabby%22],%22Coat+Saturation%22:[%22Pale%22]}',
        pinkpanther: 'https://blur.io/collection/acclimatedmooncats?traits={%22Hue%22:[%22325%22,%22326%22,%22327%22,%22328%22,%22329%22,%22330%22,%22331%22,%22332%22,%22333%22,%22334%22,%22335%22,%22336%22,%22337%22,%22338%22,%22339%22,%22340%22,%22341%22,%22342%22,%22343%22,%22344%22,%22345%22,%22346%22,%22347%22,%22348%22,%22349%22,%22350%22,%22351%22,%22352%22,%22353%22,%22354%22,%22355%22,%22356%22,%22357%22,%22358%22,%22359%22,%220%22,%221%22,%222%22,%223%22,%224%22,%225%22,%226%22,%227%22,%228%22,%229%22,%2210%22],%22Coat+Hue%22:[%22Fuchsia%22,%22Red%22],%22Coat+Pattern%22:[%22Pure%22],%22Coat+Saturation%22:[%22Pale%22]}',
        alien: 'https://blur.io/collection/acclimatedmooncats?traits={%22Hue%22:[%22195%22,%22196%22,%22197%22,%22198%22,%22199%22,%22200%22,%22201%22,%22202%22,%22203%22,%22204%22,%22205%22,%22206%22,%22207%22,%22208%22,%22209%22,%22210%22,%22211%22,%22212%22,%22213%22,%22214%22,%22215%22,%22216%22,%22217%22,%22218%22,%22219%22,%22220%22,%22221%22,%22222%22,%22223%22,%22224%22,%22225%22,%22226%22,%22227%22,%22228%22,%22229%22,%22230%22,%22231%22,%22232%22,%22233%22,%22234%22,%22235%22],%22Coat+Hue%22:[%22Sky%20Blue%22,%22Blue%22],%22Coat+Pattern%22:[%22Pure%22],%22Coat+Saturation%22:[%22Pale%22]}',
        zombie: 'https://blur.io/collection/acclimatedmooncats?traits={%22Hue%22:[%22115%22,%22116%22,%22117%22,%22118%22,%22119%22,%22120%22,%22121%22,%22122%22,%22123%22,%22124%22,%22125%22,%22126%22,%22127%22,%22128%22,%22129%22,%22130%22,%22131%22,%22132%22,%22133%22,%22134%22,%22135%22,%22136%22,%22137%22,%22138%22,%22139%22,%22140%22,%22141%22,%22142%22,%22143%22,%22144%22,%22145%22,%22146%22,%22147%22,%22148%22,%22149%22,%22150%22,%22151%22,%22152%22,%22153%22,%22154%22,%22155%22,%22156%22,%22157%22,%22158%22,%22159%22,%22160%22,%22161%22,%22162%22,%22163%22,%22164%22,%22165%22],%22Coat+Hue%22:[%22Green%22,%22Teal%22],%22Coat+Pattern%22:[%22Pure%22],%22Coat+Saturation%22:[%22Pale%22]}',
        simba: 'https://blur.io/collection/acclimatedmooncats?traits={%22Hue%22:[%2220%22,%2221%22,%2222%22,%2223%22,%2224%22,%2225%22,%2226%22,%2227%22,%2228%22,%2229%22,%2230%22,%2231%22,%2232%22,%2233%22,%2234%22,%2235%22,%2236%22,%2237%22,%2238%22,%2239%22,%2240%22,%2241%22,%2242%22,%2243%22,%2244%22,%2245%22],%22Coat+Hue%22:[%22Orange%22],%22Coat+Pattern%22:[%22Pure%22],%22Coat+Saturation%22:[%22Normal%22]}',
        golden: 'https://blur.io/collection/acclimatedmooncats?traits={%22Hue%22:[%2246%22,%2247%22,%2248%22,%2249%22,%2250%22,%2251%22,%2252%22,%2253%22,%2254%22,%2255%22,%2256%22,%2257%22,%2258%22],%22Coat+Hue%22:[%22Yellow%22],%22Coat+Pattern%22:[%22Pure%22],%22Coat+Saturation%22:[%22Normal%22]}',
        pikachu: 'https://blur.io/collection/acclimatedmooncats?traits={%22Hue%22:[%2250%22,%2251%22,%2252%22,%2253%22,%2254%22,%2255%22,%2256%22,%2257%22,%2258%22,%2259%22,%2260%22],%22Coat+Hue%22:[%22Yellow%22],%22Coat+Pattern%22:[%22Tabby%22],%22Coat+Saturation%22:[%22Normal%22]}',
        genesis: 'https://blur.io/collection/acclimatedmooncats?traits=%7B%22Classification%22%3A%5B%22Genesis%22%5D%7D'
      };

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
            await interaction.editReply(`<a:mooncats:939489975819464714> Floor price of MoonCats is **${floor} ETH**. <a:mooncatbotpfp:1290340466449055825>`);
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
      const blurUrl = blurUrlMap[category] || '';
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setLabel('opensea')
          .setStyle(ButtonStyle.Link)
          .setURL(osUrl),
      
        new ButtonBuilder()
          .setLabel('blur')
          .setStyle(ButtonStyle.Link)
          .setURL(blurUrl)
      );
      await interaction.editReply({content: `${emoji} Floor price of **${category}** MoonCats: **${floor} ETH** (${allListings.length} listings found). ${emoji2}`, components: [row],});
    
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
