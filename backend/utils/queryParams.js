const getSearchTerm = (req) => {
    const direct = req.query?.search || req.query?.q;
    if (direct) {
        return direct;
    }

    try {
        const url = new URL(req.originalUrl, `${req.protocol}://${req.get('host')}`);
        return url.searchParams.get('search') || url.searchParams.get('q') || '';
    } catch (error) {
        return '';
    }
};

module.exports = {
    getSearchTerm
};
