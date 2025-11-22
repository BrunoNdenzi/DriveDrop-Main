// USA Vehicle Makes and Models Data
// This data includes popular vehicle manufacturers and their models sold in the USA

export interface VehicleMake {
  name: string;
  models: string[];
  types?: string[]; // Vehicle types this make typically produces (sedan, suv, truck, etc.)
}

// Vehicle type categories for better organization
export const VEHICLE_TYPE_CATEGORIES = {
  sedan: ['Sedan', 'Coupe', 'Hatchback', 'Convertible'],
  suv: ['SUV', 'Crossover', 'Wagon'],
  truck: ['Truck', 'Pickup', 'Van', 'Commercial'],
  other: ['Motorcycle', 'RV', 'Trailer', 'Boat', 'Other']
}

export const USA_VEHICLE_DATA: VehicleMake[] = [
  {
    name: "Acura",
    models: ["ILX", "Integra", "TLX", "MDX", "RDX", "NSX", "ZDX"]
  },
  {
    name: "Audi",
    models: ["A3", "A4", "A5", "A6", "A7", "A8", "Q3", "Q4 e-tron", "Q5", "Q7", "Q8", "e-tron", "R8", "RS3", "RS5", "RS6", "RS7", "S3", "S4", "S5", "S6", "S7", "S8", "SQ5", "SQ7", "SQ8", "TT"]
  },
  {
    name: "BMW",
    models: ["2 Series", "3 Series", "4 Series", "5 Series", "6 Series", "7 Series", "8 Series", "X1", "X2", "X3", "X4", "X5", "X6", "X7", "Z4", "i3", "i4", "i7", "iX", "M2", "M3", "M4", "M5", "M8", "X3 M", "X4 M", "X5 M", "X6 M"]
  },
  {
    name: "Buick",
    models: ["Enclave", "Encore", "Encore GX", "Envision", "Envista"]
  },
  {
    name: "Cadillac",
    models: ["CT4", "CT5", "Escalade", "Escalade ESV", "XT4", "XT5", "XT6", "Lyriq", "Celestiq"]
  },
  {
    name: "Chevrolet",
    models: ["Blazer", "Bolt EV", "Bolt EUV", "Camaro", "Colorado", "Corvette", "Equinox", "Express", "Malibu", "Silverado 1500", "Silverado 2500HD", "Silverado 3500HD", "Suburban", "Tahoe", "TrailBlazer", "Traverse", "Trax"]
  },
  {
    name: "Chrysler",
    models: ["300", "Pacifica", "Voyager"]
  },
  {
    name: "Dodge",
    models: ["Challenger", "Charger", "Durango", "Grand Caravan", "Journey", "Ram 1500", "Ram 2500", "Ram 3500", "Ram ProMaster"]
  },
  {
    name: "Ford",
    models: ["Bronco", "Bronco Sport", "EcoSport", "Edge", "Escape", "Expedition", "Explorer", "F-150", "F-250", "F-350", "F-450", "Fiesta", "Fusion", "Maverick", "Mustang", "Mustang Mach-E", "Ranger", "Super Duty", "Transit", "Transit Connect"]
  },
  {
    name: "Genesis",
    models: ["G70", "G80", "G90", "GV60", "GV70", "GV80"]
  },
  {
    name: "GMC",
    models: ["Acadia", "Canyon", "Hummer EV", "Sierra 1500", "Sierra 2500HD", "Sierra 3500HD", "Terrain", "Yukon", "Yukon XL"]
  },
  {
    name: "Honda",
    models: ["Accord", "Civic", "CR-V", "HR-V", "Insight", "Odyssey", "Passport", "Pilot", "Ridgeline"]
  },
  {
    name: "Hyundai",
    models: ["Accent", "Elantra", "Genesis", "Ioniq 5", "Ioniq 6", "Kona", "Nexo", "Palisade", "Santa Cruz", "Santa Fe", "Sonata", "Tucson", "Veloster", "Venue"]
  },
  {
    name: "Infiniti",
    models: ["Q50", "Q60", "QX50", "QX55", "QX60", "QX80"]
  },
  {
    name: "Jaguar",
    models: ["E-Pace", "F-Pace", "F-Type", "I-Pace", "XE", "XF", "XJ"]
  },
  {
    name: "Jeep",
    models: ["Cherokee", "Compass", "Gladiator", "Grand Cherokee", "Grand Cherokee L", "Grand Wagoneer", "Renegade", "Wagoneer", "Wrangler"]
  },
  {
    name: "Kia",
    models: ["Carnival", "Forte", "K5", "Niro", "Rio", "Seltos", "Sorento", "Soul", "Sportage", "Stinger", "Telluride", "EV6"]
  },
  {
    name: "Land Rover",
    models: ["Defender", "Discovery", "Discovery Sport", "Range Rover", "Range Rover Evoque", "Range Rover Sport", "Range Rover Velar"]
  },
  {
    name: "Lexus",
    models: ["ES", "GS", "GX", "IS", "LC", "LS", "LX", "NX", "RC", "RX", "UX", "LFA"]
  },
  {
    name: "Lincoln",
    models: ["Aviator", "Continental", "Corsair", "MKZ", "Nautilus", "Navigator"]
  },
  {
    name: "Mazda",
    models: ["CX-3", "CX-30", "CX-5", "CX-9", "CX-50", "CX-90", "Mazda3", "Mazda6", "MX-5 Miata"]
  },
  {
    name: "Mercedes-Benz",
    models: ["A-Class", "C-Class", "CLA", "CLS", "E-Class", "G-Class", "GLA", "GLB", "GLC", "GLE", "GLS", "S-Class", "SL", "AMG GT", "EQB", "EQE", "EQS", "EQS SUV"]
  },
  {
    name: "Mini",
    models: ["Cooper", "Cooper Clubman", "Cooper Countryman", "Cooper SE"]
  },
  {
    name: "Mitsubishi",
    models: ["Eclipse Cross", "Mirage", "Outlander", "Outlander PHEV", "Outlander Sport"]
  },
  {
    name: "Nissan",
    models: ["370Z", "Altima", "Armada", "ARIYA", "Frontier", "GT-R", "Kicks", "LEAF", "Maxima", "Murano", "Pathfinder", "Rogue", "Rogue Sport", "Sentra", "Titan", "Versa", "Z"]
  },
  {
    name: "Porsche",
    models: ["718 Boxster", "718 Cayman", "911", "Cayenne", "Macan", "Panamera", "Taycan"]
  },
  {
    name: "Ram",
    models: ["1500", "2500", "3500", "ProMaster", "ProMaster City"]
  },
  {
    name: "Subaru",
    models: ["Ascent", "BRZ", "Crosstrek", "Forester", "Impreza", "Legacy", "Outback", "Solterra", "WRX"]
  },
  {
    name: "Tesla",
    models: ["Model 3", "Model S", "Model X", "Model Y", "Cybertruck", "Roadster"]
  },
  {
    name: "Toyota",
    models: ["4Runner", "86", "Avalon", "Camry", "C-HR", "Corolla", "Corolla Cross", "Crown", "GR86", "GR Corolla", "GR Supra", "Highlander", "Land Cruiser", "Mirai", "Prius", "Prius Prime", "RAV4", "RAV4 Prime", "Sequoia", "Sienna", "Tacoma", "Tundra", "Venza"]
  },
  {
    name: "Volkswagen",
    models: ["Arteon", "Atlas", "Atlas Cross Sport", "Golf", "ID.4", "Jetta", "Passat", "Taos", "Tiguan"]
  },
  {
    name: "Volvo",
    models: ["C40 Recharge", "S60", "S90", "V60", "V90", "XC40", "XC60", "XC90"]
  }
];

export const getVehicleMakes = (): string[] => {
  return USA_VEHICLE_DATA.map(make => make.name).sort();
};

export const getModelsForMake = (makeName: string): string[] => {
  const make = USA_VEHICLE_DATA.find(m => m.name.toLowerCase() === makeName.toLowerCase());
  return make ? make.models.sort() : [];
};

export const searchVehicleMakes = (query: string): string[] => {
  if (!query.trim()) return getVehicleMakes();
  
  const lowerQuery = query.toLowerCase();
  return USA_VEHICLE_DATA
    .filter(make => make.name.toLowerCase().includes(lowerQuery))
    .map(make => make.name)
    .sort();
};

export const searchVehicleModels = (makeName: string, query: string): string[] => {
  const models = getModelsForMake(makeName);
  if (!query.trim()) return models;
  
  const lowerQuery = query.toLowerCase();
  return models.filter(model => model.toLowerCase().includes(lowerQuery));
};
