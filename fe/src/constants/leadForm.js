export const leadFormInitialValues = {
  companyName: '',
  promoterName: '',
  contactPerson: '',
  email: '',
  mobileNumber: '',
  businessConstitutionType: '',
  address: '',
  taluka: '',
  district: '',
  city: '',
  state: '',
  projectLandDetail: '',
  partnersDirectorsGender: '',
  promoterCasteCategory: '',
  manufacturingDetails: '',
  investmentBuildingConstruction: '',
  investmentLand: '',
  investmentPlantMachinery: '',
  totalInvestment: '',
  bankLoanIfAny: '',
  financeBankLoanPercent: '',
  financeOwnContributionPercent: '',
  projectType: '',
  availedSubsidyPreviously: '',
  projectSpecificAsk: '',
  industryType: '',
  source: 'MANUAL',
  requirementType: 'SUBSIDY',
  nextFollowUpAt: ''
};

export const leadSelectOptions = {
  businessConstitutionType: ['PROPRIETORSHIP', 'PARTNERSHIP', 'LLP', 'PRIVATE_LIMITED', 'PUBLIC_LIMITED', 'OPC', 'TRUST', 'OTHER'],
  projectLandDetail: ['OWNED', 'LEASED', 'RENTED', 'NOT_FINALIZED', 'OTHER'],
  partnersDirectorsGender: ['MALE', 'FEMALE', 'MIXED', 'OTHER'],
  promoterCasteCategory: ['GENERAL', 'OBC', 'SC', 'ST', 'OTHER'],
  projectType: ['MANUFACTURING', 'SERVICE', 'TRADING', 'AGRO', 'EXPANSION', 'MODERNIZATION', 'DIVERSIFICATION', 'OTHER'],
  availedSubsidyPreviously: ['YES', 'NO', 'NOT_SURE'],
  bankLoanIfAny: ['YES', 'NO', 'IN_DISCUSSION'],
  source: ['MANUAL', 'WEBSITE', 'EXHIBITION', 'REFERRAL', 'WHATSAPP', 'COLD_CALL'],
  requirementType: ['SUBSIDY', 'LAND', 'FUNDING', 'COMPLIANCE']
};

const toNullable = (value) => {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const str = String(value).trim();
  return str ? str : null;
};

const toNullableNumber = (value) => {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

export const mapLeadToForm = (lead) => ({
  ...leadFormInitialValues,
  ...Object.fromEntries(Object.keys(leadFormInitialValues).map((key) => [key, lead?.[key] ?? leadFormInitialValues[key]])),
  investmentBuildingConstruction: lead?.investmentBuildingConstruction ?? '',
  investmentLand: lead?.investmentLand ?? '',
  investmentPlantMachinery: lead?.investmentPlantMachinery ?? '',
  totalInvestment: lead?.totalInvestment ?? '',
  financeBankLoanPercent: lead?.financeBankLoanPercent ?? '',
  financeOwnContributionPercent: lead?.financeOwnContributionPercent ?? '',
  nextFollowUpAt: lead?.nextFollowUpAt ? new Date(lead.nextFollowUpAt).toISOString().slice(0, 16) : ''
});

export const buildLeadPayload = (form, { includeStatus = false } = {}) => {
  const payload = {
    companyName: toNullable(form.companyName),
    promoterName: toNullable(form.promoterName),
    contactPerson: toNullable(form.contactPerson) || toNullable(form.promoterName),
    email: toNullable(form.email),
    mobileNumber: toNullable(form.mobileNumber),
    businessConstitutionType: toNullable(form.businessConstitutionType),
    address: toNullable(form.address),
    taluka: toNullable(form.taluka),
    district: toNullable(form.district),
    city: toNullable(form.city),
    state: toNullable(form.state),
    projectLandDetail: toNullable(form.projectLandDetail),
    partnersDirectorsGender: toNullable(form.partnersDirectorsGender),
    promoterCasteCategory: toNullable(form.promoterCasteCategory),
    manufacturingDetails: toNullable(form.manufacturingDetails),
    investmentBuildingConstruction: toNullableNumber(form.investmentBuildingConstruction),
    investmentLand: toNullableNumber(form.investmentLand),
    investmentPlantMachinery: toNullableNumber(form.investmentPlantMachinery),
    totalInvestment: toNullableNumber(form.totalInvestment),
    bankLoanIfAny: toNullable(form.bankLoanIfAny),
    financeBankLoanPercent: toNullableNumber(form.financeBankLoanPercent),
    financeOwnContributionPercent: toNullableNumber(form.financeOwnContributionPercent),
    projectType: toNullable(form.projectType),
    availedSubsidyPreviously: toNullable(form.availedSubsidyPreviously),
    projectSpecificAsk: toNullable(form.projectSpecificAsk),
    industryType: toNullable(form.industryType),
    source: toNullable(form.source) || 'MANUAL',
    requirementType: toNullable(form.requirementType) || 'SUBSIDY',
    nextFollowUpAt: form.nextFollowUpAt || null
  };

  if (!includeStatus) delete payload.status;
  return payload;
};
