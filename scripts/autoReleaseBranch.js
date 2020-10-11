const core = require('@actions/core');
const { getOctokit, context } = require('@actions/github');
const { readFileSync, writeFileSync } = require('fs');

const createPullRequest = async (octo, owner, repo, version, branch, baseBranch, body) => {
  await octo.pulls.create({
    owner,
    repo,
    title: `Auto-release v${version} [deploy]`,
    head: branch,
    base: baseBranch,
    body,
  });
};

const createReleaseBranch = async (octo, owner, repo, branchName, baseBranch) => {
  const baseBranchSha = await getBranchSha(octo, owner, repo, baseBranch);
  const createBranchResponse = await octo.git.createRef({
    owner,
    repo,
    ref: `refs/heads/${branchName}`,
    sha: baseBranchSha,
  });
};

const uploadToRepo = async (octo, files, owner, repo, branch, version) => {
  // gets commit's AND its tree's SHA
  const currentCommit = await getCurrentCommit(octo, owner, repo, branch);
  
  const filesPaths = files.map(fullPath => `../${fullPath}`);
  const filesBlobs = await Promise.all(filesPaths.map(createBlobForFile(octo, owner, repo)));
  
  const newTree = await createNewTree(
    octo,
    owner,
    repo,
    filesBlobs,
    files,
    currentCommit.treeSha
  );
  
  const commitMessage = `Auto-release v${version}`;
  const newCommit = await createNewCommit(
    octo,
    owner,
    repo,
    commitMessage,
    newTree.sha,
    currentCommit.commitSha
  );
  
  await setBranchToCommit(octo, owner, repo, branch, newCommit.sha);
};

const getBranchSha = async (octo, owner, repo, branch) => {
  const { data: refData } = await octo.git.getRef({
    owner,
    repo,
    ref: `heads/${branch}`,
  });
  return refData.object.sha;
};

const getCurrentCommit = async (octo, owner, repo, branch) => {
  const commitSha = await getBranchSha(octo, owner, repo, branch);
  
  const { data: commitData } = await octo.git.getCommit({
    owner,
    repo,
    commit_sha: commitSha,
  });
  
  return {
    commitSha,
    treeSha: commitData.tree.sha,
  }
};

const getFileAsUTF8 = (filePath) => readFileSync(filePath, 'utf-8');

const createBlobForFile = (octo, owner, repo) => async (filePath) => {
  const content = getFileAsUTF8(filePath);
  
  const blobData = await octo.git.createBlob({
    owner,
    repo,
    content,
    encoding: 'utf-8',
  });
  
  return blobData.data;
};

const createNewTree = async (octo, owner, repo, blobs, paths, parentTreeSha) => {
  const tree = blobs.map(({ sha }, index) => ({
    path: paths[index],
    mode: `100644`,
    type: `blob`,
    sha,
  }));
  
  const { data } = await octo.git.createTree({
    owner,
    repo,
    tree,
    base_tree: parentTreeSha,
  });
 
  return data
};

const createNewCommit = async (
  octo,
  owner,
  repo,
  message,
  currentTreeSha,
  currentCommitSha
) =>
  (await octo.git.createCommit({
    owner,
    repo,
    message,
    tree: currentTreeSha,
    parents: [currentCommitSha],
  })).data;

const setBranchToCommit = (
  octo,
  owner,
  repo,
  branch,
  commitSha
) =>
  octo.git.updateRef({
    owner,
    repo,
    ref: `heads/${branch}`,
    sha: commitSha,
  });

