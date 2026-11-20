/**
 * VillaSento - prepare a self-contained Next.js standalone deployment.
 *
 * Run automatically after `next build`:
 *   node scripts/copy-standalone.mjs
 *
 * Adds Next.js static assets, public/, .env and db/ to .next/standalone,
 * then merges the standalone runtime into the cPanel application root.
 * Existing runtime data in the deployment root is preserved.
 */

import fs from 'node:fs/promises';
import path from 'node:path';

const projectRoot = process.cwd();
const standaloneDir = path.join(projectRoot, '.next', 'standalone');
const staticDir = path.join(projectRoot, '.next', 'static');
const publicDir = path.join(projectRoot, 'public');

// Use .env as the environment source.
const envFile = path.join(projectRoot, '.env');

const dbDir = path.join(projectRoot, 'db');

const deployDir = process.env.STANDALONE_DEPLOY_DIR
  ? path.resolve(projectRoot, process.env.STANDALONE_DEPLOY_DIR)
  : projectRoot;

// Keep persistent files already present in the cPanel application root.
const preservedNames = new Set([
  '.env',
  'db',
  'uploads',
  'tmp',
]);

async function exists(target) {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

async function copyDirectory(source, destination) {
  if (!(await exists(source))) return false;

  await fs.mkdir(destination, { recursive: true });

  await fs.cp(source, destination, {
    recursive: true,
    force: true,
    preserveTimestamps: true,
    dereference: true,
  });

  return true;
}

async function copyFile(source, destination) {
  if (!(await exists(source))) return false;

  await fs.mkdir(path.dirname(destination), { recursive: true });

  await fs.copyFile(source, destination);

  return true;
}

async function main() {
  if (!(await exists(path.join(standaloneDir, 'server.js')))) {
    throw new Error(
      `standalone/server.js was not found: ${path.join(
        standaloneDir,
        'server.js',
      )}. Run next build first.`,
    );
  }

  if (!(await exists(staticDir))) {
    throw new Error(
      `Next static assets were not found: ${staticDir}. Build output is incomplete.`,
    );
  }

  // Next.js standalone does not include these assets automatically.
  await copyDirectory(
    staticDir,
    path.join(standaloneDir, '.next', 'static'),
  );

  await copyDirectory(
    publicDir,
    path.join(standaloneDir, 'public'),
  );

  // Include environment configuration and SQLite data
  // in the standalone folder.
  //
  // The environment configuration is copied from .env.
  const standaloneEnv = path.join(
    standaloneDir,
    '.env',
  );

  const standaloneDb = path.join(
    standaloneDir,
    'db',
  );

  if (await copyFile(envFile, standaloneEnv)) {
    console.log(
      `Environment file copied: ${standaloneEnv}`,
    );
  } else {
    console.warn(
      `WARNING: root .env was not found: ${envFile}`,
    );
  }

  if (await copyDirectory(dbDir, standaloneDb)) {
    console.log(
      `Database directory copied: ${standaloneDb}`,
    );
  } else {
    console.warn(
      `WARNING: root db/ directory was not found: ${dbDir}`,
    );
  }

  // Merge standalone runtime into the cPanel application root.
  //
  // .env, db/, uploads/ and tmp/
  // already in the destination are not overwritten.
  await fs.mkdir(deployDir, { recursive: true });

  const entries = await fs.readdir(
    standaloneDir,
    { withFileTypes: true },
  );

  for (const entry of entries) {
    if (
      preservedNames.has(entry.name) ||
      entry.name.startsWith('.env.')
    ) {
      continue;
    }

    const source = path.join(
      standaloneDir,
      entry.name,
    );

    const destination = path.join(
      deployDir,
      entry.name,
    );

    await fs.cp(source, destination, {
      recursive: true,
      force: true,
      preserveTimestamps: true,
      dereference: true,
    });
  }

  // If a separate deployment directory is configured,
  // seed missing env/db there without replacing files
  // or a live database that already exists.
  if (
    path.resolve(deployDir) !==
    path.resolve(projectRoot)
  ) {
    const deployEnv = path.join(
      deployDir,
      '.env',
    );

    const deployDb = path.join(
      deployDir,
      'db',
    );

    if (
      !(await exists(deployEnv)) &&
      (await exists(envFile))
    ) {
      await copyFile(
        envFile,
        deployEnv,
      );

      console.log(
        `Environment file seeded: ${deployEnv}`,
      );
    }

    if (
      !(await exists(deployDb)) &&
      (await exists(dbDir))
    ) {
      await copyDirectory(
        dbDir,
        deployDb,
      );

      console.log(
        `Database directory seeded: ${deployDb}`,
      );
    }
  }

  const deployedStaticDir = path.join(
    deployDir,
    '.next',
    'static',
  );

  if (!(await exists(deployedStaticDir))) {
    throw new Error(
      `Static assets were not copied to ${deployedStaticDir}`,
    );
  }

  const buildIdPath = path.join(
    deployDir,
    '.next',
    'BUILD_ID',
  );

  const buildId = (await exists(buildIdPath))
    ? (
        await fs.readFile(
          buildIdPath,
          'utf8',
        )
      ).trim()
    : 'BUILD_ID not found in deployment root';

  console.log(
    'VillaSento standalone deployment prepared successfully.',
  );

  console.log(
    `Deployment root: ${deployDir}`,
  );

  console.log(
    `Standalone folder: ${standaloneDir}`,
  );

  console.log(
    `Static assets: ${path.join(
      standaloneDir,
      '.next',
      'static',
    )}`,
  );

  console.log(
    `Standalone .env: ${
      (await exists(standaloneEnv))
        ? 'included'
        : 'MISSING'
    }`,
  );

  console.log(
    `Standalone db/: ${
      (await exists(standaloneDb))
        ? 'included'
        : 'MISSING'
    }`,
  );

  console.log(
    `Build ID: ${buildId}`,
  );

  console.log(
    'Existing deployment-root .env, db/, uploads/ and tmp/ were preserved.',
  );
}

main().catch((error) => {
  console.error(
    'Standalone deployment preparation failed:',
  );

  console.error(
    error?.stack || error,
  );

  process.exitCode = 1;
});