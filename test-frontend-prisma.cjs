const { PrismaClient } = require("@prisma/client");

async function main() {
    const prisma = new PrismaClient();

    try {
        const result = await prisma.$queryRawUnsafe("PRAGMA database_list");

        console.log("FRONTEND PRISMA CONNECTION: SUCCESS");
        console.log(result);
    } catch (error) {
        console.log("FRONTEND PRISMA CONNECTION: FAILED");
        console.error(error);
        process.exitCode = 1;
    } finally {
        await prisma.$disconnect();
    }
}

main();
