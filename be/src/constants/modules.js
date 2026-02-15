const APP_MODULES = {
  DASHBOARD: 'DASHBOARD',
  LEADS: 'LEADS',
  CLIENTS: 'CLIENTS',
  PROJECTS: 'PROJECTS',
  INVOICES: 'INVOICES'
};

const USER_ASSIGNABLE_MODULES = Object.values(APP_MODULES);

const DEFAULT_USER_MODULE_ACCESS = [
  APP_MODULES.DASHBOARD,
  APP_MODULES.LEADS,
  APP_MODULES.CLIENTS,
  APP_MODULES.PROJECTS,
  APP_MODULES.INVOICES
];

const normalizeModuleAccess = (input, fallback = DEFAULT_USER_MODULE_ACCESS) => {
  const source = Array.isArray(input) ? input : fallback;
  const deduped = [...new Set(source.map((item) => String(item).toUpperCase().trim()))].filter((item) =>
    USER_ASSIGNABLE_MODULES.includes(item)
  );

  if (!deduped.includes(APP_MODULES.DASHBOARD)) deduped.unshift(APP_MODULES.DASHBOARD);
  return deduped.length ? deduped : [APP_MODULES.DASHBOARD];
};

module.exports = {
  APP_MODULES,
  USER_ASSIGNABLE_MODULES,
  DEFAULT_USER_MODULE_ACCESS,
  normalizeModuleAccess
};
