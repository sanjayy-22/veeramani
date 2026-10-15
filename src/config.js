const STATES = Object.freeze({
  MENU: "MENU",
  HUB: "HUB",
  PLAYING: "PLAYING",
  PAUSED: "PAUSED",
  PORTAL_TRANSITION: "PORTAL_TRANSITION",
  BOSS: "BOSS",
  GAME_OVER: "GAME_OVER",
  VICTORY: "VICTORY",
});
const LEVELS = [
  {
    name: "Madurai Diwali Street",
    short: "Madurai after dark",
    sky: 0x172e4a,
    ground: 0x526274,
    fog: 0x23394c,
    time: 420,
    aliens: 3,
    speed: 3.35,
    gravity: 24,
    target: 48,
    description:
      "Green guests have beamed your festival table empty! Follow their trail. Throw a sparkler with E or click, then touch a dizzy thief. Recover all 48 sweets to open the first portal.",
  },
  {
    name: "Ancient Tamil Kingdom",
    short: "A kingdom of trouble",
    sky: 0xc98470,
    ground: 0xc4a475,
    fog: 0xd6a889,
    time: 450,
    aliens: 4,
    speed: 3.85,
    gravity: 24,
    target: 52,
    description:
      "The thieves have landed in a bustling ancient kingdom. Jump the market stalls and rolling pots. Their loops are predictable: cut a corner and catch them at the turn.",
  },
  {
    name: "Prehistoric Jungle",
    short: "Jurassic snack break",
    sky: 0x3f6970,
    ground: 0x52694c,
    fog: 0x607e68,
    time: 480,
    aliens: 4,
    speed: 4.05,
    gravity: 24,
    target: 52,
    description:
      "A very large friend is crossing the trail. Watch the dinosaur’s rhythm, jump glowing lava cracks, and use the open side paths. Greedy aliens stop for a snack every few seconds.",
  },
  {
    name: "Mars · The Last Laddu",
    short: "Next stop: Mars",
    sky: 0x291e40,
    ground: 0xb45d4d,
    fog: 0x784b63,
    time: 500,
    aliens: 3,
    speed: 4.2,
    gravity: 13,
    target: 60,
    description:
      "Low gravity means bigger jumps! Catch the crew to wake the Chief. Dodge his marked slime drops, wait for his shield to open, then land three sparklers and collect the golden box’s stash.",
  },
];
const SWEETS = [
  { name: "Laddu", value: 10, color: 0xffbc3e },
  { name: "Jalebi", value: 15, color: 0xff7626 },
  { name: "Mysore pak", value: 20, color: 0xf3d270 },
  { name: "Gulab jamun", value: 25, color: 0x99472a },
  { name: "Adhirasam", value: 30, color: 0xc48044 },
  { name: "Tirunelveli halwa", value: 40, color: 0xe7582c },
];
export { STATES, LEVELS, SWEETS };
