# js-action-release-workflow

[Workflow](.github/workflows/release.yaml)

GitHub Actions Reusable Workflow for releasing JavaScript Actions

1. Install npm packages through [Takumi Guard](https://github.com/flatt-security/setup-takumi-guard-npm) with [download-npm-package-action](https://github.com/suzuki-shunsuke/download-npm-package-action) in a job with `id-token: write`
2. Restore `node_modules`, build the action, and release it with [release-js-action](https://github.com/suzuki-shunsuke/release-js-action) in a job without `id-token: write`
3. Upload `dist` as an artifact, so callers can test the built action

Pull requests from forks can't push branches, so the action is built but not released.

## How to use

```yaml
jobs:
  release:
    uses: suzuki-shunsuke/js-action-release-workflow/.github/workflows/release.yaml@main
    permissions:
      contents: write # To push the release branch
      pull-requests: write # To post comments to pull requests
      id-token: write # For Takumi Guard
    with:
      version: pr/${{github.event.pull_request.number}} # pr/<pr number>, latest, or vX.Y.Z
      pr: ${{github.event.pull_request.number}} # Optional. The merge commit of the pull request is released
    secrets:
      TAKUMI_GUARD_BOT_ID: ${{secrets.TAKUMI_GUARD_BOT_ID}}
```

### Inputs

- `version` (Required): `pr/<pr number>`, `latest`, or `vX.Y.Z`
- `pr`: Pull Request Number. If this is set, the merge commit of the pull request (`refs/pull/<pr>/merge`) is released, so the release and the tests of the action use the code merged into the base branch. It exists while the pull request is open and has no conflict. Otherwise, the default ref of actions/checkout is released
- `is_comment`: If this is true, a comment is posted to the pull request. The default is false
- `files`: Files to be committed in addition to dist
- `working_directory`: The directory where package.json and package-lock.json exist. The default is `.`
- `node-version-file`: The default is `.node-version`
- `build_command`: The default is `npm run build`
- `aqua_version`: If this is set, aqua is installed before building the action
- `npm_artifact_name`: The name of the artifact created by [download-npm-package-action](https://github.com/suzuki-shunsuke/download-npm-package-action) in the caller workflow. See below
- `ref`: The git ref to build and release. This takes precedence over `pr`. If `npm_artifact_name` is set, set this to the commit where the artifact was created
- `artifact_suffix`: A suffix of artifact names. Artifact names must be unique in a workflow run, so set this when this workflow is called multiple times in a workflow run

### Outputs

- `sha`: The commit SHA where the action was built

## Share node_modules with other jobs

By default, the workflow installs npm packages in its own job.
To share `node_modules` with other jobs such as [js-action-test-workflow](https://github.com/suzuki-shunsuke/js-action-test-workflow), install them with [download-npm-package-action](https://github.com/suzuki-shunsuke/download-npm-package-action) in the caller workflow and pass the artifact name via `npm_artifact_name` and its output `sha` via `ref`.
Then the workflow skips installing npm packages, and the jobs run in parallel on the same commit.

```yaml
jobs:
  npm:
    uses: suzuki-shunsuke/download-npm-package-action/.github/workflows/download.yaml@main
    permissions:
      contents: read
      id-token: write
    with:
      ref: refs/pull/${{github.event.pull_request.number}}/merge
    secrets:
      TAKUMI_GUARD_BOT_ID: ${{secrets.TAKUMI_GUARD_BOT_ID}}

  test:
    needs: npm
    uses: suzuki-shunsuke/js-action-test-workflow/.github/workflows/test.yaml@main
    permissions:
      contents: read
      id-token: write # The skipped npm job still requires this permission
    with:
      npm_artifact_name: node_modules
      ref: ${{needs.npm.outputs.sha}}

  release:
    needs: npm
    uses: suzuki-shunsuke/js-action-release-workflow/.github/workflows/release.yaml@main
    permissions:
      contents: write
      pull-requests: write
      id-token: write # The skipped npm job still requires this permission
    with:
      version: pr/${{github.event.pull_request.number}}
      pr: ${{github.event.pull_request.number}}
      npm_artifact_name: node_modules
      ref: ${{needs.npm.outputs.sha}}
```

## Test the built action

The workflow uploads `dist` as the artifact `dist` (`dist<artifact_suffix>`).
Download it to test the built action.
You don't need to install npm packages because dist includes dependencies.

```yaml
jobs:
  release:
    # ...

  test-action:
    runs-on: ubuntu-26.04
    needs: release
    permissions:
      contents: read
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
        with:
          ref: ${{needs.release.outputs.sha}}
          persist-credentials: false
      - uses: actions/download-artifact@9000827ccba6bdab643e8b6fd33ac0654aef8333 # v8.0.2
        with:
          name: dist
          path: dist
      - uses: ./
```
