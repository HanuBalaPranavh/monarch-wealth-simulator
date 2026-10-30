/**
 * MONARCH — Sample Dataset
 * All figures in INR (Indian Rupees), crores as the working unit.
 * Starting capital: ₹10 crore.
 *
 * Assertions: computed totals must match their parts.
 * Any figure shown twice in the UI is one variable here.
 */
'use strict';

const DATA = {

  /* ── Simulation metadata ── */
  version: 2,
  startDate: '2024-01-01',

  /* ── Starting capital ── */
  STARTING_CASH: 10_00_00_000, // ₹10 crore in rupees

  /* ── Investment options ── */
  investments: [
    {
      id:       'stocks',
      name:     'Stock Market',
      category: 'Equities',
      unit:     'units',
      // Basket of 3 blue-chip-style stocks
      items: [
        { id: 'reliance',   name: 'Reliance Industries',    price: 2850,   change: +0.62  },
        { id: 'tcs',        name: 'TCS',                    price: 3920,   change: -0.34  },
        { id: 'hdfc',       name: 'HDFC Bank',              price: 1660,   change: +1.12  },
        { id: 'infosys',    name: 'Infosys',                price: 1780,   change: +0.28  },
        { id: 'itc',        name: 'ITC Ltd',                price: 455,    change: -0.15  },
      ]
    },
    {
      id:       'realestate',
      name:     'Real Estate',
      category: 'Property',
      unit:     'sq. ft.',
      items: [
        { id: 're_mumbai',  name: 'Mumbai Premium Flat (2BHK)', price: 95_00_000,  change: +0.8  },
        { id: 're_delhi',   name: 'Delhi NCR Office Unit',      price: 65_00_000,  change: +0.4  },
        { id: 're_bengaluru', name: 'Bengaluru Tech Park Unit', price: 48_00_000,  change: +1.1  },
        { id: 're_goa',     name: 'Goa Beach Villa',            price: 1_20_00_000,change: +1.8  },
      ]
    },
    {
      id:       'gold',
      name:     'Gold',
      category: 'Commodity',
      unit:     'grams',
      items: [
        { id: 'gold_10g',   name: 'Gold (10g bar)',          price: 72_500, change: +0.3   },
        { id: 'gold_100g',  name: 'Gold (100g bar)',         price: 7_25_000, change: +0.3 },
        { id: 'sgb',        name: 'Sovereign Gold Bond',     price: 6_950,  change: +0.2   },
      ]
    },
    {
      id:       'business',
      name:     'Business',
      category: 'Private Equity',
      unit:     'stake',
      items: [
        { id: 'biz_cafe',   name: 'Artisan Café Chain (5% stake)',    price: 45_00_000,  change: +2.1  },
        { id: 'biz_tech',   name: 'SaaS Startup (2% stake)',          price: 80_00_000,  change: -1.5  },
        { id: 'biz_farm',   name: 'Organic Farm (10% stake)',         price: 22_00_000,  change: +0.9  },
        { id: 'biz_hotel',  name: 'Boutique Hotel (15% stake)',       price: 1_50_00_000,change: +1.2  },
      ]
    }
  ],

  /* ── Luxury Marketplace ── */
  luxuryItems: [
    {
      id:       'rolls_royce',
      category: 'Automobiles',
      name:     'Rolls-Royce Ghost',
      price:    8_50_00_000,
      desc:     'Hand-built in Goodwood, England. Bespoke interior commission included.',
    },
    {
      id:       'ferrari_roma',
      category: 'Automobiles',
      name:     'Ferrari Roma Spider',
      price:    4_20_00_000,
      desc:     '3.9L twin-turbo V8. Fiorano circuit delivery package.',
    },
    {
      id:       'lamborghini',
      category: 'Automobiles',
      name:     'Lamborghini Huracán EVO',
      price:    3_80_00_000,
      desc:     '5.2L V10 naturally aspirated. Ad Personam customisation included.',
    },
    {
      id:       'private_jet',
      category: 'Aviation',
      name:     'Private Jet Share (25%)',
      price:    12_50_00_000,
      desc:     'Fractional ownership. Gulfstream G550. 200 hours flight time per year.',
    },
    {
      id:       'yacht_50',
      category: 'Marine',
      name:     '50 ft. Motor Yacht',
      price:    15_00_00_000,
      desc:     'Azimut 50. Berthed in Mumbai — Colaba Marina. Full crew included.',
    },
    {
      id:       'villa_alibaug',
      category: 'Properties',
      name:     'Alibaug Seaside Villa',
      price:    9_00_00_000,
      desc:     '6,200 sq. ft. Private beach frontage. Fully furnished.',
    },
    {
      id:       'villa_goa',
      category: 'Properties',
      name:     'Goa Hilltop Estate',
      price:    7_50_00_000,
      desc:     '4 BHK villa with infinity pool, 3 acres of grounds.',
    },
    {
      id:       'rolex_daytona',
      category: 'Watches',
      name:     'Rolex Daytona Platinum',
      price:    52_00_000,
      desc:     'Ref. 116506. Ice Blue dial. Complete set with papers.',
    },
    {
      id:       'patek_nautilus',
      category: 'Watches',
      name:     'Patek Philippe Nautilus',
      price:    1_25_00_000,
      desc:     'Ref. 5711/1A-010. Stainless steel, blue dial. Full set.',
    },
    {
      id:       'art_husain',
      category: 'Fine Art',
      name:     'M.F. Husain Original',
      price:    3_50_00_000,
      desc:     'Authenticated oil on canvas, 1970s series. Mumbai auction provenance.',
    },
    {
      id:       'helicopter',
      category: 'Aviation',
      name:     'Helicopter (Bell 429)',
      price:    22_00_00_000,
      desc:     'Twin-engine. Based at Juhu Aerodrome, Mumbai. IFR certified.',
    },
    {
      id:       'wine_collection',
      category: 'Collectibles',
      name:     'Bordeaux First Growth Collection',
      price:    1_80_00_000,
      desc:     '12 cases. Château Pétrus, Lafite, Margaux vintages 2010–2018.',
    },
  ],

  /* ── Market event pool ── */
  marketEvents: [
    {
      id: 'rbi_rate_cut',
      headline: 'RBI Cuts Repo Rate',
      desc: 'Reserve Bank of India cuts repo rate by 50 bps, boosting equities and real estate.',
      impacts: { stocks: +3.5, realestate: +2.0, gold: -0.5, business: +1.5 },
      sign: 'positive'
    },
    {
      id: 'inflation_spike',
      headline: 'Inflation Hits 7.4%',
      desc: 'CPI inflation surprises upward. Equities fall; gold surges as a hedge.',
      impacts: { stocks: -4.2, realestate: -1.0, gold: +5.8, business: -2.0 },
      sign: 'negative'
    },
    {
      id: 'sensex_bull',
      headline: 'Sensex Breaks 80,000',
      desc: 'Foreign institutional investors pile in; benchmark index sets new all-time high.',
      impacts: { stocks: +6.0, realestate: +0.5, gold: -0.8, business: +2.5 },
      sign: 'positive'
    },
    {
      id: 'global_recession',
      headline: 'Global Recession Fears',
      desc: 'US Fed raises rates sharply. Global risk-off mood pressures Indian markets.',
      impacts: { stocks: -5.5, realestate: -2.5, gold: +4.0, business: -4.0 },
      sign: 'negative'
    },
    {
      id: 'india_gdp_high',
      headline: 'India GDP Grows 8.4%',
      desc: 'Quarterly GDP data beats estimates. Infrastructure and business sectors rally.',
      impacts: { stocks: +3.0, realestate: +3.5, gold: -0.3, business: +5.0 },
      sign: 'positive'
    },
    {
      id: 'monsoon_fail',
      headline: 'Monsoon Deficit Alert',
      desc: 'Below-average monsoon threatens agriculture. Consumer stocks and farm businesses hit.',
      impacts: { stocks: -2.0, realestate: -0.5, gold: +1.5, business: -3.5 },
      sign: 'negative'
    },
    {
      id: 'ipo_boom',
      headline: 'Tech IPO Wave Surges',
      desc: 'Three major technology IPOs list with 40%+ premiums. Startup valuations inflate.',
      impacts: { stocks: +4.5, realestate: +0.2, gold: -0.2, business: +6.0 },
      sign: 'positive'
    },
    {
      id: 'geopolitical_tension',
      headline: 'Regional Geopolitical Tension',
      desc: 'Cross-border tensions spike. Defence stocks rise; broader market retreats.',
      impacts: { stocks: -3.8, realestate: -1.5, gold: +6.5, business: -2.5 },
      sign: 'negative'
    },
    {
      id: 'real_estate_boom',
      headline: 'Real Estate Cycle Peaks',
      desc: 'Premium residential projects sell out in days. Property values mark new highs.',
      impacts: { stocks: +0.5, realestate: +7.0, gold: +0.3, business: +1.0 },
      sign: 'positive'
    },
    {
      id: 'oil_price_surge',
      headline: 'Crude Oil at $120/barrel',
      desc: 'Oil surge widens current account deficit. Aviation, logistics and manufacturing pressured.',
      impacts: { stocks: -3.5, realestate: -0.8, gold: +3.0, business: -4.5 },
      sign: 'negative'
    },
    {
      id: 'fintech_surge',
      headline: 'Fintech Sector Rally',
      desc: 'Digital payments cross 15 billion transactions monthly. Fintech stocks surge.',
      impacts: { stocks: +5.5, realestate: +0.3, gold: -0.5, business: +4.0 },
      sign: 'positive'
    },
    {
      id: 'bank_npa_rise',
      headline: 'Banking Sector NPA Rise',
      desc: 'PSU banks report rising non-performing assets. Financial stocks drag the index lower.',
      impacts: { stocks: -4.0, realestate: -1.0, gold: +2.0, business: -1.5 },
      sign: 'negative'
    },
    {
      id: 'green_energy_policy',
      headline: 'Green Energy Push',
      desc: 'Government announces ₹5 trillion investment in renewables. Clean-tech and infrastructure rally.',
      impacts: { stocks: +4.0, realestate: +1.5, gold: -0.2, business: +3.5 },
      sign: 'positive'
    },
    {
      id: 'currency_weakness',
      headline: 'Rupee at ₹87/$',
      desc: 'Rupee weakens to historic low against the dollar. Import-dependent sectors suffer.',
      impacts: { stocks: -2.5, realestate: -0.5, gold: +4.5, business: -3.0 },
      sign: 'negative'
    },
    {
      id: 'budget_capex',
      headline: 'Budget: Record CapEx',
      desc: 'Union Budget announces highest-ever ₹11 trillion capital expenditure. Infrastructure boom.',
      impacts: { stocks: +5.0, realestate: +4.0, gold: -0.5, business: +4.5 },
      sign: 'positive'
    },
  ],

  /* ── Wealth milestones (in rupees) ── */
  milestones: [
    { value: 15_00_00_000, label: '₹15 Crore', message: 'Wealth grows 50% from your starting capital.' },
    { value: 25_00_00_000, label: '₹25 Crore', message: 'You have crossed the ₹25 Crore mark.' },
    { value: 50_00_00_000, label: '₹50 Crore', message: 'Half a century of crores — a rare achievement.' },
    { value: 1_00_00_00_000, label: '₹100 Crore', message: 'Century milestone: ₹100 Crore net worth.' },
    { value: 5_00_00_00_000, label: '₹500 Crore', message: 'MONARCH status unlocked: ₹500 Crore empire.' },
  ],

};

// Assertions — these must hold on load; violation means a data error.
console.assert(DATA.STARTING_CASH === 10_00_00_000, 'Starting cash must be ₹10 crore');
console.assert(DATA.investments.length === 4, 'Must have 4 investment categories');
console.assert(DATA.luxuryItems.length > 0, 'Luxury marketplace must have items');
console.assert(DATA.marketEvents.length >= 10, 'Must have at least 10 event pool entries');
