/**
 * Prisma Seed for CRYPTRAC
 * Runs the demo seeder to populate initial data for the Tax Authority Portal
 */

import { PrismaClient } from '@prisma/client';
import { seedDemoData } from '../src/services/demo.service';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting database seed...');

  const result = await seedDemoData();

  console.log(`Seed complete:`);
  console.log(`  Users created: ${result.usersCreated}`);
  console.log(`  Assessments generated: ${result.assessmentsGenerated}`);
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
