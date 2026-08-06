import fs from 'fs';

// Arabic text normalization helper
const normalizeArabicText = (str) => {
    if (!str || typeof str !== 'string') return '';
    return str.trim().toLowerCase()
        .replace(/[أإآا]/g, 'ا')
        .replace(/[ةه]/g, 'ه')
        .replace(/[يىئءؤ]/g, 'ي')
        .replace(/[-/\\(),.]/g, ' ') // treat symbols as spaces
        .replace(/\s+/g, ' ');
};

// Levenshtein Distance helper
const getLevenshteinDistance = (a, b) => {
    const matrix = [];
    for (let i = 0; i <= b.length; i++) matrix[i] = [i];
    for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1,
                    matrix[i][j - 1] + 1,
                    matrix[i - 1][j] + 1
                );
            }
        }
    }
    return matrix[b.length][a.length];
};

const isFuzzyMatch = (wordA, wordB) => {
    if (!wordA || !wordB) return false;
    if (wordA.includes(wordB) || wordB.includes(wordA)) return true;
    const dist = getLevenshteinDistance(wordA, wordB);
    const maxLen = Math.max(wordA.length, wordB.length);
    const maxAllowedDist = maxLen <= 5 ? 1 : 2;
    return dist <= maxAllowedDist;
};

// Expanded list of stopwords to ignore from matching districts/cities
const STOPWORDS = [
    'محافظه', 'مركز', 'قريه', 'مدينه', 'امام', 'خلف', 'مكتب', 'بريد', 'البريد', 'البري',
    'بجوار', 'شارع', 'شقه', 'عماره', 'منطقه', 'سيدي', 'برج', 'دور', 'ميدان', 'بين',
    'الشارع', 'طريق', 'ناصية', 'ناصيه', 'بينما', 'جنب', 'فوق', 'تحت', 'بعد', 'قبل',
    'سوبرماركت', 'صيدلية', 'صيدليه', 'مستشفى', 'مستشفي', 'مدرسة', 'مدرسه', 'مسجد', 'جامع',
    'كمبوند', 'كمبوندات', 'الكمبوند', 'عند', 'بوابه', 'بوابة', 'فيلا', 'الفيلا', 'مجاورة', 'مجاوره'
];

export const getBostaAddressSuggestions = (addressText = '', bostaCities = []) => {
    if (!addressText || typeof addressText !== 'string' || !Array.isArray(bostaCities)) {
        return [];
    }

    const normalizedInput = normalizeArabicText(addressText);
    const inputWords = normalizedInput.split(' ').filter(w => w.length >= 2 && !STOPWORDS.includes(w));
    
    console.log("Filtered Input Words:", inputWords);

    if (inputWords.length === 0) return [];

    // 1. Identify matched cities based on input words
    const matchedCities = [];
    for (const city of bostaCities) {
        const cAr = normalizeArabicText(city.cityOtherName || '').replace(/^ال/, '').replace(/محافظه/g, '').trim();
        const cEn = (city.cityName || '').trim().toLowerCase();
        
        let cityMatched = false;
        for (const word of inputWords) {
            if (isFuzzyMatch(word, cAr) || word === cEn) {
                cityMatched = true;
                break;
            }
        }
        
        if (cityMatched) {
            matchedCities.push(city);
        }
    }

    console.log("Matched Cities:", matchedCities.map(c => c.cityOtherName));

    const matches = [];
    const seenKeys = new Set();

    // 2. Search districts
    const citiesToSearch = matchedCities.length > 0 ? matchedCities : bostaCities;
    
    for (const city of citiesToSearch) {
        const cAr = normalizeArabicText(city.cityOtherName || '').replace(/^ال/, '').replace(/محافظه/g, '').trim();
        const isCityExplicitlyMatched = matchedCities.some(cc => cc.cityCode === city.cityCode);
        
        for (const dist of (city.districts || [])) {
            if (dist.dropOffAvailability === false) continue;

            const distAr = normalizeArabicText(dist.districtOtherName || '').replace(/^ال/, '').trim();
            const distEn = (dist.districtName || '').trim().toLowerCase();
            const zoneAr = normalizeArabicText(dist.zoneOtherName || '').replace(/^ال/, '').trim();

            let matchedScore = 0;
            let districtMatched = false;

            for (const word of inputWords) {
                if (isFuzzyMatch(word, distAr) || word === distEn || isFuzzyMatch(word, zoneAr)) {
                    districtMatched = true;
                    // Lower score if matching word is just the city name (avoid inflating parent city names as districts)
                    const isWordCityName = isFuzzyMatch(word, cAr) || word === city.cityName.toLowerCase();
                    if (isWordCityName) {
                        matchedScore += 10;
                    } else if (word === distAr || distAr.includes(word)) {
                        matchedScore += 50;
                    } else {
                        matchedScore += 30;
                    }
                }
            }

            if (!districtMatched && isCityExplicitlyMatched) {
                if (distAr.includes(cAr) || cAr.includes(distAr)) {
                    matchedScore = 20;
                } else {
                    matchedScore = 5;
                }
            }

            if (matchedScore > 0) {
                const uniqueKey = `${city.cityCode}_${dist.districtId}`;
                if (!seenKeys.has(uniqueKey)) {
                    seenKeys.add(uniqueKey);
                    
                    matches.push({
                        city,
                        district: dist,
                        score: matchedScore + (isCityExplicitlyMatched ? 40 : 0),
                        label: `${dist.districtOtherName}، ${city.cityOtherName}`
                    });
                }
            }
        }
    }

    return matches.sort((a, b) => b.score - a.score).slice(0, 6);
};

async function main() {
  const fileContent = fs.readFileSync('./محافظات/المناطق التابعه لكل محافظة.json', 'utf8');
  const bostaData = JSON.parse(fileContent);

  const address = "الشروق الرابية بجوار كمبوند ستيلا عند دير ابو سفيان، الرابيه,";
  const suggestions = getBostaAddressSuggestions(address, bostaData.data);

  console.log("\nSuggestions for:", address);
  console.log(JSON.stringify(suggestions.map(s => ({
    label: s.label,
    score: s.score
  })), null, 2));
}

main().catch(err => console.error(err));
