const { LEAD_TEMPERATURE } = require('../constants/lead');

const DAY_MS = 24 * 60 * 60 * 1000;

const getLeadTemperature = (lastInteractionAt) => {
  if (!lastInteractionAt) return LEAD_TEMPERATURE.COLD;

  const elapsedDays = Math.floor((Date.now() - new Date(lastInteractionAt).getTime()) / DAY_MS);

  if (elapsedDays <= 2) return LEAD_TEMPERATURE.HOT;
  if (elapsedDays <= 4) return LEAD_TEMPERATURE.WARM;
  return LEAD_TEMPERATURE.COLD;
};

module.exports = { getLeadTemperature };
