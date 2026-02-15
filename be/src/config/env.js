const dotenv = require('dotenv');

dotenv.config();

const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 8000),
  mongoUri:
    process.env.MONGODB_URI ||
    'mongodb+srv://<username>:<password>@amplusengine.rgz3r5s.mongodb.net/ampluspp?retryWrites=true&w=majority',
  jwtSecret: process.env.JWT_SECRET || 'changeme',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  wordpressWebhookKey: process.env.WORDPRESS_WEBHOOK_KEY || '',
  invoiceCompanyName: process.env.INVOICE_COMPANY_NAME || 'Amplus Subsidy Solutions',
  invoiceCompanyAddress:
    process.env.INVOICE_COMPANY_ADDRESS || 'Office Address Line 1, City, State - PIN',
  invoiceCompanyPhone: process.env.INVOICE_COMPANY_PHONE || '+91-00000-00000',
  invoiceCompanyEmail: process.env.INVOICE_COMPANY_EMAIL || 'billing@amplus.com',
  invoiceLogoPath: process.env.INVOICE_LOGO_PATH || ''
};

module.exports = env;
