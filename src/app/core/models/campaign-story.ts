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
 * This prologue is a first draft: it teaches the battle rules and sets up a hook.
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
        reward: { gold: 200, items: ['charm'] },
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
        reward: { gold: 400, items: ['tactics', 'charm'] },
      },
    ],
  },
];
