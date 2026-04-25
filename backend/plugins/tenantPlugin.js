const { getTenant, skipTenantScope } = require('../middlewares/tenantScope');

function tenantPlugin(schema) {
    // If the schema doesn't have companyId, don't apply the plugin
    if (!schema.path('companyId')) return;

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
