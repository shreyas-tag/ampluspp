const connectDb = require('../config/db');
const Category = require('../models/Category');
const Scheme = require('../models/Scheme');

const catalog = [
  {
    name: 'Subsidy Schemes',
    description: 'Central and state subsidy programs',
    schemes: [
      'PMEGP',
      'CGTMSE',
      'CLCSS',
      'M-SIPS',
      'TUF Scheme',
      'State Capital Subsidy',
      'Interest Subsidy',
      'Power Tariff Subsidy',
      'Stamp Duty Exemption',
      'SGST Reimbursement',
      'Export Promotion Subsidy'
    ]
  },
  {
    name: 'Land & Infrastructure',
    description: 'Industrial land and infra approvals',
    schemes: [
      'MIDC Land Allotment',
      'GIDC Plot Allotment',
      'Industrial Shed Allocation',
      'NA Conversion Support',
      'Building Plan Approval',
      'Factory License Setup',
      'Boiler Approval',
      'Electrical Sanction',
      'Water Connection Approval',
      'Fire NOC'
    ]
  },
  {
    name: 'Compliance & Funding',
    description: 'Funding support and mandatory compliance tracks',
    schemes: [
      'MSME Registration',
      'Udyam Support',
      'Pollution NOC',
      'Consent to Establish',
      'Consent to Operate',
      'ISO Certification Support',
      'Bank Term Loan Support',
      'Working Capital Support',
      'Startup India Benefits',
      'SEZ Unit Approval',
      'FSSAI License',
      'Trade Mark Filing'
    ]
  }
];

const codeFromName = (value) =>
  value
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 30);

const run = async () => {
  await connectDb();

  for (const categoryItem of catalog) {
    const category = await Category.findOneAndUpdate(
      { name: categoryItem.name },
      { name: categoryItem.name, description: categoryItem.description },
      { upsert: true, new: true }
    );

    for (const schemeName of categoryItem.schemes) {
      await Scheme.findOneAndUpdate(
        { category: category._id, name: schemeName },
        {
          category: category._id,
          name: schemeName,
          code: codeFromName(schemeName),
          isActive: true
        },
        { upsert: true, new: true }
      );
    }
  }

  // eslint-disable-next-line no-console
  console.log('Catalog seeded successfully with static categories and schemes');
  process.exit(0);
};

run().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
