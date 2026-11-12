// Witch's House. Based on Quest Helper's WitchsHouse (BSD 2-Clause, (c) 2020 Zoinkwiz).
// EASCape: steps, options and positions from our scripts (boy, quest_ball, witches_diary,
// witches_experiement) and maps.
module.exports = {
  quest: 'ball',
  members: true,
  difficulty: 'Intermediate',
  start: 'Talk to the boy by the garden north of Taverley.',
  items: {
    doorkey: { name: 'Door key', obj: 'witches_doorkey', tip: 'Under the flower pot by the witch\'s front door' },
    gloves: { name: 'Leather gloves', obj: 'leather_gloves', tip: 'Thessalia sells them in Varrock' },
    cheese: { name: 'Cheese', obj: 'cheese', tip: 'Wydin sells it in Port Sarim' },
    magnet: { name: 'Magnet', obj: 'magnet' },
    shedkey: { name: 'Key (shed)', obj: 'witches_shedkey', tip: 'In the fountain in the witch\'s garden' },
    ball: { name: 'Ball', obj: 'ball' },
  },
  required: ['gloves', 'cheese'],
  skills: ['Able to defeat a shapeshifter that changes form four times (up to level 53)'],
  zones: {
    basement: [2885, 9860, 2915, 9885, 0],
    shed: [2934, 3459, 2937, 3467, 0],
  },
  steps: {
    start: { text: 'Talk to the boy by the garden north of Taverley.', npc: 'ballboy', at: [2928, 3456, 0], options: ["What's the matter?", "Ok, I'll see what I can do."] },
    pot: { text: "Search the flower pot by the witch's front door for the door key.", loc: 'witchpot', at: [2900, 3474, 0] },
    ladder: { text: 'Unlock the front door with the key and climb down the ladder in the house.', loc: 'loc_1754', at: [2907, 3476, 0], items: ['doorkey', 'gloves'] },
    cupboard: { text: 'Wear the leather gloves to go through the electrified gate, then search the cupboard for a magnet.', loc: 'magnetcbshut', at: [2898, 9873, 0], items: ['gloves'] },
    ladderUp: { text: 'Climb back up the ladder.', loc: 'loc_1755', at: [2907, 9876, 0] },
    mouse: { text: 'Use the cheese on the mouse hole in the room south of the entrance, then use the magnet on the mouse.', loc: 'witchmousehole', at: [2903, 3466, 0], items: ['cheese', 'magnet'] },
    fountain: { text: 'Go through the back door into the garden and check the fountain for the shed key. Keep out of the witch\'s sight.', loc: 'witchfountain', at: [2909, 3470, 0] },
    shed: { text: 'Use the key on the shed door in the garden.', loc: 'witchsheddoor', at: [2934, 3463, 0], items: ['shedkey'] },
    ball: { text: 'Pick up the ball. A shapeshifter appears: kill it in all four of its forms, then take the ball.', obj: 'ball', at: [2935, 3460, 0] },
    finish: { text: 'Bring the ball back to the boy.', npc: 'ballboy', at: [2928, 3456, 0], items: ['ball'] },
  },
  stages: {
    0: [[null, 'start']],
    1: [
      ['in:basement', 'cupboard'],
      ['have:doorkey', 'ladder'],
      [null, 'pot'],
    ],
    2: [
      ['in:basement', 'ladderUp'],
      [null, 'mouse'],
    ],
    '3-5': [
      ['in:shed', 'ball'],
      ['have:shedkey', 'shed'],
      [null, 'fountain'],
    ],
    6: [
      ['have:ball', 'finish'],
      [null, 'ball'],
    ],
  },
  sections: [
    { title: 'Starting off', steps: ['start'] },
    { title: 'The magnet', steps: ['pot', 'ladder', 'cupboard', 'ladderUp'], items: ['gloves'] },
    { title: 'The back door', steps: ['mouse'], items: ['cheese'] },
    { title: 'The ball', steps: ['fountain', 'shed', 'ball', 'finish'] },
  ],
  rewards: ['4 Quest Points', '6,325 Hitpoints experience'],
};
