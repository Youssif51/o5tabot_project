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
    if (wordA === wordB) return true;
    
    const lenA = wordA.length;
    const lenB = wordB.length;
    
    // Stricter containment checks
    if (lenA >= 4 && wordB.includes(wordA)) return true;
    if (lenB >= 4 && wordA.includes(wordB)) return true;
    
    // Stricter Levenshtein precondition to avoid expensive calculation:
    // 1. Minimum length of 4 characters
    if (lenA < 4 || lenB < 4) return false;
    // 2. Max length difference of 1 character (standard typo threshold)
    if (Math.abs(lenA - lenB) > 1) return false;
    // 3. First two characters should share some similarity to prevent mismatching completely different words
    if (wordA[0] !== wordB[0] && wordA[1] !== wordB[1]) return false;
    
    const dist = getLevenshteinDistance(wordA, wordB);
    return dist <= 1; // Only allow 1 typo/character difference
};

const STOPWORDS = [
    // Place descriptors
    'محافظه', 'مركز', 'قريه', 'مدينه', 'امام', 'خلف', 'مكتب', 'بريد', 'البريد', 'البري',
    'بجوار', 'شارع', 'شقه', 'عماره', 'منطقه', 'سيدي', 'برج', 'دور', 'ميدان', 'بين',
    'الشارع', 'طريق', 'ناصية', 'ناصيه', 'بينما', 'جنب', 'فوق', 'تحت', 'بعد', 'قبل',
    'سوبرماركت', 'صيدلية', 'صيدليه', 'مستشفى', 'مستشفي', 'مدرسة', 'مدرسه', 'مسجد', 'جامع',
    'كمبوند', 'كمبوندات', 'الكمبوند', 'عند', 'بوابه', 'بوابة', 'فيلا', 'الفيلا', 'مجاورة', 'مجاوره',
    'ش', 'ق', 'جوار', 'من', 'في', 'على', 'علي', 'و', 'او', 'أو', 'مع', 'عن',
    // Arabic number words (these appear in addresses as apt/floor numbers and cause false matches)
    'واحد', 'واحده', 'اتنين', 'تلاته', 'تلاتة', 'تلات', 'اربعه', 'اربعة', 'خمسه', 'خمسة',
    'سته', 'ستة', 'سبعه', 'سبعة', 'تمانيه', 'تمانية', 'تسعه', 'تسعة', 'عشره', 'عشرة',
    'ثلاثه', 'ثلاثة', 'اثنين', 'اربع', 'خمس', 'ست', 'سبع', 'ثمان', 'تسع', 'عشر',
    // Arabic ordinals (الاول، التاني، التالت...)
    'الاول', 'الاولي', 'التاني', 'الثاني', 'التالت', 'الثالث', 'الرابع', 'الخامس', 'السادس',
    'السابع', 'الثامن', 'التاسع', 'العاشر', 'اول', 'تاني', 'ثاني', 'تالت', 'ثالث', 'رابع',
    // Common address noise
    'رقم', 'نمره', 'الدور', 'الشقه', 'العماره', 'قطعه', 'بلوك', 'عقار', 'حاره', 'زقاق',
    'متفرع', 'بجانب', 'مقابل', 'ورا', 'قدام', 'جمب', 'اخر', 'اول', 'نص',
    'الحصري', 'الحصرى',
    // Prepositions and conjunctions
    'الي', 'الى', 'حتي', 'حتى', 'لحد', 'بعدين', 'كمان', 'برضو', 'يعني'
];

/**
 * Returns multiple smart Bosta location suggestions (up to 6) for a given address text.
 * Each suggestion contains { city, district, label }
 */
