/**
 * Utility functions for Bosta Governorates, Cities, and Districts matching & formatting
 */

/**
 * Returns Bosta's official display string for a district:
 * "ZoneName - DistrictName" (e.g., "المقطم - الهضبه الوسطي")
 * If zone and district names are identical, returns just DistrictName.
 */
export const getBostaDistrictDisplayName = (d) => {
    if (!d) return '';
    const zone = (d.zoneOtherName || d.zoneName || '').trim();
    const dist = (d.districtOtherName || d.districtName || '').trim();

    if (!zone || zone.toLowerCase() === dist.toLowerCase()) {
        return dist;
    }

    // If dist already starts with zone (e.g., "المقطم - الهضبه الوسطي"), return dist directly
    if (dist.toLowerCase().startsWith(zone.toLowerCase())) {
        return dist;
    }

    return `${zone} - ${dist}`;
};

/**
 * Filters and orders Bosta districts accurately matching Bosta Dashboard behavior:
 * Searches across zoneOtherName, zoneName, districtOtherName, districtName, and full combined string.
 * Preserves Bosta's exact JSON array ordering.
 */
export const filterAndSortBostaDistricts = (districts = [], searchQuery = '') => {
    if (!Array.isArray(districts)) return [];
    
    // Only consider districts available for drop-off
    const available = districts.filter(d => d.dropOffAvailability !== false);
    
    const query = searchQuery.trim().toLowerCase();
    if (!query) return available;

    // Remove common prefix "ال" for flexible Arabic matching
    const cleanQuery = query.replace(/^ال/, '');

    return available.filter(d => {
        const zoneAr = (d.zoneOtherName || '').trim().toLowerCase();
        const zoneEn = (d.zoneName || '').trim().toLowerCase();
        const distAr = (d.districtOtherName || '').trim().toLowerCase();
        const distEn = (d.districtName || '').trim().toLowerCase();
        const fullDisplay = getBostaDistrictDisplayName(d).toLowerCase();

        return (
            zoneAr.includes(query) || zoneAr.replace(/^ال/, '').includes(cleanQuery) ||
            zoneEn.includes(query) ||
            distAr.includes(query) || distAr.replace(/^ال/, '').includes(cleanQuery) ||
            distEn.includes(query) ||
            fullDisplay.includes(query) || fullDisplay.replace(/^ال/, '').includes(cleanQuery)
        );
    });
};

/**
 * Automatically parses a full address text string to extract the matching Bosta City & District.
 * Works seamlessly with typos, prefixes, and partial matches.
 */
