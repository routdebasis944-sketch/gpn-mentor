// Curated SCTE&VT Odisha diploma subject map used by the Syllabus Tracker.
// Each topic is one video lecture the student can watch and mark as done.
export type Subject = { sem: number; name: string; topics: string[] };

const COMMON: Subject[] = [
  { sem: 1, name: "Engineering Mathematics-I", topics: ["Matrices & Determinants", "Trigonometry", "Complex Numbers"] },
  { sem: 1, name: "Engineering Physics", topics: ["Units & Measurement", "Ohm's Law & Current Electricity", "Optics Basics"] },
  { sem: 2, name: "Engineering Mechanics", topics: ["Force Systems", "Friction", "Centre of Gravity"] },
  { sem: 2, name: "Engineering Drawing", topics: ["Orthographic Projection", "Isometric Views", "Sections of Solids"] },
];

const BY_BRANCH: Record<string, Subject[]> = {
  Electrical: [
    { sem: 3, name: "Circuit & Network Theory", topics: ["Kirchhoff's Laws", "Network Theorems", "AC Circuits"] },
    { sem: 4, name: "Electrical Machines-I", topics: ["DC Generator", "DC Motor", "Transformer"] },
    { sem: 5, name: "Power Systems", topics: ["Transmission Lines", "Switchgear & Protection", "Substations"] },
    { sem: 6, name: "Utilization of Electrical Energy", topics: ["Electric Traction", "Illumination", "Electric Heating"] },
  ],
  Electronics: [
    { sem: 3, name: "Analog Electronics", topics: ["PN Junction Diode", "BJT Amplifiers", "Rectifiers"] },
    { sem: 4, name: "Digital Electronics", topics: ["Logic Gates", "Flip-Flops", "Counters"] },
    { sem: 5, name: "Microprocessor 8085", topics: ["8085 Architecture", "Instruction Set", "Interfacing"] },
    { sem: 6, name: "Communication Engineering", topics: ["Amplitude Modulation", "Frequency Modulation", "Digital Communication"] },
  ],
  Mechanical: [
    { sem: 3, name: "Strength of Materials", topics: ["Stress & Strain", "Bending Moment", "Torsion"] },
    { sem: 4, name: "Thermal Engineering", topics: ["Laws of Thermodynamics", "IC Engines", "Steam Boilers"] },
    { sem: 5, name: "Manufacturing Processes", topics: ["Lathe Operations", "Welding", "Casting"] },
    { sem: 6, name: "Metrology & Quality Control", topics: ["Vernier Caliper & Micrometer", "Limits, Fits & Tolerances", "Quality Control Charts"] },
  ],
  Civil: [
    { sem: 3, name: "Building Materials & Construction", topics: ["Bricks & Cement", "Concrete Mix", "Masonry"] },
    { sem: 4, name: "Surveying", topics: ["Chain Surveying", "Levelling", "Theodolite"] },
    { sem: 5, name: "Concrete Technology", topics: ["Workability & Slump Test", "Mix Design", "Curing"] },
    { sem: 6, name: "Estimating & Costing", topics: ["Rate Analysis", "Building Estimate", "Road Estimate"] },
  ],
  "Computer Science": [
    { sem: 3, name: "Programming in C", topics: ["Variables & Loops", "Arrays & Functions", "Pointers"] },
    { sem: 4, name: "Data Structures", topics: ["Stacks & Queues", "Linked Lists", "Sorting Algorithms"] },
    { sem: 5, name: "Database Management", topics: ["ER Model", "SQL Queries", "Normalization"] },
    { sem: 6, name: "Computer Networks", topics: ["OSI Model", "TCP/IP", "Network Security"] },
  ],
};

export const TRACK_BRANCHES = ["Electrical", "Electronics", "Mechanical", "Civil", "Computer Science"];
export const INTERVIEW_BRANCHES = ["Computer Science / IT", "Mechanical", "Electrical", "Electronics", "Civil"];

export const subjectsFor = (branch: string): Subject[] => [...COMMON, ...(BY_BRANCH[branch] ?? [])];
export const topicKey = (branch: string, s: Subject, t: string) => `${branch}|${s.sem}|${s.name}|${t}`;
export const videoSearchUrl = (s: Subject, t: string) =>
  `https://www.youtube.com/results?search_query=${encodeURIComponent(`${t} ${s.name} diploma polytechnic lecture`)}`;
