import { repairTeamRatings } from './repairTeam.js';
import { prisma } from '../prisma.js';
const args = process.argv.slice(2);
if (args.some(arg => !['--apply', '--dry-run'].includes(arg)) || (args.includes('--apply') && args.includes('--dry-run'))) {
  console.error('Usage: npm run ratings:repair -w server -- [--dry-run | --apply]');
  process.exitCode = 1;
} else {
  try {
    console.log(JSON.stringify(await repairTeamRatings(args.includes('--apply')), null, 2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  } finally { await prisma.$disconnect(); }
}