const releaseNotes = (changelogPath) => {
  const changelogFile = readFileSync(changelogPath, 'utf-8');
  const lines = changelogFile.split(`\n`);
  const { memo: releaseNotes } = lines.reduce(
    ({ state, memo }, currentLine) => {
      if (/#[ ]+Unpublished/.test(currentLine)) return { state, memo };
      if (/^[ ]*$/.test(currentLine)) return { state, memo };
      
      if (/^#[ ]+v([0-9]+\.){2}[0-9]+/.test(currentLine)) {
        if (state === 'idle') {
          return { state: 'reading', memo: `${memo}${currentLine}\n` };
        }
        return { state: 'end', memo };
      }
      if (state === 'end') {
        return { state, memo };
      }
      return { state, memo: `${memo}${currentLine}\n` };
    },
    { state: 'idle', memo: '' }
  );
  return releaseNotes.join('\n');
};

const packageVersion = (packagePath) => {
  const packageFile = readFileSync(packagePath, 'utf-8');
  const package = JSON.parse(packageFile);
  const { version } = package;
  return version;
};

const newVersion = (prevVersion) => {
  const semver = prevVersion.split('.');
  const nextMinor = parseInt(semver[1]) + 1;
  semver[1] = nextMinor.toString();
  return semver.join('.');
};

const removeUnpublished = (changelogPath, version) => {
  const changelogFile = readFileSync(changelogPath, 'utf-8');
  const lines = changelogFile.split(`\n`);
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
  writeFileSync(changelogPath, changelogUpdated);
};

const bumpPackageVersion = (packagePath, version) => {
  const packageFile = readFileSync(packagePath, 'utf-8');
  const package = JSON.parse(packageFile);
  package.version = version;
  const json = JSON.stringify(package, null, 2);
  const updatedFile = `${json}\n`
  writeFileSync(packagePath, updatedFile);
};


const PACKAGE_PATH = 'package.json';
const CHANGELOG_PATH = 'CHANGELOG.md';
const CHANGED_FILES = [PACKAGE_PATH, CHANGELOG_PATH];
const CURR_PACKAGE_PATH = `../${PACKAGE_PATH}`;
const CURR_CHANGELOG_PATH = `../${CHANGELOG_PATH}`;

const run = async () => {
  console.log('Running auto-release...');
  
  // Get authenticated GitHub client
  const githubToken = process.env.GITHUB_TOKEN;
  const octo = getOctokit(githubToken);
  const { owner, repo } = context.repo;

  const version = newVersion(packageVersion(CURR_PACKAGE_PATH));
  const startBranch = 'develop';
  const autoReleaseBranch = `auto-release/${version}`;
  const finalBranch = 'main';

  // Create release branch
  console.log(`\nCreating branch ${autoReleaseBranch}...`);
  try {
    await createReleaseBranch(octo, owner, repo, autoReleaseBranch, startBranch);
  } catch(error) {
    core.setFailed(error.message);
    console.log(`\n\nFailed to create branch named ${autoReleaseBranch}`);
    return;
  }
  console.log(`Branch ${autoReleaseBranch} created`);

  // Bump package.json
  console.log(`\nBumping package.json to version ${version}...`);
  try {
    bumpPackageVersion(CURR_PACKAGE_PATH, version);
  } catch(error) {
    core.setFailed(error.message);
    console.log(`\nFailed to bump package to version ${version}`);
    return;
  }
  console.log(`Version bumped`);

  // Remove unpublished
  console.log(`\nRemoving unpublished to version ${version}...`);
  try {
    removeUnpublished(CURR_CHANGELOG_PATH, version)
  } catch(error) {
    core.setFailed(error.message);
    console.log(`\nFailed to edit changelog`);
    return;
  }
  console.log(`Unpublished removed`);
  
  console.log(`\nPushing changes to ${autoReleaseBranch}...`);
  try {
    await uploadToRepo(octo, CHANGED_FILES, owner, repo, autoReleaseBranch, version);
  } catch(error) {
    core.setFailed(error.message);
    console.log(`\nFailed to push changes`);
    return;
  }
  console.log(`Changes pushed to ${autoReleaseBranch}`);

  console.log(`\nCreating PR to ${finalBranch}`);
  try {
    await createPullRequest(octo, owner, repo, version, autoReleaseBranch, finalBranch, releaseNotes(CURR_CHANGELOG_PATH));
  } catch(error) {
    core.setFailed(error.message);
    console.log(`\nFailed to create PR`);
    return;
  }
  console.log(`PR created`)

  console.log('\n\nDone!');
}

run();