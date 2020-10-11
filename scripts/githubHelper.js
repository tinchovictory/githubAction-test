const { getOctokit, context } = require('@actions/github');
const { readFileSync } = require('fs');

/* Authenticated octokit client */
exports.octoClient = () => {
  const githubToken = process.env.GITHUB_TOKEN;
  return getOctokit(githubToken);
};

/* Owner of the repo running */
exports.currentOwner = () => {
  return context.repo.owner;
};

/* Name of the repo running */
exports.currentRepo = () => {
  return context.repo.repo;
};

/* Create Pull Request from headBranch into baseBranch */
exports.createPullRequest = async (octo, owner, repo, headBranch, baseBranch, title, body) => {
  await octo.pulls.create({
    owner,
    repo,
    title,
    head: headBranch,
    base: baseBranch,
    body,
  });
};

/* Create new branch starting from baseBranch */
exports.createBranch = async (octo, owner, repo, branchName, baseBranch) => {
  const baseBranchSha = await getBranchSha(octo, owner, repo, baseBranch);
  const createBranchResponse = await octo.git.createRef({
    owner,
    repo,
    ref: `refs/heads/${branchName}`,
    sha: baseBranchSha,
  });
};

/* Add, Commit, Push files into branch */
/* files is an array of files starting from the project root */
exports.uploadToRepo = async (octo, files, owner, repo, branch, message) => {
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
  
  const newCommit = await createNewCommit(
    octo,
    owner,
    repo,
    message,
    newTree.sha,
    currentCommit.commitSha
  );
  
  await setBranchToCommit(octo, owner, repo, branch, newCommit.sha);
};

/* Create a release of current commit */
exports.createRelease = async (octo, tag, releaseName, body) => {
  const commitish = context.sha;

  // Create a release
  await octo.repos.createRelease({
    owner: currentOwner(),
    repo: currentRepo(),
    tag_name: tag,
    name: releaseName,
    body: body,
    draft: false,
    prerelease: false,
    target_commitish: commitish
  });
};

/* Github helper functions */

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
