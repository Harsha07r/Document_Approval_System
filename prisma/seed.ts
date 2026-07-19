import { PrismaClient, Role } from "@prisma/client";

const prisma = new PrismaClient();

interface SeedUser {
  email: string;
  name: string;
  role: Role;
}

const SEED_USERS: readonly SeedUser[] = [
  { email: "alice@example.com", name: "Alice Anderson", role: Role.AUTHOR },
  { email: "bob@example.com", name: "Bob Baker", role: Role.REVIEWER },
  { email: "admin@example.com", name: "Ada Administrator", role: Role.ADMIN },
  { email: "viewer@example.com", name: "Vince Viewer", role: Role.VIEWER },
];

async function main(): Promise<void> {
  for (const seedUser of SEED_USERS) {
    const user = await prisma.user.upsert({
      where: { email: seedUser.email },
      update: { name: seedUser.name, role: seedUser.role },
      create: {
        email: seedUser.email,
        name: seedUser.name,
        role: seedUser.role,
      },
    });

    console.log(`Seeded user: ${user.email} (${user.role})`);
  }
}

main()
  .catch((error: unknown) => {
    console.error("Seed script failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
