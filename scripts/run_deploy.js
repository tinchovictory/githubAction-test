const core = require('@actions/core');
const { 
  octoClient,
  createRelease,
  createPullRequest,
  currentOwner,
  currentRepo
 } = require('./githubHelper');
const { packageVersion, releaseNotes } = require('./filesHelper');

const createVersionRelease = async (octo, version, baseBranch) => {
  console.log(`\nCreating Release v${version}...`);
  const releaseName = `Release v${version}`;
  
  try {
    await createRelease(octo, currentOwner(), currentRepo(), baseBranch, version, releaseName, releaseNotes(CURR_CHANGELOG_PATH));
  } catch(error) {
    core.setFailed(error.message);
    console.log(`\nFailed to create release`);
    return false;
  }
  console.log(`\nRelease v${version} created`);
  return true;
};

const createMergeBackPR = async (octo, headBranch, baseBranch, version, changelogPath) => {
  console.log(`\nCreating merge-back PR to ${baseBranch}`);

  try {
    const title = `Merge back v${version}`;
    const body = 'Automatic merge-back';
    await createPullRequest(octo, currentOwner(), currentRepo(), headBranch, baseBranch, title, body);
  } catch(error) {
    core.setFailed(error.message);
    console.log(`\nFailed to create merge-back PR`);
    return false;
  }

  console.log(`Merge-back PR created`);
  return true;
};


const PACKAGE_PATH = 'package.json';
const CHANGELOG_PATH = 'CHANGELOG.md';
const CURR_PACKAGE_PATH = `../${PACKAGE_PATH}`;
const CURR_CHANGELOG_PATH = `../${CHANGELOG_PATH}`;

const run = async () => {
  console.log('Running ci deploy...');

  const mainBranch = 'main';
  const developBranch = 'develop';

  // Get authenticated GitHub client
  const octo = octoClient();

  const version = packageVersion(CURR_PACKAGE_PATH);

  if(!await createVersionRelease(octo, version, mainBranch)) {
    return;
  }

  if(!await createMergeBackPR(octo, mainBranch, developBranch, version, CURR_CHANGELOG_PATH)) {
    return;
  }

  console.log('Done!');
}

run();
