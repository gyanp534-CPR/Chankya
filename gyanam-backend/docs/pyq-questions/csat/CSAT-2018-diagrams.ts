// Auto-extracted diagram descriptors from CSAT-2018.txt.
// Keep in sync with the question text.

export const polyhedron = {
  type: "3d_wireframe",

  vertices: [
    "top",
    "bottom",
    "m1","m2","m3","m4","m5","m6"
  ],

  edges: [
    ["top","m1"],["top","m2"],["top","m3"],
    ["bottom","m4"],["bottom","m5"],["bottom","m6"],
    ["m1","m2"],["m2","m3"],["m3","m4"],
    ["m4","m5"],["m5","m6"],["m6","m1"]
  ],

  hiddenEdges: "diagonals"
};

export const velocityGraph = {
  type: "velocity_time",

  axes: {
    x: "time",
    y: "velocity"
  },

  vehicleA: {
    type: "linear",
    from: [0,0],
    to: [10,10]
  },

  vehicleB: {
    type: "constant",
    y: 5
  },

  points: {
    O: [0,0],
    K: [5,5],
    P: [10,10],
    D: [10,5],
    L: [10,0]
  },

  condition: "PD = 1/2 LD"
};

export const steelImports = {
  type: "multi_bar_chart",

  axes: {
    x: ["Jan", "Feb", "Mar", "Apr", "May", "Jun"],
    yLabel: "Thousands of Tons"
  },

  categories: [
    { name: "Coil", price: 320 },
    { name: "Sheet", price: 256 },
    { name: "Scrap", price: 175 }
  ],

  data: {
    Coil:   [30, 31, 33, 34, 36, 38],
    Sheet:  [40, 37, 36, 37, 34, 35],
    Scrap:  [32, 34, 32, 31, 32, 32]
  }
};

export const cubeData = {
  type: "cube_rotation",

  symbols: [
    "single_dot",
    "two_dots",
    "three_dots",
    "four_dots",
    "line",
    "cross"
  ],

  views: [
    {
      id: "I",
      top: "line",
      front: "single_dot",
      right: "two_dots"
    },
    {
      id: "II",
      top: "line",
      front: "three_dots",
      right: "two_dots"
    },
    {
      id: "III",
      top: "line",
      front: "three_dots",
      right: "four_dots"
    },
    {
      id: "IV",
      top: "cross",
      front: "two_dots",
      right: "single_dot"
    }
  ]
};

export const cube = {
  type: "cube",

  faces: ["dot1","dot2","dot3","line","cross","unknown"],

  views: [
    { top: "line", front: "dot1" },
    { top: "line", front: "dot2" },
    { top: "line", front: "dot3" },
    { top: "cross", front: "dot2" }
  ]
};

export const progressGraph = {
  type: "line_graph",

  x: ["Apr","May","Jun","Jul","Aug","Sep"],

  datasets: [
    {
      label: "Expected",
      style: "dashed",
      data: [0,25,50,60,70,100]
    },
    {
      label: "Actual",
      style: "solid",
      data: [0,10,20,30,40,100]
    }
  ]
};

// Alternate representation included in the source notes.
export const progressGraphAlt = {
  type: "dual_line",

  labels: ["Apr","May","Jun","Jul","Aug","Sep"],

  expected: [0,40,60,70,80,100],
  actual:   [0,20,30,40,60,100]
};

export const winnersStand = {
  type: "block_diagram",

  blocks: [
    {
      position: "left",
      rank: 1,
      height: 3
    },
    {
      position: "middle",
      rank: 2,
      height: 2
    },
    {
      position: "right",
      rank: 3,
      height: 1
    }
  ],

  rules: {
    totalColorsAvailable: 6,
    constraint: "no two blocks have same color"
  }
};

export const populationGraph = {
  type: "dual_line",

  birthRate: [30,28,24,20,18],
  deathRate: [25,20,14,8,7]
};

export const earningsGraph = {
  type: "line_graph",

  x: [2013,2014,2015,2016,2017],

  data: [20,25,30,35,40],

  variants: [
    {
      id: "A",
      style: "simple_line"
    },
    {
      id: "B",
      style: "line_with_vertical_guides"
    }
  ]
};

export const patternGrid = {
  type: "matrix_pattern",

  size: [3,3],

  symbols: ["dot","square","arrow"],

  grid: [
    [
      { symbol: "dot", shape: "arc", count: 2 },
      { symbol: "square", shape: "line", count: 3 },
      { symbol: "arrow", shape: "arc", count: 4 }
    ],
    [
      { symbol: "square", shape: "line", count: 4 },
      { symbol: "arrow", shape: "arc", count: 2 },
      { symbol: "dot", shape: "arc", count: 3 }
    ],
    [
      { symbol: "arrow", shape: "arc", count: 3 },
      { symbol: "dot", shape: "arc", count: 4 },
      { symbol: null, shape: null, count: null }
    ]
  ],

  rules: {
    symbolCycle: ["dot","square","arrow"],
    countPattern: [2,3,4],
    shift: "left_rotation_each_row"
  }
};

export const options = [
  { id: "a", symbol: "square", count: 2 },
  { id: "b", symbol: "dot", count: 2 },
  { id: "c", symbol: "arrow", count: 2 },
  { id: "d", symbol: "dot", count: 2, orientation: "reverse" }
];

export const costPriceDrawable = {
  cost: [5,6,7,8],
  price: [500,400,350,300],
  quantity: [0,1000,2000,3000]
};

export const circularPattern = {
  type: "circular_sequence",

  sectors: 6,

  elements: ["triangle", "square"],

  sequence: [
    { triangle: 3, square: 1 },
    { triangle: 4, square: 2 },
    { triangle: 5, square: 3 },
    { triangle: 1, square: 4 },
    { triangle: 2, square: 5 },
    { triangle: 3, square: 6 }
  ],

  rule: {
    triangle: "clockwise +1",
    square: "clockwise +1 (phase shifted)"
  }
};

export const demographicDrawable = {
  type: "multi_line",

  countryA: {
    young: [0.3,0.3,0.25,0.2,0.18],
    working: [0.4,0.7,1.0,0.95,0.85],
    old: [0.05,0.08,0.12,0.2,0.3]
  },

  countryB: {
    young: [0.2,0.25,0.3,0.3,0.28],
    working: [0.2,0.5,0.8,1.05,1.1],
    old: [0.05,0.07,0.1,0.18,0.25]
  }
};

export const policyRatesDrawable = {
  type: "line_chart",

  axes: {
    x: ["Jul","Sep","Nov","Jan","Mar","Jun"],
    yRange: [3, 8]
  },

  series: [
    {
      name: "repo",
      points: [5.5, 6.0, 6.2, 6.5, 7.0, 7.5]
    },
    {
      name: "reverseRepo",
      points: [4.0, 5.0, 5.3, 5.5, 5.8, 6.0]
    },
    {
      name: "crr",
      points: [6.0, 6.0, 6.0, 6.0, 6.0, 6.0]
    }
  ]
};

export const taxGraph = {
  type: "multi_line",

  x: ["1990","1995","2000","2005","2010"],

  series: [
    {
      name: "excise",
      trend: "decreasing",
      values: [40,35,30,25,20]
    },
    {
      name: "customs",
      trend: "decreasing",
      values: [35,25,20,18,15]
    },
    {
      name: "corporate",
      trend: "increasing",
      values: [10,20,25,30,35]
    },
    {
      name: "personal_income",
      trend: "slight_increase",
      values: [15,16,17,18,19]
    },
    {
      name: "service_tax",
      trend: "sharp_increase",
      values: [2,5,8,10,12]
    }
  ]
};
