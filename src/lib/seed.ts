import type { DB, MenuItem } from "./types";

const photos = {
  coffee: "/food/coffee.jpg",
  latte: "/food/latte.jpg",
  tea: "/food/tea.jpg",
  hotChocolate: "/food/hot-chocolate.jpg",
  lemonade: "/food/lemonade.jpg",
  lassi: "/food/lassi.jpg",
  soda: "/food/soda.jpg",
  water: "/food/water.jpg",
  fries: "/food/fries.jpg",
  momo: "/food/momo.jpg",
  noodles: "/food/noodles.jpg",
  pakoda: "/food/pakoda.jpg",
  sausage: "/food/sausage.jpg",
  wings: "/food/wings.jpg",
  dalbhat: "/food/dalbhat.jpg",
  friedRice: "/food/fried-rice.jpg",
  burger: "/food/burger.jpg",
  pizza: "/food/pizza.jpg",
  thukpa: "/food/thukpa.jpg",
  pancakes: "/food/pancakes.jpg",
  omelette: "/food/omelette.jpg",
  oats: "/food/oats.jpg",
};

function item(
  id: string,
  categoryId: string,
  name: string,
  nameNe: string,
  price: number,
  description: string,
  descriptionNe: string,
  opts: Partial<MenuItem> = {},
): MenuItem {
  return {
    id,
    categoryId,
    name,
    nameNe,
    description,
    descriptionNe,
    price,
    photo: null,
    diet: "veg",
    spice: 0,
    stock: "in",
    sortOrder: 0,
    popular: false,
    special: false,
    prepMin: 10,
    availableWindow: null,
    ...opts,
  };
}

