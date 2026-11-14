const fs = require("node:fs");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");

const dbPath = String.raw`H:\Data_Drive_D_1404_10_16\Project_Web\villasento-project\db\custom.db`;

console.log("\n========== 1. ENVIRONMENT ==========");
console.log("DATABASE_URL:", process.env.DATABASE_URL);

console.log("\n========== 2. FILE ACCESS ==========");
console.log("File exists:", fs.existsSync(dbPath));

try {
    const fd = fs.openSync(dbPath, "r+");
    fs.closeSync(fd);
    console.log("READ/WRITE ACCESS: SUCCESS");
} catch (error) {
    console.log("READ/WRITE ACCESS: FAILED");
    console.log(error.code, error.message);
}

console.log("\n========== 3. FOLDER WRITE ==========");
const testFile = path.join(
    path.dirname(dbPath),
    `.__sqlite_test_${process.pid}.tmp`
);

try {
    fs.writeFileSync(testFile, "test", { flag: "wx" });
    fs.unlinkSync(testFile);
    console.log("FOLDER WRITE: SUCCESS");
} catch (error) {
    console.log("FOLDER WRITE: FAILED");
    console.log(error.code, error.message);
}

console.log("\n========== 4. NATIVE SQLITE ==========");

let database;

try {
    database = new DatabaseSync(dbPath, { readOnly: true });

    const databases = database
        .prepare("PRAGMA database_list")
        .all();

    const tables = database
        .prepare("SELECT name FROM sqlite_master WHERE type='table' LIMIT 10")
        .all();

    console.log("NATIVE SQLITE: SUCCESS");
    console.log("Database:", databases);
    console.log("Tables:", tables);
} catch (error) {
    console.log("NATIVE SQLITE: FAILED");
    console.log(error.code, error.message);
} finally {
    if (database) {
        database.close();
    }
}

console.log("\n========== DIAGNOSTIC FINISHED ==========");
