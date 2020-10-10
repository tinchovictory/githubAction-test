const core = require('@actions/core');
const { getOctokit, context } = require('@actions/github');
const { readFile, writeFileSync } = require('fs');
const glob = require('globby');
const path = require('path');
// import glob from 'globby' 
// import path from 'path'
// import { readFile } from 'fs-extra'

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
}


const main = async () => {
  const githubToken = process.env.GITHUB_TOKEN;

  // Get authenticated GitHub client
  const octo = getOctokit(githubToken);

  const files = ['../test/file.md'];
  const { owner: currentOwner, repo: currentRepo } = context.repo;
  
  await uploadToRepo(octo, files, currentOwner, currentRepo, 'release/1.0');
}

const uploadToRepo = async (octo, files, owner, repo, branch) => {
  // gets commit's AND its tree's SHA
  const currentCommit = await getCurrentCommit(octo, owner, repo, branch);
  console.log(`currentCommit ${currentCommit}`);
  // const filesPaths = await glob(coursePath)
  const filesBlobs = await Promise.all(files.map(createBlobForFile(octo, owner, repo)));
  console.log(filesBlobs);
  const pathsForBlobs = files.map(fullPath => path.relative(coursePath, fullPath));
  console.log(`pathsForBlobs ${pathsForBlobs}`);
  // const newTree = await createNewTree(
  //   octo,
  //   org,
  //   repo,
  //   filesBlobs,
  //   pathsForBlobs,
  //   currentCommit.treeSha
  // )
  // const commitMessage = `My commit message`
  // const newCommit = await createNewCommit(
  //   octo,
  //   org,
  //   repo,
  //   commitMessage,
  //   newTree.sha,
  //   currentCommit.commitSha
  // )
  // await setBranchToCommit(octo, org, repo, branch, newCommit.sha)
};


const getCurrentCommit = async (octo, owner, repo, branch) => {
  const { data: refData } = await octo.git.getRef({
    owner,
    repo,
    ref: `heads/${branch}`,
  });
  console.log(`refData: ${refData}`);
  const commitSha = refData.object.sha;
  console.log(`commitSha: ${commitSha}`);
  const { data: commitData } = await octo.git.getCommit({
    owner,
    repo,
    commit_sha: commitSha,
  });
  console.log(`commitData: ${commitData}`);
  return {
    commitSha,
    treeSha: commitData.tree.sha,
  }
};

// Notice that readFile's utf8 is typed differently from Github's utf-8
const getFileAsUTF8 = (filePath) => readFile(filePath, 'utf8');

const createBlobForFile = (octo, owner, repo) => async (filePath) => {
  const content = await getFileAsUTF8(filePath);
  console.log(`File content ${content}`);
  const blobData = await octo.git.createBlob({
    owner,
    repo,
    content,
    encoding: 'utf-8',
  })
  return blobData.data;
};

const createNewTree = async (octo, owner, repo, blobs, paths, parentTreeSha) => {
  // My custom config. Could be taken as parameters
  const tree = blobs.map(({ sha }, index) => ({
    path: paths[index],
    mode: `100644`,
    type: `blob`,
    sha,
  }))
  const { data } = await octo.git.createTree({
    owner,
    repo,
    tree,
    base_tree: parentTreeSha,
  })
  return data
}

const createNewCommit = async (
  octo,
  org,
  repo,
  message,
  currentTreeSha,
  currentCommitSha
) =>
  (await octo.git.createCommit({
    owner: org,
    repo,
    message,
    tree: currentTreeSha,
    parents: [currentCommitSha],
  })).data

const setBranchToCommit = (
  octo,
  org,
  repo,
  branch,
  commitSha
) =>
  octo.git.updateRef({
    owner: org,
    repo,
    ref: `heads/${branch}`,
    sha: commitSha,
  })


const run = async () => {
  console.log('Running ci deploy');
  // await createPullRequest();

  // const coursePath = '../scripts';
  // const filesPaths = await glob(coursePath);
  // const pathsForBlobs = filesPaths.map(fullPath => path.relative(coursePath, fullPath));

  // console.log(`filePath: ${filesPaths}`);
  // console.log(`pathsForBlobs: ${pathsForBlobs}`);

  writeFileSync('../test/file.md', '# Cambiado');

  await main();

  console.log('Done!');
}

run();