export const GRID_COLS = 22;
export const GRID_ROWS = 5;
export const GRID_ROWS_MIN = 1;
export const GRID_ROWS_MAX = 10;

export const SCRAMBLE_DURATION = 800;
export const FLIP_DURATION = 300;
export const STAGGER_DELAY = 6;
export const TOTAL_TRANSITION = 3800;
export const MESSAGE_INTERVAL = 4000;

export const CHARSET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.,-!?'/: ";

export const COLOR_MAP = {
  k: "#000000",
  r: "#FF2200",
  o: "#FF8800",
  y: "#FFDD00",
  g: "#22BB44",
  b: "#0088FF",
  p: "#9900CC",
  w: "#FFFFFF",
};

// Full animation sequence: black tile first, characters in middle, other color tiles at end
export const FULL_CHARSET = [
  "\\k",
  ...CHARSET.split(""),
  "\\r",
  "\\o",
  "\\y",
  "\\g",
  "\\b",
  "\\p",
  "\\w",
];

export const SCRAMBLE_COLORS = [
  "#00AAFF",
  "#00FFCC",
  "#AA00FF",
  "#FF2D00",
  "#FFCC00",
  "#FFFFFF",
];

export const ACCENT_COLORS = [
  "#00FF7F",
  "#FF4D00",
  "#AA00FF",
  "#00AAFF",
  "#00FFCC",
];

export const MESSAGES = [
  ["", "GOD IS IN", "THE DETAILS .", "- LUDWIG MIES", ""],
  ["", "STAY HUNGRY", "STAY FOOLISH", "- STEVE JOBS", ""],
  ["", "GOOD DESIGN IS", "GOOD BUSINESS", "- THOMAS WATSON", ""],
  ["", "LESS IS MORE", "", "- MIES VAN DER ROHE", ""],
  ["", "MAKE IT SIMPLE", "BUT SIGNIFICANT", "- DON DRAPER", ""],
  ["", "HAVE NO FEAR OF", "PERFECTION", "- SALVADOR DALI", ""],
];
