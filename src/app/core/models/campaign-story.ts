import type { Chapter } from './campaign.model';

/*
 * The campaign's story. To add to it, append missions to a chapter or chapters to the list;
 * missions unlock in this order. Each mission needs a unique id (it is saved once won), a
 * band of one to four enemies (the first leads), a level, and its scenes. `{leader}` stands
 * for the player's squad leader; a line's portrait is a class id or 'leader'.
 *
 * Objects: a barricade stands in a lane at x (0 is the player's edge, 1 the enemy's; the
 * enemy front line is near 0.68). Traps are spikes (poison) or snares (stun) and sit in
 * the middle of the field, 0.44 to 0.56, where the player must walk.
 *
 * Engines: { kind: 'engine', engine: 'ballista' | 'catapult' | 'sparkcoil', lane, x, team? }.
 * They belong to the enemy unless `team: 'player'`; anyone of their side beside one can fire it.
 *
 * Each chapter names its overworld region (overworld-regions.ts); a mission's route is a
 * circuit of that region's waypoints. Regions open as the chapter before them is won.
 *
 * This story is a first draft: the prologue teaches the battle rules, chapters one and two
 * follow the sealed swords to House Corvane and the siege of Vellmark.
 */
export const CAMPAIGN: readonly Chapter[] = [
  {
    id: 'prologue',
    title: 'Prologue: The Three Roads',
    missions: [
      {
        id: 'north-road',
        route: ['fork', 'ford', 'fork', 'trail'],
        title: 'Wolves on the North Road',
        summary: 'A first paying contract: drive two bandits off the North Road.',
        band: 'Grey Wolf Scouts',
        level: 1,
        enemies: [
          { classId: 'fighter', name: 'Brask' },
          { classId: 'archer', name: 'Ivra' },
        ],
        briefing: [
          {
            speaker: 'Guildmaster Hollis',
            portrait: 'fighter',
            text: 'So you are the new company. Four blades, an empty purse, and a name nobody knows yet. Good. Nobody expects much of you.',
          },
          {
            speaker: '{leader}',
            portrait: 'leader',
            text: 'We came for work, Guildmaster, not for flattery.',
          },
          {
            speaker: 'Guildmaster Hollis',
            portrait: 'fighter',
            text: 'Then here is work. Three roads meet at this town, and the Grey Wolves have started taking tolls on the north one. Two of their scouts. Chase them off.',
          },
          {
            speaker: 'Guildmaster Hollis',
            portrait: 'fighter',
            text: 'Every fight is fought across three lanes. Walking spends the Move Gauge; skills spend the Action Gauge. Whatever action you leave unspent becomes a Guard that softens the next blow.',
          },
          {
            speaker: 'Guildmaster Hollis',
            portrait: 'fighter',
            text: 'Swords must close in to strike. Bows and spells reach farther, and land harder if you loose them on the mark. Now go earn your name.',
          },
        ],
        debrief: [
          {
            speaker: 'Guildmaster Hollis',
            portrait: 'fighter',
            text: 'The road is clear and the scouts ran home. Here is your pay. Spend it well: the Roster lets you hire, and every battle teaches your mercenaries something.',
          },
          {
            speaker: '{leader}',
            portrait: 'leader',
            text: 'Scouts run home to someone. Where do the Wolves make camp?',
          },
          {
            speaker: 'Guildmaster Hollis',
            portrait: 'fighter',
            text: 'At the ford, last I heard. That will be your next contract, if you want it.',
          },
        ],
        reward: { gold: 150 },
      },
      {
        id: 'the-ford',
        route: ['bridge', 'east', 'ridge', 'east'],
        title: 'Spikes at the Ford',
        summary:
          'The Wolves hold the river crossing, and they have salted the shallows with spikes.',
        band: 'Grey Wolves',
        level: 2,
        enemies: [
          { classId: 'lancer', name: 'Torv' },
          { classId: 'archer', name: 'Ulla' },
          { classId: 'cleric', name: 'Odo' },
        ],
        objects: [{ kind: 'trap', trap: 'spikes', lane: 1, x: 0.5 }],
        briefing: [
          {
            speaker: 'Guildmaster Hollis',
            portrait: 'fighter',
            text: 'The ford is shallow and the Wolves know it. They have hidden spikes in the middle lane, so watch where you walk. Spikes bite and poison.',
          },
          {
            speaker: 'Guildmaster Hollis',
            portrait: 'fighter',
            text: 'Their lancer has the longest reach on the field, and their cleric will mend whatever you break. Kill the healer, or you will be cutting the same wolf twice.',
          },
          {
            speaker: 'Guildmaster Hollis',
            portrait: 'fighter',
            text: 'Their archer will test your shields. A Fighter turns aside much of any blow from the front, and a Fighter on Guard shelters whoever stands behind it in the lane. Arrows from behind find no shield, on either side.',
          },
          {
            speaker: '{leader}',
            portrait: 'leader',
            text: 'A lane over is still a lane over. We go around.',
          },
        ],
        debrief: [
          {
            speaker: '{leader}',
            portrait: 'leader',
            text: 'Their lancer carried this. A letter, sealed, and a purse of new silver.',
          },
          {
            speaker: 'Guildmaster Hollis',
            portrait: 'fighter',
            text: 'Silver that new does not come from road tolls. Someone is paying the Wolves. Keep the letter; I know who can read that seal.',
          },
        ],
        reward: { gold: 200, items: ['charm'], gear: ['copper-ring'] },
      },
      {
        id: 'thorn-keep',
        route: ['pass', 'gate', 'pass', 'steps'],
        title: 'The Gate at Thorn Keep',
        summary: 'Break the barricade the Wolves raised at the old keep, or find a way around it.',
        band: 'Grey Wolves',
        level: 3,
        enemies: [
          { classId: 'fighter', name: 'Gorm' },
          { classId: 'gunner', name: 'Pell' },
          { classId: 'witch', name: 'Yrsa' },
          { classId: 'archer', name: 'Kell' },
        ],
        objects: [
          { kind: 'barricade', lane: 0, x: 0.6 },
          { kind: 'trap', trap: 'snare', lane: 2, x: 0.5 },
        ],
        briefing: [
          {
            speaker: 'Guildmaster Hollis',
            portrait: 'fighter',
            text: 'The seal is Thorn Keep’s, a ruin these twenty years. The Wolves have dug in there behind a barricade, and they have set a snare in the far lane.',
          },
          {
            speaker: 'Guildmaster Hollis',
            portrait: 'fighter',
            text: 'A barricade takes the blows meant for whoever hides behind it. Break it, or strike from another lane. A snare holds whoever steps in it for a turn.',
          },
          {
            speaker: 'Guildmaster Hollis',
            portrait: 'fighter',
            text: 'Fight together. As you deal damage, your assist orbs fill. Spend one and a squadmate strikes out of turn.',
          },
        ],
        debrief: [
          {
            speaker: '{leader}',
            portrait: 'leader',
            text: 'The keep is ours. Their captain was not here, only orders to hold the road until the wagons pass.',
          },
          {
            speaker: 'Guildmaster Hollis',
            portrait: 'fighter',
            text: 'Wagons. On a road nobody can travel without paying the Wolves. Their captain is Vargr, and he will be with those wagons. Find him.',
          },
        ],
        reward: { gold: 250, items: ['tactics'] },
      },
      {
        id: 'vargr',
        route: ['keep', 'gate'],
        title: 'The Grey Wolf',
        summary: 'Captain Vargr guards the wagons himself. End the Grey Wolves.',
        band: 'Vargr’s Pack',
        level: 4,
        enemies: [
          { classId: 'lancer', name: 'Vargr' },
          { classId: 'fighter', name: 'Hask' },
          { classId: 'witch', name: 'Rhea' },
          { classId: 'cleric', name: 'Sesk' },
        ],
        objects: [
          { kind: 'barricade', lane: 1, x: 0.6 },
          { kind: 'trap', trap: 'spikes', lane: 0, x: 0.48 },
          { kind: 'trap', trap: 'snare', lane: 2, x: 0.52 },
        ],
        briefing: [
          {
            speaker: 'Vargr',
            portrait: 'lancer',
            text: 'The little company from the guild hall. You have cost me a camp, a keep and a good many friends. You will not cost me these wagons.',
          },
          {
            speaker: '{leader}',
            portrait: 'leader',
            text: 'Who pays you, Vargr? Wolves do not mint silver.',
          },
          {
            speaker: 'Vargr',
            portrait: 'lancer',
            text: 'Win, and you can ask me again.',
          },
        ],
        debrief: [
          {
            speaker: 'Vargr',
            portrait: 'lancer',
            text: 'Enough. Look in the wagons, then, and see who you have made an enemy of.',
          },
          {
            speaker: '{leader}',
            portrait: 'leader',
            text: 'Swords. Hundreds of them, crated, with the same seal as the letter. Someone is arming the roads.',
          },
          {
            speaker: 'Guildmaster Hollis',
            portrait: 'fighter',
            text: 'Then the Wolves were only the first of it. Rest, train, hire. When the next chapter of this begins, the guild will need you.',
          },
        ],
        reward: { gold: 400, items: ['tactics', 'charm'], gear: ['hawk-charm'] },
      },
    ],
  },
  {
    id: 'saltmere',
    title: 'Chapter One: Salt and Silver',
    region: 'saltmere',
    missions: [
      {
        id: 's1-docks',
        route: ['s-net', 's-market', 's-net', 's-cross'],
        title: 'The Seal on the Crates',
        summary:
          'Follow the sealed crates to the Saltmere docks, where Corvane wardens stand guard.',
        band: 'Corvane Wardens',
        level: 5,
        // Hired dock wardens, a step greener than the squad: Saltmere's opener.
        enemies: [
          { classId: 'fighter', name: 'Dren Hollow', levelBonus: -1 },
          { classId: 'gunner', name: 'Saska', levelBonus: -1 },
          { classId: 'archer', name: 'Pim', levelBonus: -1 },
          { classId: 'cleric', name: 'Brother Tamsin', levelBonus: -1 },
        ],
        objects: [{ kind: 'engine', engine: 'ballista', lane: 0, x: 0.9 }],
        briefing: [
          {
            speaker: 'Guildmaster Hollis',
            portrait: 'fighter',
            text: 'The seal on those crates belongs to House Corvane: merchants, they call themselves. Their ships unload at Saltmere, where nobody asks what is in a crate.',
          },
          {
            speaker: 'Maren Tidewell',
            portrait: 'gunner',
            text: 'Nobody but me. My father kept the harbour until Corvane bought it out from under him. Their wardens guard the docks with a ballista now. A ballista, on a fish market.',
          },
          {
            speaker: '{leader}',
            portrait: 'leader',
            text: 'Then we take the docks, and the ballista with them.',
          },
          {
            speaker: 'Maren Tidewell',
            portrait: 'gunner',
            text: 'Mind the engine. Anyone standing beside it can fire it, theirs or yours. A bolt that size goes through everyone in its lane.',
          },
        ],
        debrief: [
          {
            speaker: 'Maren Tidewell',
            portrait: 'gunner',
            text: 'The manifests. Swords, spears, crossbows, all bound inland. And this: "For the lighthouse, by order of Master Quellin." Quellin is Corvane’s tinker.',
          },
          {
            speaker: '{leader}',
            portrait: 'leader',
            text: 'What does a tinker want with a lighthouse?',
          },
          {
            speaker: 'Maren Tidewell',
            portrait: 'gunner',
            text: 'Ships have been breaking on the rocks since spring. Every one of them a rival of Corvane’s. I think we are about to find out why.',
          },
        ],
        reward: { gold: 450, items: ['tactics'] },
      },
      {
        id: 's1-lighthouse',
        route: ['s-cliff', 's-light', 's-cliff', 's-dunes'],
        title: 'The Dark Lighthouse',
        summary:
          'Master Quellin has wired the lighthouse to wreck ships. Shut his contraption down.',
        band: 'Quellin’s Wreckers',
        level: 6,
        enemies: [
          { classId: 'witch', name: 'Master Quellin' },
          { classId: 'lancer', name: 'Joss' },
          { classId: 'gunner', name: 'Ketta' },
          { classId: 'fighter', name: 'Ruel' },
        ],
        objects: [
          { kind: 'engine', engine: 'sparkcoil', lane: 1, x: 0.74 },
          { kind: 'trap', trap: 'snare', lane: 2, x: 0.5 },
        ],
        briefing: [
          {
            speaker: 'Maren Tidewell',
            portrait: 'gunner',
            text: 'There. The light burns green, not gold. Ships steer for it thinking it is the channel, and run onto the Teeth.',
          },
          {
            speaker: 'Master Quellin',
            portrait: 'witch',
            text: 'Do you like my coil? Copper, brine and a little lightning. It sings when it strikes. Come closer and hear it.',
          },
          {
            speaker: '{leader}',
            portrait: 'leader',
            text: 'Keep clear of that thing. It reaches only so far, but whatever it touches will not move for a turn.',
          },
        ],
        debrief: [
          {
            speaker: 'Master Quellin',
            portrait: 'witch',
            text: 'You think this ends with me? I build what I am paid to build. Lady Iselde pays very well.',
          },
          {
            speaker: 'Maren Tidewell',
            portrait: 'gunner',
            text: 'Iselde Corvane. The head of the house. If she wants ships wrecked and roads armed, she wants a war.',
          },
          {
            speaker: '{leader}',
            portrait: 'leader',
            text: 'Then we find where she keeps her soldiers. Where does Corvane keep its accounts?',
          },
          {
            speaker: 'Maren Tidewell',
            portrait: 'gunner',
            text: 'In Saltmere Fort, behind walls and a catapult. You will need an engine of your own. Leave that to me.',
          },
        ],
        reward: { gold: 520, items: ['charm'], gear: ['swift-boots'] },
      },
      {
        id: 's1-fort',
        route: ['s-gate', 's-fort', 's-watch', 's-fort'],
        title: 'Storming Saltmere Fort',
        summary:
          'Assault the fort with a stolen ballista, past their own ballista and a barricade.',
        band: 'Saltmere Garrison',
        level: 7,
        enemies: [
          { classId: 'fighter', name: 'Ser Odran Vey' },
          { classId: 'lancer', name: 'Brannoc' },
          { classId: 'witch', name: 'Ilse Marrow' },
          { classId: 'gunner', name: 'Corwin' },
        ],
        objects: [
          { kind: 'engine', engine: 'ballista', lane: 1, x: 0.18, team: 'player' },
          { kind: 'engine', engine: 'ballista', lane: 2, x: 0.92 },
          { kind: 'barricade', lane: 0, x: 0.6 },
        ],
        briefing: [
          {
            speaker: 'Maren Tidewell',
            portrait: 'gunner',
            text: 'One ballista, liberated from the docks and dragged up the cliff path by six very tired fishermen. It is yours. Put someone beside it.',
          },
          {
            speaker: 'Ser Odran Vey',
            portrait: 'fighter',
            text: 'Sellswords at my gate. Go home. Whatever Saltmere paid you, House Corvane will pay you twice to walk away.',
          },
          {
            speaker: '{leader}',
            portrait: 'leader',
            text: 'We were not paid to come. That is the part your house never understands.',
          },
          {
            speaker: 'Maren Tidewell',
            portrait: 'gunner',
            text: 'They have a ballista of their own on the far wall, trained down the seaward lane. Cross that lane fast, or not at all.',
          },
        ],
        debrief: [
          {
            speaker: 'Maren Tidewell',
            portrait: 'gunner',
            text: 'Ledgers. Thousands of crowns to a siege camp at Vellmark, in the hills. Vellmark refused Corvane’s tolls last year.',
          },
          {
            speaker: '{leader}',
            portrait: 'leader',
            text: 'So she starves a town for saying no. How long can Vellmark hold?',
          },
          {
            speaker: 'Guildmaster Hollis',
            portrait: 'fighter',
            text: 'Not long. The guild is raising a relief column, and it needs a company that has already bloodied Corvane’s nose. That is you, if you will take it.',
          },
        ],
        reward: { gold: 650, items: ['tactics', 'charm'], gear: ['warding-amulet'] },
      },
    ],
  },
  {
    id: 'vellmark',
    title: 'Chapter Two: The Siege of Vellmark',
    region: 'vellmark',
    missions: [
      {
        id: 'v2-trenches',
        route: ['v-bridge', 'v-trench', 'v-bridge', 'v-mill'],
        title: 'Through the Siege Lines',
        summary: 'Break through Corvane’s trenches to reach the town, under catapult fire.',
        band: 'Corvane Sappers',
        level: 8,
        enemies: [
          { classId: 'lancer', name: 'Captain Garreth' },
          { classId: 'fighter', name: 'Mott' },
          { classId: 'archer', name: 'Wren' },
          { classId: 'cleric', name: 'Sister Vael' },
        ],
        objects: [
          { kind: 'engine', engine: 'catapult', lane: 0, x: 0.92 },
          { kind: 'engine', engine: 'sparkcoil', lane: 2, x: 0.72 },
          { kind: 'trap', trap: 'spikes', lane: 1, x: 0.48 },
        ],
        briefing: [
          {
            speaker: 'Guildmaster Hollis',
            portrait: 'fighter',
            text: 'Vellmark’s walls still stand, but Corvane has dug in all around them. The relief column cannot pass the trenches with their engines firing.',
          },
          {
            speaker: 'Captain Garreth',
            portrait: 'lancer',
            text: 'Turn back, or be buried in our trench. My lady pays for every head we take, and yours will be worth the most.',
          },
          {
            speaker: '{leader}',
            portrait: 'leader',
            text: 'Silence the catapult first. Everyone else, stay out of that coil’s reach until it is ours to ignore.',
          },
        ],
        debrief: [
          {
            speaker: 'Guildmaster Hollis',
            portrait: 'fighter',
            text: 'The column is through. Bread and arrows for Vellmark, and a gap in Corvane’s line. She will not forgive it.',
          },
          {
            speaker: '{leader}',
            portrait: 'leader',
            text: 'Good. An angry general makes mistakes. Where will she strike?',
          },
          {
            speaker: 'Guildmaster Hollis',
            portrait: 'fighter',
            text: 'The walls, tonight, with everything she has. Vellmark has two ballistae and nobody left who can aim them.',
          },
        ],
        reward: { gold: 720, items: ['tactics'] },
      },
      {
        id: 'v2-walls',
        route: ['v-batteries', 'v-wall', 'v-batteries', 'v-trench'],
        title: 'Hold the Walls',
        summary: 'Man Vellmark’s two ballistae against Corvane’s night assault.',
        band: 'Iron Pike Assault',
        level: 9,
        enemies: [
          { classId: 'fighter', name: 'Brann Ironside' },
          { classId: 'lancer', name: 'Kesh' },
          { classId: 'witch', name: 'Morwen' },
          { classId: 'gunner', name: 'Dace' },
        ],
        objects: [
          { kind: 'engine', engine: 'ballista', lane: 0, x: 0.16, team: 'player' },
          { kind: 'engine', engine: 'ballista', lane: 2, x: 0.16, team: 'player' },
          { kind: 'engine', engine: 'catapult', lane: 1, x: 0.92 },
        ],
        briefing: [
          {
            speaker: 'Maren Tidewell',
            portrait: 'gunner',
            text: 'I could not let you have all the fun. I have seen your crews work an engine; let me show the town’s gunners how.',
          },
          {
            speaker: 'Brann Ironside',
            portrait: 'fighter',
            text: 'Open the gate, Vellmark, and we spare the children. Make us break it, and we spare nobody.',
          },
          {
            speaker: '{leader}',
            portrait: 'leader',
            text: 'Two bolts, two lanes. Keep someone beside each one, and let them come to us.',
          },
        ],
        debrief: [
          {
            speaker: 'Maren Tidewell',
            portrait: 'gunner',
            text: 'They broke. Ironside is running for the keep road. The keep, the old one above the town, flies Corvane’s colours.',
          },
          {
            speaker: '{leader}',
            portrait: 'leader',
            text: 'She has been here all along, watching from the high ground.',
          },
          {
            speaker: 'Maren Tidewell',
            portrait: 'gunner',
            text: 'Then we go up and end it. We captured one of their catapults in the rout. It is yours, if you can haul it up the hill.',
          },
        ],
        reward: { gold: 820, items: ['charm'] },
      },
      {
        id: 'v2-keep',
        route: ['v-gatehouse', 'v-keep', 'v-tower', 'v-keep'],
        title: 'The Iron Lady',
        summary: 'Storm Vellmark Keep and face Lady Iselde Corvane herself.',
        band: 'House Corvane',
        level: 10,
        // The finale: Iselde fights well above the squad, her household in mythril.
        enemies: [
          { classId: 'witch', name: 'Lady Iselde', levelBonus: 5 },
          { classId: 'fighter', name: 'Ser Aldous', levelBonus: 3 },
          { classId: 'cleric', name: 'Mother Ysolde', levelBonus: 3 },
          { classId: 'gunner', name: 'Tavish', levelBonus: 3 },
        ],
        armoury: 3,
        objects: [
          { kind: 'engine', engine: 'sparkcoil', lane: 1, x: 0.8 },
          { kind: 'engine', engine: 'ballista', lane: 0, x: 0.9 },
          { kind: 'engine', engine: 'catapult', lane: 2, x: 0.92 },
          { kind: 'barricade', lane: 2, x: 0.62 },
        ],
        briefing: [
          {
            speaker: 'Lady Iselde',
            portrait: 'witch',
            text: 'The guild’s little company. You have cost me a harbour, a fort and a siege. Do you know what a war is worth, mercenary? I was about to find out.',
          },
          {
            speaker: '{leader}',
            portrait: 'leader',
            text: 'We know what it costs. We have been paying it since the North Road.',
          },
          {
            speaker: 'Lady Iselde',
            portrait: 'witch',
            text: 'Then pay the rest.',
          },
          {
            speaker: 'Maren Tidewell',
            portrait: 'gunner',
            text: 'Her household wears Corvane mythril, and every engine on those walls is theirs. This is the hardest fight we will ever have. Go in rested and armed.',
          },
        ],
        debrief: [
          {
            speaker: 'Lady Iselde',
            portrait: 'witch',
            text: 'You think I was the buyer? I was a merchant, nothing more. Someone across the sea wanted these hills hungry and armed. Look at the last ledger.',
          },
          {
            speaker: 'Maren Tidewell',
            portrait: 'gunner',
            text: 'Paid in coin I have never seen. A crown on one side, a closed eye on the other.',
          },
          {
            speaker: 'Guildmaster Hollis',
            portrait: 'fighter',
            text: 'Vellmark is free and Corvane is broken. The guild has a name for you now, {leader}, and kings will learn it. Rest. When that coin turns up again, we will need you.',
          },
        ],
        reward: { gold: 1000, items: ['tactics', 'tactics', 'charm'], gear: ['vigil-crest'] },
      },
    ],
  },
];