export const getBostaAddressSuggestions = (addressText = '', bostaCities = []) => {
    try {
    if (!addressText || typeof addressText !== 'string' || !Array.isArray(bostaCities)) {
        return [];
    }

    const normalizedInput = normalizeArabicText(addressText);
    if (normalizedInput.length < 2) return [];

    // Build all n-gram phrases from input (1-word, 2-word, 3-word combos)
    const allInputWords = normalizedInput.split(' ').filter(w => w.length >= 2 && !/^\d+$/.test(w));
    const inputPhrases = [];
    
    // Single words (filtered by stopwords + must be at least 3 chars for meaningful matching)
    const significantWords = allInputWords.filter(w => !STOPWORDS.includes(w) && w.length >= 3);
    significantWords.forEach(w => inputPhrases.push({ text: w, weight: 1 }));
    
    // 2-word combos (much higher weight - captures compound names like "مدينه نصر", "محمد نجيب")
    for (let i = 0; i < allInputWords.length - 1; i++) {
        const combo = `${allInputWords[i]} ${allInputWords[i+1]}`;
        if (combo.length >= 5) inputPhrases.push({ text: combo, weight: 3 });
    }
    
    // 3-word combos (highest weight)
    for (let i = 0; i < allInputWords.length - 2; i++) {
        const combo = `${allInputWords[i]} ${allInputWords[i+1]} ${allInputWords[i+2]}`;
        if (combo.length >= 7) inputPhrases.push({ text: combo, weight: 5 });
    }

    if (inputPhrases.length === 0) return [];

    // Pre-compute city name lookups
    const cityNameMap = new Map();
    for (const city of bostaCities) {
        const cAr = normalizeArabicText(city.cityOtherName || '').replace(/^ال/, '').replace(/محافظه/g, '').trim();
        const cEn = (city.cityName || '').trim().toLowerCase();
        cityNameMap.set(city.cityCode, { cAr, cEn });
    }

    // Check if any input phrase matches a city name
    const matchedCityCodes = new Set();
    for (const city of bostaCities) {
        const { cAr, cEn } = cityNameMap.get(city.cityCode);
        for (const phrase of inputPhrases) {
            if (cAr.length >= 3 && (phrase.text.includes(cAr) || cAr.includes(phrase.text) || isFuzzyMatch(phrase.text, cAr)) || phrase.text === cEn) {
                matchedCityCodes.add(city.cityCode);
                break;
            }
        }
    }

    const matches = [];
    const seenKeys = new Set();

    // PERFORMANCE CRITICAL: Only search districts of matching cities if any match, reducing search space by 95%
    const citiesToSearch = matchedCityCodes.size > 0 
        ? bostaCities.filter(c => matchedCityCodes.has(c.cityCode)) 
        : bostaCities;

    for (const city of citiesToSearch) {
        const { cAr } = cityNameMap.get(city.cityCode);
        const isCityMatched = matchedCityCodes.has(city.cityCode);

        for (const dist of (city.districts || [])) {
            if (dist.dropOffAvailability === false) continue;

            const distAr = normalizeArabicText(dist.districtOtherName || '').replace(/^ال/, '').trim();
            const distEn = (dist.districtName || '').trim().toLowerCase();
            const zoneAr = normalizeArabicText(dist.zoneOtherName || '').replace(/^ال/, '').trim();
            const zoneEn = (dist.zoneName || '').trim().toLowerCase();
            
            // Build searchable targets for this district
            const targets = [
                { name: distAr, boost: 1.0 },
                { name: zoneAr, boost: 0.7 },
                { name: distEn, boost: 0.8 },
                { name: zoneEn, boost: 0.5 }
            ].filter(t => t.name.length >= 2);

            let bestScore = 0;

            for (const phrase of inputPhrases) {
                for (const target of targets) {
                    let score = 0;
                    const pText = phrase.text;
                    const tName = target.name;

                    // Skip if phrase is just the city name (avoid matching city as district)
                    if (cAr.length >= 3 && (pText === cAr || isFuzzyMatch(pText, cAr)) && !isFuzzyMatch(pText, tName)) {
                        continue;
                    }

                    // Exact match
                    if (pText === tName) {
                        score = 200 * target.boost * phrase.weight;
                    }
                    // Input phrase is contained in target name (e.g., "نصر" in "مدينه نصر")
                    else if (tName.includes(pText) && pText.length >= 3) {
                        score = (80 + pText.length * 10) * target.boost * phrase.weight;
                    }
                    // Target name is contained in input phrase (e.g., district "نصر" found in input "مدينه نصر الحي الاول")
                    else if (pText.includes(tName) && tName.length >= 3) {
                        score = (60 + tName.length * 8) * target.boost * phrase.weight;
                    }
                    // Fuzzy match (handles typos)
                    else if (pText.length >= 3 && tName.length >= 3 && isFuzzyMatch(pText, tName)) {
                        score = (50 + Math.min(pText.length, tName.length) * 5) * target.boost * phrase.weight;
                    }
                    // Partial word overlap: check if any significant word from input appears in target
                    else if (phrase.weight === 1 && pText.length >= 3) {
                        // Check startsWith for partial typing
                        if (tName.startsWith(pText) || pText.startsWith(tName)) {
                            score = 40 * target.boost;
                        }
                    }

                    if (score > bestScore) bestScore = score;
                }
            }

            // City match bonus
            if (bestScore > 0 && isCityMatched) {
                bestScore += 80;
            }
            // If no district match but city matched, add low-priority entries
            else if (bestScore === 0 && isCityMatched) {
                bestScore = 5;
            }

            if (bestScore > 0) {
                const uniqueKey = `${city.cityCode}_${dist.districtId}`;
                if (!seenKeys.has(uniqueKey)) {
                    seenKeys.add(uniqueKey);
                    matches.push({
                        city,
                        district: dist,
                        score: bestScore,
                        label: `${getBostaDistrictDisplayName(dist)}، ${city.cityOtherName}`
                    });
                }
            }
        }
    }

    // Sort by score descending, then limit results
    // Remove very low-score noise if we have good matches
    const sorted = matches.sort((a, b) => b.score - a.score);
    if (sorted.length > 0 && sorted[0].score >= 50) {
        // Only keep results that are at least 15% of top score
        const threshold = sorted[0].score * 0.15;
        return sorted.filter(m => m.score >= threshold).slice(0, 6);
    }

    return sorted.slice(0, 6);
    } catch (err) {
        console.error("CRITICAL ERROR IN getBostaAddressSuggestions:", err);
        return [];
    }
};
