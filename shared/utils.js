export const mapProductToDb = (data) => ({
    ProductName: data.name,
    ProductImageURL: data.image,
    Category: data.category,
    AnalysisDate: data.date ? new Date(data.date) : new Date(),
    carbon_footprint: data.factors?.carbonFootprint || null,
    water_consumption: data.factors?.waterConsumption || null,
    energy_usage: data.factors?.energyUsage || null,
    waste_pollution: data.factors?.wastePollution || null,
    chemical_usage: data.factors?.chemicalUsage || null,
    recyclability: data.factors?.recyclability || null,
    eco_score: data.eco_score || null,
    eco_letter: data.eco_letter || null,
    environmental_impact: data.impact,
    sustainability_level: data.sustain,
    uploaded_by_user_id: data.user_id,
    created_at: new Date(),
    updated_at: new Date(),
    ingredients: Array.isArray(data.ingredients)
        ? data.ingredients
        : (typeof data.ingredients === 'string'
            ? data.ingredients.split(',').map(s => s.trim()).filter(Boolean)
            : []),
});

export const mapProductToFrontend = (dbDoc) => {
    const safeDisplay = (value) => (value && String(value).trim() !== '') ? value : 'N/A';
    const rawEcoScore = dbDoc.eco_score ? String(dbDoc.eco_score) : null;
    const ecoScoreValue = parseInt(rawEcoScore);

    return {
        id: dbDoc._id.toString(),
        name: safeDisplay(dbDoc.ProductName),
        image: dbDoc.ProductImageURL,
        category: safeDisplay(dbDoc.Category),
        date: dbDoc.AnalysisDate ? new Date(dbDoc.AnalysisDate).toISOString().slice(0, 10) : 'N/A',
        eco: (ecoScoreValue >= 0 && !isNaN(ecoScoreValue)) ? `${ecoScoreValue}/100` : 'N/A',
        eco_letter: safeDisplay(dbDoc.eco_letter),
        impact: safeDisplay(dbDoc.environmental_impact),
        sustain: safeDisplay(dbDoc.sustainability_level),
        factors: {
            carbonFootprint: dbDoc.carbon_footprint?.toString() || null,
            waterConsumption: dbDoc.water_consumption?.toString() || null,
            energyUsage: dbDoc.energy_usage?.toString() || null,
            wastePollution: dbDoc.waste_pollution || null,
            chemicalUsage: dbDoc.chemical_usage || null,
            recyclability: dbDoc.recyclability || null,
        },
        ingredients: Array.isArray(dbDoc.ingredients) ? dbDoc.ingredients : []
    };
};

export const buildIdQuery = (rawId) => {
    const id = String(rawId ?? "").trim();
    const or = [];
    
    try {
        or.push({ _id: new ObjectId(id) });
    } catch (e) {
        // Not a valid ObjectId
    }
    
    or.push({ _id: id }, { id });
    return { $or: or };
};