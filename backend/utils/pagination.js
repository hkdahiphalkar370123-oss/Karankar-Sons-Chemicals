/**
 * Pagination Helper
 * Simplifies pagination logic across controllers
 */

const getPaginationParams = (req, defaultLimit = 10, maxLimit = 100) => {
    let page = parseInt(req.query.page) || 1;
    let limit = parseInt(req.query.limit) || defaultLimit;

    // Validate and constrain values
    page = Math.max(1, page);
    limit = Math.min(Math.max(1, limit), maxLimit);

    const skip = (page - 1) * limit;

    return { page, limit, skip };
};

const buildPaginationResponse = (data, page, limit, total) => {
    const totalPages = Math.ceil(total / limit);
    
    return {
        success: true,
        pagination: {
            total,
            count: data.length,
            perPage: limit,
            currentPage: page,
            totalPages,
            hasNextPage: page < totalPages,
            hasPrevPage: page > 1,
            nextPage: page < totalPages ? page + 1 : null,
            prevPage: page > 1 ? page - 1 : null
        },
        data
    };
};

module.exports = {
    getPaginationParams,
    buildPaginationResponse
};
