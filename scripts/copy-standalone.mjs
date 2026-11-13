import { access, cp, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const root = process.cwd();
const copies = [
  {
    source: resolve(root, ".next", "static"),
    destination: resolve(root, ".next", "standalone", ".next", "static"),
  },
  {
    source: resolve(root, "public"),
    destination: resolve(root, ".next", "standalone", "public"),
  },
];

for (const { source, destination } of copies) {
  try {
    await access(source);
  } catch {
    throw new Error(`Required build asset directory was not found: ${source}`);
  }

  await mkdir(dirname(destination), { recursive: true });
  await cp(source, destination, { recursive: true, force: true });
  console.log(`Copied ${source} -> ${destination}`);
}
