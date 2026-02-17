import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { invitationPackages } from "./src/db/schema";

const pool = new Pool({ connectionString: process.env.POSTGRES_URL });
const db = drizzle(pool);

const packages = [
  {
    name: "Starter",
    description: "Perfect for small gatherings",
    credits: 10,
    priceUsd: 499, // $4.99
    isActive: true,
  },
  {
    name: "Party",
    description: "Great for medium-sized events",
    credits: 30,
    priceUsd: 999, // $9.99
    isActive: true,
  },
  {
    name: "Event",
    description: "Ideal for larger celebrations",
    credits: 75,
    priceUsd: 1999, // $19.99
    isActive: true,
  },
  {
    name: "Mega",
    description: "For massive gatherings",
    credits: 150,
    priceUsd: 3499, // $34.99
    isActive: true,
  },
];

async function seed() {
  console.log("Seeding invitation packages...");

  for (const pkg of packages) {
    await db.insert(invitationPackages).values(pkg).onConflictDoNothing();
    console.log(`  ✓ ${pkg.name} (${pkg.credits} credits for $${(pkg.priceUsd / 100).toFixed(2)})`);
  }

  console.log("\nDone!");
  await pool.end();
}

seed().catch(console.error);
