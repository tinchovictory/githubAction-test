const core = require('@actions/core');
const { 
  octoClient,
  currentRepo, 
  currentOwner,
  createPullRequest,
  createBranch,
  uploadToRepo
} = require('./githubHelper');
const { releaseNotes, packageVersion, newVersion } = require('./filesHelper');


/* Create release branch starting from base branch */
const createReleaseBranch = async (octo, branchName, baseBranch) => {
  console.log(`\nCreating branch ${branchName}...`);

  try {
    await createBranch(octo, currentOwner(), currentRepo(), branchName, baseBranch);
  } catch(error) {
    core.setFailed(error.message);
    console.log(`\n\nFailed to create branch named ${branchName}`);
    return false;
  }

  console.log(`Branch ${branchName} created`);
  return true;
};

/* Remove # Unpublished from CHANGELOG.md */
const removeUnpublished = (changelogPath, version) => {
  console.log(`\nRemoving unpublished to version ${version}...`);
  
  try {
    /* Open changelog */
    const changelogFile = readFileSync(changelogPath, 'utf-8');
    const lines = changelogFile.split(`\n`);

    /* Iterate each line adding the version number after the first Unpublished */
    const { memo: changelogUpdated } = lines.reduce(
      ({ state, memo }, currentLine) => {
        if (!state && /#[ ]+Unpublished/.test(currentLine)) {
          return { 
            state: true,
            memo: `${memo}${currentLine}\n\n# v${version}\n`,
          };
        }
        return { state, memo: `${memo}${currentLine}\n` };
      },
      { state: false, memo: '' }
    );

    /* Save file */
    writeFileSync(changelogPath, changelogUpdated);
  } catch(error) {
    core.setFailed(error.message);
    console.log(`\nFailed to edit changelog`);
    return false;
  }

  console.log(`Unpublished removed`);
  return true;
};

/* Bump minor version from package.json */
const bumpPackageVersion = (packagePath, version) => {
  console.log(`\nBumping package.json to version ${version}...`);
  try {
    const packageFile = readFileSync(packagePath, 'utf-8');
    const package = JSON.parse(packageFile);
    package.version = version;
    const json = JSON.stringify(package, null, 2);
    const updatedFile = `${json}\n`
    writeFileSync(packagePath, updatedFile);
  } catch(error) {
    core.setFailed(error.message);
    console.log(`\nFailed to bump package to version ${version}`);
    return false;
  }
  console.log(`Version bumped`);
  return true;
};

/* Push the changed files into the branch */
const commitAndPushChanges = async (octo, branch, files, version) => {
  console.log(`\nPushing changes to ${branch}...`);

  try {
    const commitMessage = `Auto-release v${version}`;
    await uploadToRepo(octo, files, currentOwner(), currentRepo(), branch, commitMessage);
  } catch(error) {
    core.setFailed(error.message);
    console.log(`\nFailed to push changes`);
    return false;
  }
  console.log(`Changes pushed to ${branch}`);
  return true;
};

const createPR = async (octo, headBranch, baseBranch, version, changelogPath) => {
  console.log(`\nCreating PR to ${baseBranch}`);

  try {
    const title = `Auto-release v${version} [deploy]`;
    const body = releaseNotes(changelogPath);
    await createPullRequest(octo, currentOwner(), currentRepo(), headBranch, baseBranch, title, body);
  } catch(error) {
    core.setFailed(error.message);
    console.log(`\nFailed to create PR`);
    return false;
  }

  console.log(`PR created`);
  return true;
};


const PACKAGE_PATH = 'package.json';
const CHANGELOG_PATH = 'CHANGELOG.md';
const CHANGED_FILES = [PACKAGE_PATH, CHANGELOG_PATH];
const CURR_PACKAGE_PATH = `../${PACKAGE_PATH}`;
const CURR_CHANGELOG_PATH = `../${CHANGELOG_PATH}`;

const run = async () => {
  console.log('Running auto-release...');
  
  const version = newVersion(packageVersion(CURR_PACKAGE_PATH));
  const startBranch = 'develop';
  const autoReleaseBranch = `auto-release/${version}`;
  const finalBranch = 'main';
  
  // Get authenticated GitHub client
  const octo = octoClient();

  if (!await createReleaseBranch(octo, autoReleaseBranch, startBranch)) {
    return;
  }

  if (!bumpPackageVersion(CURR_PACKAGE_PATH, version)) {
    return;
  }

  if (!removeUnpublished(CURR_CHANGELOG_PATH, version)) {
    return;
  }
  
  if (!await commitAndPushChanges(octo, autoReleaseBranch, CHANGED_FILES, version)) {
    return;
  }

  if (!await createPR(octo, autoReleaseBranch, finalBranch, version, CURR_CHANGELOG_PATH)) {
    return;
  }

  console.log('\n\nDone!');
}

run();