const core = require('@actions/core');
const { getOctokit, context } = require('@actions/github');
const fs = require('fs');

const createRelease = async () => {
  const { owner: currentOwner, repo: currentRepo } = context.repo;
  const tag = '1.1.0';
  const releaseName = `Release v${tag}`;
  const body = '# v1.1.0\n## First Release\n- hello world';
  const commitish = context.sha;

  try {
    // Github token
    const githubToken = process.env.GITHUB_TOKEN;

    // Get authenticated GitHub client
    const github = getOctokit(githubToken);

    // Create a release
    await github.repos.createRelease({
      owner: currentOwner,
      repo: currentRepo,
      tag_name: tag,
      name: releaseName,
      body: body,
      draft: false,
      prerelease: false,
      target_commitish: commitish
    });
  } catch(error) {
    core.setFailed(error.message);
  }
}

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

const run = async () => {
  console.log('Running ci deploy');
  await createRelease();
  // await createPullRequest();
  console.log('Done!');
}

run();
