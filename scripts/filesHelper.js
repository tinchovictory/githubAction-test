const { readFileSync, writeFileSync } = require('fs');

/* Read CHANGELOG.md and keep the notes from the latest version */
exports.releaseNotes = (changelogPath) => {
  const changelogFile = readFileSync(changelogPath, 'utf-8');
  const lines = changelogFile.split(`\n`);
  const { memo: releaseNotes } = lines.reduce(
    ({ state, memo }, currentLine) => {
      /* Skip unpublished line */
      if (/#[ ]+Unpublished/.test(currentLine)) return { state, memo };

      /* Skip empty lines */
      if (/^[ ]*$/.test(currentLine)) return { state, memo };
     
      /* If the line matches #vX.Y.Z add the line if it's the first appearance, skip it otherwise */
      if (/^#[ ]+v([0-9]+\.){2}[0-9]+/.test(currentLine)) {
        if (state === 'idle') {
          return { state: 'reading', memo: `${memo}${currentLine}\n` };
        }
        return { state: 'end', memo };
      }

      /* Skip every line if current version ended */
      if (state === 'end') {
        return { state, memo };
      }

      /* Add current line to release notes */
      return { state, memo: `${memo}${currentLine}\n` };
    },
    { state: 'idle', memo: '' }
  );
  return releaseNotes;
};

/* Read semver from package.json */
exports.packageVersion = (packagePath) => {
  const packageFile = readFileSync(packagePath, 'utf-8');
  const package = JSON.parse(packageFile);
  const { version } = package;
  return version;
};

/* Bump minor */
exports.newVersion = (prevVersion) => {
  const semver = prevVersion.split('.');
  const nextMinor = parseInt(semver[1]) + 1;
  semver[1] = nextMinor.toString();
  return semver.join('.');
};
