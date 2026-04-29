const escapeRegex = (string) => {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

const getSearchTerm = (req) => {
    let term = req.query?.search || req.query?.q;
    
    if (!term) {
        try {
            const url = new URL(req.originalUrl, `${req.protocol}://${req.get('host')}`);
            term = url.searchParams.get('search') || url.searchParams.get('q') || '';
        } catch (error) {
            term = '';
        }
    }
    
    return term ? escapeRegex(term) : '';
};

module.exports = {
    getSearchTerm,
    escapeRegex
};