export function seedDB(): DB {
  const categories = [
    { id: "cat-coffee", name: "Coffee & Tea", nameNe: "कफी र चिया", sortOrder: 0 },
    { id: "cat-cold", name: "Cold Drinks", nameNe: "चिसो पेय", sortOrder: 1 },
    { id: "cat-snacks", name: "Snacks", nameNe: "खाजा", sortOrder: 2 },
    { id: "cat-meals", name: "Meals", nameNe: "खाना", sortOrder: 3 },
    { id: "cat-breakfast", name: "Breakfast", nameNe: "बिहानको खाजा", sortOrder: 4 },
  ];

  const items: MenuItem[] = [
    item("i-espresso", "cat-coffee", "Espresso", "एस्प्रेसो", 150, "Double shot, house-roasted beans.", "डबल शट, हाउस रोस्टेड बीन्स।", { photo: photos.coffee, prepMin: 4, sortOrder: 0 }),
    item("i-latte", "cat-coffee", "Café Latte", "क्याफे लाटे", 250, "Silky steamed milk over a double shot.", "डबल शटमा स्टीम गरिएको दूध।", { photo: photos.latte, prepMin: 6, popular: true, sortOrder: 1 }),
    item("i-cappuccino", "cat-coffee", "Cappuccino", "क्यापुचिनो", 240, "Classic foam-topped espresso.", "फोम सहितको क्लासिक एस्प्रेसो।", { photo: photos.latte, prepMin: 6, sortOrder: 2 }),
    item("i-milktea", "cat-coffee", "Milk Tea", "दूध चिया", 80, "Nepali-style spiced milk tea.", "नेपाली शैलीको मसला दूध चिया।", { photo: photos.tea, prepMin: 5, popular: true, sortOrder: 3 }),
    item("i-blacktea", "cat-coffee", "Black Tea", "कालो चिया", 50, "Hot black tea with lemon on request.", "कागती सहित/बिना कालो चिया।", { photo: photos.tea, prepMin: 3, sortOrder: 4 }),
    item("i-hotchoc", "cat-coffee", "Hot Chocolate", "हट चकलेट", 280, "Rich cocoa, whipped cream.", "गाढा कोको, व्हिप्ड क्रिम।", { photo: photos.hotChocolate, prepMin: 7, sortOrder: 5 }),

    item("i-lemonade", "cat-cold", "Fresh Lemonade", "ताजा कागती पानी", 120, "Chilled, lightly sweet, post-game favourite.", "चिसो, हल्का गुलियो — खेलपछिको रोजाइ।", { photo: photos.lemonade, prepMin: 4, popular: true, sortOrder: 0 }),
    item("i-lassi", "cat-cold", "Sweet Lassi", "गुलियो लस्सी", 180, "Thick yogurt lassi.", "बाक्लो दहीको लस्सी।", { photo: photos.lassi, prepMin: 5, sortOrder: 1 }),
    item("i-coke", "cat-cold", "Coke / Fanta / Sprite", "कोक / फेन्टा / स्प्राइट", 100, "Chilled bottle 250ml.", "चिसो बोतल २५०मि.लि.।", { photo: photos.soda, prepMin: 2, sortOrder: 2 }),
    item("i-water", "cat-cold", "Mineral Water", "मिनरल वाटर", 40, "1L sealed bottle.", "१ लिटर सिल बोतल।", { photo: photos.water, prepMin: 1, sortOrder: 3 }),
    item("i-icecoffee", "cat-cold", "Iced Coffee", "आइस कफी", 260, "Cold brew over ice with milk.", "बरफ र दूधसँग कोल्ड ब्रू।", { photo: photos.coffee, prepMin: 6, sortOrder: 4 }),
    item("i-energy", "cat-cold", "Electrolyte Cooler", "इलेक्ट्रोलाइट कूलर", 150, "Citrus rehydration mix — made for match days.", "सिट्रस रिहाइड्रेसन — खेल दिनका लागि।", { photo: photos.lemonade, prepMin: 3, popular: true, sortOrder: 5 }),

    item("i-fries", "cat-snacks", "French Fries", "फ्रेन्च फ्राइज", 160, "Crispy, salted, ketchup on the side.", "करकरा, नुनिलो, केचप सहित।", { photo: photos.fries, prepMin: 10, popular: true, sortOrder: 0 }),
    item("i-vegmomo", "cat-snacks", "Veg Momo (10 pcs)", "भेज मम (१०)", 150, "Steamed, with sesame-tomato achar.", "स्टीम, तिल-गोलभेडा अचारसँग।", { photo: photos.momo, prepMin: 15, spice: 1, sortOrder: 1 }),
    item("i-chickenmomo", "cat-snacks", "Chicken Momo (10 pcs)", "चिकन मम (१०)", 200, "Juicy steamed momo, house achar.", "रसिलो स्टीम मम, हाउस अचार।", { photo: photos.momo, diet: "nonveg", prepMin: 15, spice: 1, popular: true, sortOrder: 2 }),
    item("i-chowmein", "cat-snacks", "Chicken Chowmein", "चिकन चाउमिन", 180, "Wok-fried noodles, veg and chicken.", "तरकारी र चिकनसँग भुटेको चाउमिन।", { photo: photos.noodles, diet: "nonveg", prepMin: 12, spice: 2, sortOrder: 3 }),
    item("i-pakoda", "cat-snacks", "Veg Pakoda", "भेज पकौडा", 140, "Monsoon-crisp fritters with chutney.", "चट्नीसँग करकरा पकौडा।", { photo: photos.pakoda, prepMin: 12, spice: 1, sortOrder: 4 }),
    item("i-sausage", "cat-snacks", "Grilled Sausage", "ग्रिल्ड ससेज", 220, "Pan-grilled, mustard dip.", "प्यान ग्रिल्ड, तोरीको डिप।", { photo: photos.sausage, diet: "nonveg", prepMin: 10, sortOrder: 5 }),
    item("i-wings", "cat-snacks", "Spicy Wings (6 pcs)", "स्पाइसी विंग्स (६)", 320, "Tossed in house chilli glaze.", "हाउस खुर्सानी ग्लेजमा।", { photo: photos.wings, diet: "nonveg", prepMin: 18, spice: 3, sortOrder: 6 }),

    item("i-dalbhat", "cat-meals", "Dal Bhat Set (Veg)", "दाल भात सेट (भेज)", 350, "Rice, dal, seasonal tarkari, achar, papad.", "भात, दाल, मौसमी तरकारी, अचार, पापड।", { photo: photos.dalbhat, prepMin: 20, sortOrder: 0 }),
    item("i-dalbhat-c", "cat-meals", "Dal Bhat Set (Chicken)", "दाल भात सेट (चिकन)", 450, "The veg set plus chicken curry.", "भेज सेट + चिकन करी।", { photo: photos.dalbhat, diet: "nonveg", prepMin: 22, spice: 1, popular: true, sortOrder: 1 }),
    item("i-friedrice", "cat-meals", "Chicken Fried Rice", "चिकन फ्राइड राइस", 260, "Egg, spring onion, soy.", "अण्डा, हरियो प्याज, सोया।", { photo: photos.friedRice, diet: "nonveg", prepMin: 15, sortOrder: 2 }),
    item("i-burger", "cat-meals", "Chicken Burger + Fries", "चिकन बर्गर + फ्राइज", 380, "Crispy fillet, slaw, house sauce.", "करकरा फिलेट, सलाद, हाउस सस।", { photo: photos.burger, diet: "nonveg", prepMin: 18, popular: true, sortOrder: 3 }),
    item("i-pizza", "cat-meals", "Veg Pizza 9\"", "भेज पिज्जा ९\"", 450, "Stone-baked, mozzarella, seasonal veg.", "मोज्जारेला र मौसमी तरकारी।", { photo: photos.pizza, prepMin: 25, sortOrder: 4 }),
    item("i-thukpa", "cat-meals", "Chicken Thukpa", "चिकन थुक्पा", 220, "Hot noodle soup — best after a cold evening game.", "तातो नुडल सुप — चिसो साँझको खेलपछि उत्तम।", { photo: photos.thukpa, diet: "nonveg", prepMin: 15, spice: 2, sortOrder: 5 }),

    item("i-pancake", "cat-breakfast", "Honey Pancakes", "महसँग प्यानकेक", 280, "Stack of three, butter and honey.", "तीनवटा, बटर र मह।", { photo: photos.pancakes, prepMin: 15, sortOrder: 0, availableWindow: { from: "07:00", to: "11:00" } }),
    item("i-omelette", "cat-breakfast", "Masala Omelette + Toast", "मसला अमलेट + टोस्ट", 190, "Two eggs, onion, chilli, toast.", "दुई अण्डा, प्याज, खुर्सानी, टोस्ट।", { photo: photos.omelette, diet: "nonveg", prepMin: 12, spice: 1, sortOrder: 1, availableWindow: { from: "07:00", to: "11:00" } }),
    item("i-porridge", "cat-breakfast", "Fruit Oats Bowl", "फलफूल ओट्स बाउल", 240, "Oats, banana, seasonal fruit, honey.", "ओट्स, केरा, मौसमी फल, मह।", { photo: photos.oats, prepMin: 10, sortOrder: 2, availableWindow: { from: "07:00", to: "11:00" } }),
  ];

  return {
    version: 1,
    categories,
    items,
    tables: [
      { id: "t-1", label: "T1", active: true },
      { id: "t-2", label: "T2", active: true },
      { id: "t-3", label: "T3", active: true },
      { id: "t-4", label: "T4", active: true },
      { id: "t-5", label: "T5", active: true },
      { id: "t-6", label: "Court-side 1", active: true },
      { id: "t-7", label: "Court-side 2", active: true },
      { id: "t-8", label: "Terrace", active: true },
    ],
    orders: [],
    calls: [],
    staff: [
      { id: "u-owner", name: "Owner", role: "admin", pin: "1234" },
      { id: "u-kitchen", name: "Kitchen", role: "kitchen", pin: "2222" },
      { id: "u-waiter", name: "Sujan", role: "waiter", pin: "3333" },
      { id: "u-counter", name: "Counter", role: "counter", pin: "4444" },
    ],
    inventory: [
      { id: "inv-beans", name: "Coffee beans", unit: "kg", qty: 4, lowThreshold: 1 },
      { id: "inv-milk", name: "Milk", unit: "L", qty: 18, lowThreshold: 5 },
      { id: "inv-chicken", name: "Chicken", unit: "kg", qty: 7, lowThreshold: 2 },
      { id: "inv-flour", name: "Flour", unit: "kg", qty: 10, lowThreshold: 3 },
      { id: "inv-potato", name: "Potatoes", unit: "kg", qty: 12, lowThreshold: 4 },
      { id: "inv-water", name: "Mineral water", unit: "pcs", qty: 36, lowThreshold: 12 },
    ],
    inventoryLogs: [],
    settings: {
      cafeName: "Strike Yard",
      cafeNameNe: "स्ट्राइक यार्ड",
      tagline: "Premium Sports · Est. 2024",
      phone: "+977-98XXXXXXXX",
      hours: "7:00 AM – 9:00 PM",
      vatPercent: 0,
      serviceChargePercent: 0,
      soundOn: true,
      currency: "NPR",
    },
  };
}
