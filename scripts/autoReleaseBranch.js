const core = require('@actions/core');
const { getOctokit, context } = require('@actions/github');
const { readFileSync, writeFileSync } = require('fs');

const createPullRequest = async () => {
  const { owner: currentOwner, repo: currentRepo } = context.repo;
  console.log(context);
  console.log(context.repo);
  const body = '# v1.1.0\n## First Release\n- hello world';
  const commitish = context.sha;

  try {
    // Github token
    const githubToken = process.env.GITHUB_TOKEN;

    // Get authenticated GitHub client
    const github = getOctokit(githubToken);

    // Create a release
    const response = await github.pulls.create({
      owner: currentOwner,
      repo: currentRepo,
      title: 'PR Title',
      head: 'release/1.0',
      base: 'main',
      body: body,
    });
    console.log(response);
  } catch(error) {
    core.setFailed(error.message);
  }
};

const createReleaseBranch = async (octo, owner, repo, branchName) => {
  const baseBranchSha = await getBranchSha(octo, owner, repo, 'main');
  const createBranchResponse = await octo.git.createRef({
    owner,
    repo,
    ref: `refs/heads/${branchName}`,
    sha: baseBranchSha,
  });
  console.log(createBranchResponse);
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


const run = async () => {
  console.log('Running auto-release...');
  
  // Get authenticated GitHub client
  const githubToken = process.env.GITHUB_TOKEN;
  const octo = getOctokit(githubToken);
  const { owner, repo } = context.repo;

  const version = 1.2;
  const autoReleaseBranch = `auto-release/${version}`;

  // Create release branch
  console.log(`\nCreating branch ${autoReleaseBranch}...`);
  try {
    await createReleaseBranch(octo, owner, repo, autoReleaseBranch);
  } catch(error) {
    core.setFailed(error.message);
    console.log(`\n\nFailed to create branch named ${autoReleaseBranch}`);
    return;
  }
  console.log(`Branch ${autoReleaseBranch} created`);

  console.log(`\nBumping versions...`);
  // Bump package.json

  // Remove unpublished
  writeFileSync('../test/file.md', '# Cambiado');
  console.log(`\nVersions bumped`);
  
  const changedFiles = ['test/file.md'];
  console.log(`\nPushing changes to ${autoReleaseBranch}...`);
  try {
    await uploadToRepo(octo, changedFiles, owner, repo, autoReleaseBranch, version);
  } catch(error) {
    core.setFailed(error.message);
    console.log(`\n\nFailed to push changes`);
    return;
  }
  console.log(`\nChanges pushed to ${autoReleaseBranch}`);

  console.log('\n\nDone!');
}

run();