const surfacePricing = {
    'Roof Waterproofing': 35,
    'Terrace Waterproofing': 40,
    'Bathroom Waterproofing': 55,
    'Basement Waterproofing': 60,
    'Wall Crack Repair': 30,
    'Tank Waterproofing': 50
};

const numberOrZero = (value) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
};

const nonNegativeNumber = (value) => {
    const parsed = numberOrZero(value);
    return parsed >= 0 ? parsed : 0;
};

const percentOrZero = (value) => {
    const parsed = nonNegativeNumber(value);
    return Math.min(parsed, 100);
};

const resolvePricePerSqft = (surfaceType, pricePerSqft) => {
    const explicitPrice = Number(pricePerSqft);
    if (Number.isFinite(explicitPrice) && explicitPrice >= 0) {
        return explicitPrice;
    }

    return surfacePricing[surfaceType] || 0;
};

const calculateEstimate = (input = {}) => {
    const area = nonNegativeNumber(input.area);
    const surfaceType = String(input.surfaceType || '').trim();
    const hasAreaBasedPricing = area > 0 || surfaceType || input.pricePerSqft !== undefined;

    const pricePerSqft = resolvePricePerSqft(surfaceType, input.pricePerSqft);
    const materialCost = nonNegativeNumber(input.materialCost);
    const labourCost = nonNegativeNumber(input.labourCost);
    const additionalCharges = nonNegativeNumber(input.additionalCharges);
    const discount = percentOrZero(input.discount);
    const gst = percentOrZero(input.gst);

    if (hasAreaBasedPricing) {
        const baseAmount = area * pricePerSqft;
        const subtotal = baseAmount + materialCost + labourCost + additionalCharges;
        const discountAmount = subtotal * (discount / 100);
        const taxableAmount = Math.max(subtotal - discountAmount, 0);
        const gstAmount = taxableAmount * (gst / 100);
        const finalAmount = taxableAmount + gstAmount;

        return {
            area,
            surfaceType,
            pricePerSqft,
            baseAmount,
            subtotal,
            discountAmount,
            gstAmount,
            materialCost,
            labourCost,
            additionalCharges,
            discount,
            gst,
            totalEstimatedCost: finalAmount,
            finalAmount
        };
    }

    const baseAmount = numberOrZero(input.baseAmount);
    const totalEstimatedCost = numberOrZero(input.totalEstimatedCost || input.finalAmount || baseAmount + materialCost + labourCost + additionalCharges);

    return {
        area,
        surfaceType,
        pricePerSqft,
        baseAmount,
        subtotal: totalEstimatedCost,
        discountAmount: 0,
        gstAmount: 0,
        materialCost,
        labourCost,
        additionalCharges,
        discount,
        gst,
        totalEstimatedCost,
        finalAmount: numberOrZero(input.finalAmount || totalEstimatedCost)
    };
};

module.exports = {
    surfacePricing,
    calculateEstimate,
    numberOrZero
};