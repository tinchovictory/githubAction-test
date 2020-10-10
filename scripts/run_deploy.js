const core = require('@actions/core');
const { GitHub, context } = require('@actions/github');
const fs = require('fs');

const run = async () => {
  console.log('running ci deploy');
  console.log(context.repo);
  const { owner: currentOwner, repo: currentRepo } = context.repo;
  console.log(`owner: ${currentOwner}, repo: ${currentOwner}`);

  const tag = '1.0.0';
  const releaseName = `Release v${tag}`;
  const body = '#v1.0.0\n##First Release\n-hello world';
  const draft = false;
  const prerelease = false;
  const commitish = context.sha;

  try {
    // Github token
    // const githubToken = core.getInput('githubToken');
    const githubToken = process.env.GITHUB_TOKEN;

    console.log(`github token is ${githubToken}`);

    // Get authenticated GitHub client (Ocktokit): https://github.com/actions/toolkit/tree/master/packages/github#usage
    const github = new GitHub(githubToken);

    // Create a release
    // API Documentation: https://developer.github.com/v3/repos/releases/#create-a-release
    // Octokit Documentation: https://octokit.github.io/rest.js/#octokit-routes-repos-create-release
    const createReleaseResponse = await github.repos.createRelease({
      owner: currentOwner,
      repo: currentRepo,
      tag_name: tag,
      name: releaseName,
      body: body,
      draft: false,
      prerelease: false,
      target_commitish: commitish
    });

    // Get the ID, html_url, and upload URL for the created Release from the response
    const {
      data: { id: releaseId, html_url: htmlUrl, upload_url: uploadUrl }
    } = createReleaseResponse;

    console.log(`Release created!`);
    console.log(`Release id: ${releaseId}`);
    console.log(`Release url: ${htmlUrl}`);
    console.log(`Release upload url: ${uploadUrl}`);

    console.log(createReleaseResponse);


    console.log('Done!');
  } catch(error) {
    core.setFailed(error.message);
  }
}

run();

// async function run() {
//   try {
//     // Get authenticated GitHub client (Ocktokit): https://github.com/actions/toolkit/tree/master/packages/github#usage
//     const github = new GitHub(process.env.GITHUB_TOKEN);

//     // Get owner and repo from context of payload that triggered the action
//     const { owner: currentOwner, repo: currentRepo } = context.repo;

//     // Get the inputs from the workflow file: https://github.com/actions/toolkit/tree/master/packages/core#inputsoutputs
//     const tagName = core.getInput('tag_name', { required: true });

//     // This removes the 'refs/tags' portion of the string, i.e. from 'refs/tags/v1.10.15' to 'v1.10.15'
//     const tag = tagName.replace('refs/tags/', '');
//     const releaseName = core.getInput('release_name', { required: false }).replace('refs/tags/', '');
//     const body = core.getInput('body', { required: false });
//     const draft = core.getInput('draft', { required: false }) === 'true';
//     const prerelease = core.getInput('prerelease', { required: false }) === 'true';
//     const commitish = core.getInput('commitish', { required: false }) || context.sha;

//     const bodyPath = core.getInput('body_path', { required: false });
//     const owner = core.getInput('owner', { required: false }) || currentOwner;
//     const repo = core.getInput('repo', { required: false }) || currentRepo;
//     let bodyFileContent = null;
//     if (bodyPath !== '' && !!bodyPath) {
//       try {
//         bodyFileContent = fs.readFileSync(bodyPath, { encoding: 'utf8' });
//       } catch (error) {
//         core.setFailed(error.message);
//       }
//     }

//     // Create a release
//     // API Documentation: https://developer.github.com/v3/repos/releases/#create-a-release
//     // Octokit Documentation: https://octokit.github.io/rest.js/#octokit-routes-repos-create-release
//     const createReleaseResponse = await github.repos.createRelease({
//       owner,
//       repo,
//       tag_name: tag,
//       name: releaseName,
//       body: bodyFileContent || body,
//       draft,
//       prerelease,
//       target_commitish: commitish
//     });

//     // Get the ID, html_url, and upload URL for the created Release from the response
//     const {
//       data: { id: releaseId, html_url: htmlUrl, upload_url: uploadUrl }
//     } = createReleaseResponse;

//     // Set the output variables for use by other actions: https://github.com/actions/toolkit/tree/master/packages/core#inputsoutputs
//     core.setOutput('id', releaseId);
//     core.setOutput('html_url', htmlUrl);
//     core.setOutput('upload_url', uploadUrl);
//   } catch (error) {
//     core.setFailed(error.message);
//   }
// }

// module.exports = run;
