const core = require('@actions/core');
const { 
  octoClient,
  createRelease,
  createPullRequest,
  currentOwner,
  currentRepo
 } = require('./githubHelper');
const { packageVersion, releaseNotes } = require('./filesHelper');
// const fs = require('fs');

// const createRelease = async () => {
//   const { owner: currentOwner, repo: currentRepo } = context.repo;
//   const tag = '1.1.0';
//   const releaseName = `Release v${tag}`;
//   const body = '# v1.1.0\n## First Release\n- hello world';
//   const commitish = context.sha;

//   try {
//     // Github token
//     const githubToken = process.env.GITHUB_TOKEN;

//     // Get authenticated GitHub client
//     const github = getOctokit(githubToken);

//     // Create a release
//     await github.repos.createRelease({
//       owner: currentOwner,
//       repo: currentRepo,
//       tag_name: tag,
//       name: releaseName,
//       body: body,
//       draft: false,
//       prerelease: false,
//       target_commitish: commitish
//     });
//   } catch(error) {
//     core.setFailed(error.message);
//   }
// }

// const createPullRequest = async () => {
//   const { owner: currentOwner, repo: currentRepo } = context.repo;
//   console.log(context);
//   console.log(context.repo);
//   const body = '# v1.1.0\n## First Release\n- hello world';
//   const commitish = context.sha;

//   try {
//     // Github token
//     const githubToken = process.env.GITHUB_TOKEN;

//     // Get authenticated GitHub client
//     const github = getOctokit(githubToken);

//     // Create a release
//     const response = await github.pulls.create({
//       owner: currentOwner,
//       repo: currentRepo,
//       title: 'PR Title',
//       head: 'release/1.0',
//       base: 'main',
//       body: body,
//     });
//     console.log(response);
//   } catch(error) {
//     core.setFailed(error.message);
//   }
// }

const createVersionRelease = async (octo, version) => {
  console.log(`\nCreating Release v${version}...`);
  const releaseName = `Release v${version}`;
  
  try {
    await createRelease(octo, version, releaseName, releaseNotes(CURR_CHANGELOG_PATH));
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
// const CHANGED_FILES = [PACKAGE_PATH, CHANGELOG_PATH];
const CURR_PACKAGE_PATH = `../${PACKAGE_PATH}`;
const CURR_CHANGELOG_PATH = `../${CHANGELOG_PATH}`;

const run = async () => {
  console.log('Running ci deploy...');

  // Get authenticated GitHub client
  const octo = octoClient();

  const version = packageVersion(CURR_PACKAGE_PATH);

  if(!await createVersionRelease(octo, version)) {
    return;
  }

  if(!await createMergeBackPR(octo, 'main', 'develop', version, CURR_CHANGELOG_PATH)) {
    return;
  }

  console.log('Done!');
}

run();
