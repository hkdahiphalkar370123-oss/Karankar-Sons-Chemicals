const { getTenant, skipTenantScope } = require('../middlewares/tenantScope');

function tenantPlugin(schema) {
    // If the schema doesn't have companyId, or if it's the Company model itself, don't apply the plugin
    if (!schema.path('companyId') || schema.options.collection === 'companies') return;

    const applyTenantFilter = function() {
        // Exclude if explicitly bypassing scoping
        if (skipTenantScope()) return;
        
        // Exclude populate queries or queries manually opting out
        if (this.getOptions().skipTenantFilter) return;
        
        const tenantId = getTenant();
        if (tenantId) {
            this.where({ companyId: tenantId });
        }
    };

    schema.pre('find', applyTenantFilter);
    schema.pre('findOne', applyTenantFilter);
    schema.pre('countDocuments', applyTenantFilter);
    schema.pre('findOneAndUpdate', applyTenantFilter);
    schema.pre('updateMany', applyTenantFilter);
    schema.pre('deleteMany', applyTenantFilter);
}

module.exports = tenantPlugin;
