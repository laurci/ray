import { PrismaClient } from "@prisma/client";

export const prisma = new PrismaClient();

try {
    prisma.$connect();
} catch (e) {
    console.error(e);
    prisma.$disconnect();
}