export const autoParseAddressToBostaLocation = (addressText = '', bostaCities = []) => {
    if (!addressText || typeof addressText !== 'string' || !Array.isArray(bostaCities)) {
        return { matchedCity: null, matchedDistrict: null };
    }

    const cleanText = addressText.trim().toLowerCase()
        .replace(/[إأآا]/g, 'a')
        .replace(/ة/g, 'h')
        .replace(/ى/g, 'y')
        .replace(/[-/\\(),]/g, ' ') // treat hyphens/slashes/parentheses/commas as spaces
        .replace(/\s+/g, ' ');

    // Find candidate cities
    const candidateCities = [];
    for (const city of bostaCities) {
        const cAr = (city.cityOtherName || '').trim().toLowerCase()
            .replace(/[إأآا]/g, 'a').replace(/ة/g, 'h').replace(/ى/g, 'y');
        const cEn = (city.cityName || '').trim().toLowerCase();
        const cleanCAr = cAr.replace(/^ال/, '').replace(/محافظه/g, '').trim();

        if (cleanCAr.length > 2 && (cleanText.includes(cAr) || (cleanCAr.length >= 4 && cleanText.includes(cleanCAr)) || cleanText.includes(cEn))) {
            candidateCities.push(city);
        }
    }

    let bestDistrictMatch = null;
    let bestDistrictScore = 0;

    // Search districts across all cities
    for (const city of bostaCities) {
        for (const dist of (city.districts || [])) {
            if (dist.dropOffAvailability === false) continue;

            const distAr = (dist.districtOtherName || '').trim().toLowerCase()
                .replace(/[إأآا]/g, 'a').replace(/ة/g, 'h').replace(/ى/g, 'y')
                .replace(/[-/\\(),]/g, ' ').replace(/\s+/g, ' ');
            const zoneAr = (dist.zoneOtherName || '').trim().toLowerCase()
                .replace(/[إأآا]/g, 'a').replace(/ة/g, 'h').replace(/ى/g, 'y')
                .replace(/[-/\\(),]/g, ' ').replace(/\s+/g, ' ');

            const cleanDistAr = distAr.replace(/^ال/, '').trim();
            const cleanZoneAr = zoneAr.replace(/^ال/, '').trim();

            let matchedScore = 0;

            // 1. Exact or substring match (District name is in the address)
            if (cleanDistAr.length > 2 && (cleanText.includes(distAr) || (cleanDistAr.length >= 3 && cleanText.includes(cleanDistAr)))) {
                matchedScore = cleanDistAr.length + 100;
            } 
            // 2. Reverse substring match (Address part is in the district name)
            else if (cleanDistAr.length > 2) {
                const addressWords = cleanText.split(/[\s,.-]+/).filter(w => w.length >= 3);
                
                let comboMatchCount = 0;
                for (let i = 0; i < addressWords.length - 1; i++) {
                    const combo = `${addressWords[i]} ${addressWords[i+1]}`;
                    if (distAr.includes(combo) || cleanDistAr.includes(combo)) {
                        comboMatchCount += combo.length;
                    }
                }
                
                if (comboMatchCount > 0) {
                    matchedScore = comboMatchCount + 40;
                } else {
                    let matchingWordsCount = 0;
                    for (const word of addressWords) {
                        if (word === 'شارع' || word === 'منطقه' || word === 'سيدي' || word === 'عماره' || word === 'بجوار' || word === 'شقه' || word === 'برج' || word === 'دور') continue;
                        if (distAr.includes(word) || cleanDistAr.includes(word)) {
                            matchingWordsCount++;
                        }
                    }
                    if (matchingWordsCount > 0) {
                        matchedScore = matchingWordsCount * 15;
                    }
                }
            }

            // 3. Zone match fallback
            if (matchedScore === 0 && cleanZoneAr.length > 2 && (cleanText.includes(zoneAr) || (cleanZoneAr.length >= 3 && cleanText.includes(cleanZoneAr)))) {
                matchedScore = cleanZoneAr.length + 10;
            }

            if (matchedScore > 0) {
                const isCandidateCity = candidateCities.some(cc => cc.cityCode === city.cityCode);
                const finalScore = matchedScore + (isCandidateCity ? 30 : 0);

                if (finalScore > bestDistrictScore) {
                    bestDistrictScore = finalScore;
                    bestDistrictMatch = { city, district: dist };
                }
            }
        }
    }

    if (bestDistrictMatch) {
        return { 
            matchedCity: bestDistrictMatch.city, 
            matchedDistrict: bestDistrictMatch.district 
        };
    }

    // Fallback: If no district matched, but we matched a candidate city, return that city
    if (candidateCities.length > 0) {
        return { matchedCity: candidateCities[0], matchedDistrict: null };
    }

    return { matchedCity: null, matchedDistrict: null };
};

/**
 * Arabic text normalization helper
 */
const normalizeArabicText = (str) => {
    if (!str || typeof str !== 'string') return '';
    return str.trim().toLowerCase()
        .replace(/[أإآا]/g, 'ا')
        .replace(/[ةه]/g, 'ه')
        .replace(/[يىئءؤ]/g, 'ي')
        .replace(/[-/\\(),.]/g, ' ') // treat symbols as spaces
        .replace(/\s+/g, ' ');
};

/**
 * Levenshtein Distance helper
 */
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
                    matrix[i - 1][j - 1] + 1, // substitution
                    matrix[i][j - 1] + 1,     // insertion
                    matrix[i - 1][j] + 1      // deletion
                );
            }
        }
    }
    return matrix[b.length][a.length];
};

/**
 * Returns true if word A and word B are close enough (fuzzy match)
 */
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
    'كمبوند', 'كمبوندات', 'الكمبوند', 'عند', 'بوابه', 'بوابة', 'فيلا', 'الفيلا', 'مجاورة', 'مجاوره',
    'ش', 'ق', 'جوار', 'من', 'في', 'على', 'علي', 'و', 'او', 'أو', 'مع', 'عن'
];

/**
 * Returns multiple smart Bosta location suggestions (up to 6) for a given address text.
 * Each suggestion contains { city, district, label }
 */
export const getBostaAddressSuggestions = (addressText = '', bostaCities = []) => {
    if (!addressText || typeof addressText !== 'string' || !Array.isArray(bostaCities)) {
        return [];
    }

    const normalizedInput = normalizeArabicText(addressText);
    const inputWords = normalizedInput.split(' ').filter(w => w.length >= 2 && !STOPWORDS.includes(w));
    
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

    const matches = [];
    const seenKeys = new Set();

    // 2. Search districts inside matched cities (highest priority) or all cities if none matched
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
                        label: `${getBostaDistrictDisplayName(dist)}، ${city.cityOtherName}`
                    });
                }
            }
        }
    }

    return matches.sort((a, b) => b.score - a.score).slice(0, 6);
};
