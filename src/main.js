const os = require('os')

const core = require('@actions/core')
const tc = require('@actions/tool-cache')

const MANIFEST_URL = 'https://mirror.clarkson.edu/blender/release/'
const DOWNLOAD_URL_BASE = 'https://mirror.clarkson.edu/blender/release/'

const _releases = {}

async function getBlenderMinorVersions() {
  const res = await fetch(MANIFEST_URL)
  const data = await res.text()
  const versions = data
    .split('\n')
    .filter(x => x.match(/Blender\d\.\d/))
    .map(x => x.split('>')[1].split('/<')[0].replace('Blender', ''))
    .filter(
      x => !x.includes('beta') && !x.startsWith('1.') && !x.startsWith('2.')
    )
  return versions
}

async function getBlenderReleases(minorver) {
  if (_releases[minorver]) {
    return _releases[minorver]
  }
  const res = await fetch(`${MANIFEST_URL}/Blender${minorver}`)
  const data = await res.text()
  const releases = data
    .split('\n')
    .filter(x => x.match(/blender-\d/))
    .map(x => x.split('>')[1].split('<')[0])
    .filter(
      x => x.endsWith('.zip') || x.endsWith('.tar.xz') || x.endsWith('.dmg')
    )
  _releases[minorver] = releases
  return releases
}

function filterReleases(releases, osName, arch) {
  return releases.filter(x => x.includes(`-${osName}-${arch}`))
}

function sortMinorVersions(versions) {
  const getVersion = version => {
    const parts = version.split('.')
    return parts[0] * 100 + parts[1]
  }
  return versions.toSorted((a, b) => getVersion(b) - getVersion(a))
}

function sortReleases(releases) {
  const getVersion = release => {
    const parts = release.split('-')[1].split('.')
    return parts[0] * 1000 + parts[1] * 100 + parts[2]
  }
  return releases.toSorted((a, b) => getVersion(b) - getVersion(a))
}

async function findRelease(version, osName, arch) {
  let release = null

  if (version === 'latest') {
    const minorVersions = await getBlenderMinorVersions()
    const sortedVersions = sortMinorVersions(minorVersions)
    let latestMinor = sortedVersions[0]
    let releases = await getBlenderReleases(latestMinor)
    if (releases.length === 0 && sortedVersions.length > 1) {
      // No releases available for this version yet, try the previous one
      latestMinor = sortedVersions[1]
      releases = await getBlenderReleases(latestMinor)
    }
    version = latestMinor
  }

  const parts = version.split('.')
  if (parts.length === 2) {
    const releases = await getBlenderReleases(version)
    const filtered = filterReleases(releases, osName, arch)
    const sorted = sortReleases(filtered)
    release = sorted[0]
  } else if (parts.length === 3) {
    const releases = await getBlenderReleases(`${parts[0]}.${parts[1]}`)
    release = releases.filter(x =>
      x.startsWith(`blender-${version}-${osName}-${arch}`)
    )[0]
  } else {
    throw Error(`Bad version string: ${version}`)
  }

  if (release === null) {
    throw Error(`Unable to find release for ${version}-${osName}-${arch}`)
  }

  return release
}

/**
 * The main function for the action.
 * @returns {Promise<void>} Resolves when the action is complete.
 */
async function run() {
  try {
    const version = core.getInput('blender-version', { required: true })
    const arch = os.arch()
    let osName = null

    if (process.platform === 'linux') {
      osName = 'linux'
    } else if (process.platform === 'darwin') {
      osName = 'macos'
    } else if (process.platform === 'win32') {
      osName = 'windows'
    }

    if (osName === null) {
      throw Error(`Unsupported os: ${osName}`)
    }

    core.info(
      `Finding Blender version matching "${version}" for ${osName}-${arch}`
    )
    const resolvedRelease = await findRelease(version, osName, arch)
    const resolvedVersion = resolvedRelease.split('-')[1]
    const foundBlender = tc.find('blender', resolvedVersion, arch)
    if (foundBlender) {
      core.info(`Using cached ${resolvedVersion}`)
      core.addPath(foundBlender)
    } else {
      core.info(`Found Blender release: ${resolvedRelease}`)

      const versionParts = resolvedRelease.split('-')[1].split('.')
      const versionMinor = `${versionParts[0]}.${versionParts[1]}`
      const downloadUrl = `${DOWNLOAD_URL_BASE}/Blender${versionMinor}/${resolvedRelease}`
      core.info(`Downloading Blender release from ${downloadUrl}`)
      const blenderDownload = await tc.downloadTool(downloadUrl)
      core.info(`Download saved to ${blenderDownload}`)

      let blenderExtracted = null
      if (resolvedRelease.endsWith('.zip')) {
        blenderExtracted = await tc.extractZip(blenderDownload)
      } else if (resolvedRelease.endsWith('.tar.xz')) {
        blenderExtracted = await tc.extractTar(blenderDownload, undefined, 'xJ')
      } else if (resolvedRelease.endsWith('.dmg')) {
        blenderExtracted = await tc.extract7z(blenderDownload)
      } else {
        throw Error(`Unknown extension on download: ${blenderDownload}`)
      }
      core.info(`Extracted Blender release to ${blenderExtracted}`)

      const cachedPath = await tc.cacheDir(
        `${blenderExtracted}/blender-${resolvedVersion}-${osName}-${arch}`,
        'blender',
        resolvedVersion
      )
      core.addPath(cachedPath)

      core.setOutput('blender-version', resolvedVersion)
      core.setOutput('blender-path', cachedPath)
    }
  } catch (error) {
    // Fail the workflow step if an error occurs
    core.debug(error.message)
    core.setFailed(error.message)
  }
}

module.exports = {
  getBlenderMinorVersions,
  getBlenderReleases,
  filterReleases,
  sortReleases,
  findRelease,
  MANIFEST_URL,
  run
}
