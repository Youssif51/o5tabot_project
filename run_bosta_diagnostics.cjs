const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const env = fs.readFileSync('.env', 'utf8');
const supabaseUrl = env.match(/VITE_SUPABASE_URL=(.*)/)[1].trim();
const supabaseAnonKey = env.match(/VITE_SUPABASE_PUBLISHABLE_KEY=(.*)/)[1].trim();

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  const pickupAddress = {
    city: "Cairo",
    zoneId: "BOGhk97qy3hMIO",
    districtId: "cTqvwYLWjffOiXF2of1nU",
    firstLine: "سكن اهل مصر عمارة 25 شقة 2 الدور الارضي",
    contactPerson: {
      name: "INV",
      phone: "+201204819621"
    }
  };

  const bostaPayloadArabic = {
    type: 10,
    specs: {
      packageType: "Small",
      packageDetails: {
        itemsCount: 2,
        description: "2x OCT-SKU-529"
      }
    },
    goodsInfo: {
      amount: 2500,
      notes: "2x OCT-SKU-529"
    },
    cod: 2515,
    allowToOpenPackage: false,
    dropOffAddress: {
      city: "القليوبيه", // Arabic
      districtId: "eqfdneFVWy",
      zoneId: "NiAoU8U-Mo9",
      firstLine: "طوخ قليوبيه شارع العرجان, طوخ, Qalyubia, Egypt",
      isWorkAddress: false
    },
    pickupAddress: pickupAddress,
    businessReference: "ORD-2026-2928-TEST-ARABIC",
    receiver: {
      firstName: "عبدالرحمن",
      lastName: "يس",
      phone: "+201279824574"
    }
  };

  const bostaPayloadEnglish = {
    ...bostaPayloadArabic,
    businessReference: "ORD-2026-2928-TEST-ENGLISH",
    dropOffAddress: {
      ...bostaPayloadArabic.dropOffAddress,
      city: "El Kalioubia" // English
    }
  };

  console.log("Invoking get-bosta-error with Arabic City Name...");
  const { data: resAr, error: errAr } = await supabase.functions.invoke('get-bosta-error', {
    body: bostaPayloadArabic
  });
  console.log("Arabic Response status:", resAr?.status);
  console.log("Arabic Response data:", JSON.stringify(resAr?.data, null, 2));

  console.log("\nInvoking get-bosta-error with English City Name...");
  const { data: resEn, error: errEn } = await supabase.functions.invoke('get-bosta-error', {
    body: bostaPayloadEnglish
  });
  console.log("English Response status:", resEn?.status);
  console.log("English Response data:", JSON.stringify(resEn?.data, null, 2));
}

run();
