const connectDb = require('../config/db');
const User = require('../models/User');
const ROLES = require('../constants/roles');

const getArgValue = (key) => {
  const arg = process.argv.find((item) => item.startsWith(`--${key}=`));
  if (!arg) return null;
  return arg.slice(key.length + 3).trim();
};

const run = async () => {
  const name = getArgValue('name');
  const email = getArgValue('email');
  const password = getArgValue('password');

  if (!name || !email || !password) {
    // eslint-disable-next-line no-console
    console.error(
      'Missing args. Use: npm run create:admin -- --name="Admin Name" --email="admin@company.com" --password="StrongPass123!"'
    );
    process.exit(1);
  }

  await connectDb();

  const normalizedEmail = email.toLowerCase();
  const existing = await User.findOne({ email: normalizedEmail });

  if (existing) {
    existing.role = ROLES.ADMIN;
    existing.isActive = true;
    if (password) existing.password = password;
    if (name) existing.name = name;
    await existing.save();

    // eslint-disable-next-line no-console
    console.log(`Existing user promoted/updated as ADMIN: ${existing.email}`);
    process.exit(0);
  }

  const admin = await User.create({
    name,
    email: normalizedEmail,
    password,
    role: ROLES.ADMIN
  });

  // eslint-disable-next-line no-console
  console.log(`Admin created in users collection: ${admin.email}`);
  process.exit(0);
};

run().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
