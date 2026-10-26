// Generates src/data/games.json from compact price tables (source: topupgames.id, snapshot 2026-10-26).
import { writeFileSync } from "node:fs";

const ml = [[5,1713],[10,3421],[11,3988],[12,3988],[14,5129],[15,5129],[19,6263],[20,6836],[22,7403],[28,9110],[30,10245],[36,11953],[42,13676],[44,13676],[45,14806],[46,15373],[54,17091],[56,17658],[59,18229],[60,19366],[64,19936],[65,21074],[67,21641],[70,22211],[74,23352],[75,23916],[78,24552],[80,25623],[85,26203],[86,27333],[88,27341],[89,27911],[92,29041],[98,30772],[100,31339],[110,34755],[112,35322],[116,36461],[128,39878],[140,43860],[148,46142],[170,52408],[172,53542],[176,54680],[222,68912],[223,69488]];
const ff = [[5,799],[40,5853],[50,6215],[55,6990],[60,7766],[70,8458],[75,9234],[80,10010],[90,11567],[95,12342],[100,12429],[120,14673],[125,15449],[130,16224],[140,16917],[145,17692],[150,18468],[160,20020],[170,20882],[180,22434],[190,23126],[200,24677],[210,25370],[230,28489],[250,30903],[260,31595],[280,33839],[300,36942],[350,42291],[360,43066],[375,45394],[400,48501],[420,50744],[455,54709],[475,56953],[495,59197],[500,59972],[512,61663],[520,63075],[545,65406],[565,67650],[600,72391],[635,76103],[645,77654],[655,79206]];
const gi = [["60 Genesis Crystals",17356],["300+30 Genesis Crystals",85175],["980+110 Genesis Crystals",268084],["1980+260 Genesis Crystals",514067]];

const games = [
  {
    slug: "mobile-legends", name: "Mobile Legends", publisher: "Moonton", currencyName: "Diamond",
    image: "/games/ml-logo.webp", banner: "/games/ml-banner.webp", icon: "/icons/diamond-ml.svg",
    description: "Top up Diamond Mobile Legends: Bang Bang. Masukkan ID dan Server, bayar crypto, diamond masuk otomatis.",
    fields: [
      { key: "userId", label: "ID", placeholder: "Masukkan ID", type: "text" },
      { key: "zoneId", label: "Server", placeholder: "Masukkan Server", type: "text" },
    ],
    products: ml.map(([n, p]) => ({ id: `ml-${n}`, name: `Mobile Legends ${n} Diamond`, price: p, image: "/icons/diamond-ml.svg" })),
  },
  {
    slug: "genshin-impact", name: "Genshin Impact", publisher: "HoYoverse", currencyName: "Genesis Crystals",
    image: "/games/gi-logo.webp", banner: "/games/gi-banner.webp", icon: "/icons/crystal-gi.svg",
    description: "Top up Genesis Crystals Genshin Impact. Masukkan UID dan pilih server.",
    fields: [
      { key: "userId", label: "UID", placeholder: "Masukkan UID", type: "text" },
      { key: "zoneId", label: "Server", placeholder: "Pilih Server", type: "select", options: ["Asia", "America", "Europe", "TW_HK_MO"] },
    ],
    products: gi.map(([name, p], i) => ({ id: `gi-${i + 1}`, name, price: p, image: "/icons/crystal-gi.svg" })),
  },
  {
    slug: "free-fire", name: "Free Fire", publisher: "Garena", currencyName: "Diamond",
    image: "/games/ff-logo.webp", banner: "/games/ff-banner.webp", icon: "/icons/diamond-ff.svg",
    description: "Top up Diamond Free Fire. Cukup masukkan ID pemain.",
    fields: [{ key: "userId", label: "ID", placeholder: "Masukkan ID", type: "text" }],
    products: ff.map(([n, p]) => ({ id: `ff-${n}`, name: `Free Fire ${n} Diamond`, price: p, image: "/icons/diamond-ff.svg" })),
  },
];
writeFileSync("src/data/games.json", JSON.stringify(games, null, 2) + "\n");
console.log("games.json:", games.map((g) => `${g.slug}=${g.products.length}`).join(" "));
