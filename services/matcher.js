// Property Matching Engine - Stage 1
// Matches properties against tenant requirements using hard constraints + soft preferences

function match(requirements, properties) {
  const { budgetMax, location, bedrooms, flexibility } = requirements || {};

  // Filter properties
  const filtered = properties.filter(prop => {
    // Must be available
    if (prop.status !== 'available') return false;

    // Budget: hard constraint unless flexibility allows stretch
    if (prop.rent > budgetMax) {
      if (flexibility === 1) {
        // Allow up to 2x budget stretch with flexibility
        if (prop.rent > budgetMax * 2) return false;
      } else {
        return false;
      }
    }

    // Location: exact match (case-insensitive)
    if (location && prop.location && prop.location.toLowerCase() !== location.toLowerCase()) {
      return false;
    }

    // Bedrooms: exact match
    if (bedrooms && prop.bedrooms && prop.bedrooms !== bedrooms) {
      return false;
    }

    return true;
  });

  // Score each property
  const scored = filtered.map(prop => {
    let score = 0;
    const reasons = [];

    // Rent score: closer to budgetMax = higher score
    if (budgetMax && prop.rent <= budgetMax) {
      const rentRatio = prop.rent / budgetMax;
      if (rentRatio <= 0.8) {
        score += 30;
        reasons.push('Well within budget');
      } else if (rentRatio <= 0.95) {
        score += 20;
        reasons.push('Within budget');
      } else {
        score += 10;
        reasons.push('At budget limit');
      }
    }

    // Location match
    if (location && prop.location && prop.location.toLowerCase() === location.toLowerCase()) {
      score += 30;
      reasons.push('Location match');
    }

    // Bedrooms match
    if (bedrooms && prop.bedrooms && prop.bedrooms === bedrooms) {
      score += 25;
      reasons.push('Bedroom match');
    }

    // Furnishing match (soft preference)
    if (requirements.furnishing && prop.furnishing && prop.furnishing === requirements.furnishing) {
      score += 10;
      reasons.push('Furnishing match');
    }

    // Bathrooms match (soft preference)
    if (requirements.bathrooms && prop.bathrooms && prop.bathrooms === requirements.bathrooms) {
      score += 5;
      reasons.push('Bathroom match');
    }

    return { property: prop, matchReasons: reasons, score };
  });

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score);

  // Return max 3
  return scored.slice(0, 3);
}

module.exports = { match };
