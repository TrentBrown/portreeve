// @ts-check

const expectedBunVersion = '1.3.14';

if (typeof Bun === 'undefined') {
  throw new Error(
    `Portreeve requires Bun ${expectedBunVersion} to run project scripts.`,
  );
}

if (Bun.version !== expectedBunVersion) {
  throw new Error(
    `Portreeve requires Bun ${expectedBunVersion}; received ${Bun.version} from ${process.execPath}.`,
  );
}

console.log(`Bun ${Bun.version} (${process.platform}/${process.arch})`);
