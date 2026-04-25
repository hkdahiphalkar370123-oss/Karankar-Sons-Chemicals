const { AsyncLocalStorage } = require('async_hooks');

const tenantContext = new AsyncLocalStorage();

const runWithTenant = (tenantId, callback) => {
    return tenantContext.run({ companyId: tenantId }, callback);
};

const getTenant = () => {
    const store = tenantContext.getStore();
    return store ? store.companyId : null;
};

// Global switch to disable scoping if necessary (e.g. for superadmin, background workers)
const runWithoutTenant = (callback) => {
    return tenantContext.run({ skipTenantScope: true }, callback);
};

const skipTenantScope = () => {
    const store = tenantContext.getStore();
    return store ? store.skipTenantScope : false;
};

module.exports = {
    tenantContext,
    runWithTenant,
    getTenant,
    runWithoutTenant,
    skipTenantScope
};
