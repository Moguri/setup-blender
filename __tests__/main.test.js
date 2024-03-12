const fs = require('fs')
const path = require('path')

const core = require('@actions/core')
const github = require('@actions/github')
const main = require('../src/main')

// Mock the GitHub Actions core library
const getInputMock = jest.spyOn(core, 'getInput').mockImplementation()
const setFailedMock = jest.spyOn(core, 'setFailed').mockImplementation()
const setOutputMock = jest.spyOn(core, 'setOutput').mockImplementation()

// Mock the action's main function
const runMock = jest.spyOn(main, 'run')

// Mock fetch
const fetchMock = jest.spyOn(global, 'fetch').mockImplementation()
const fetchData = {
  [main.MANIFEST_URL]: fs.readFileSync(
    path.join(__dirname, 'manifest.html'),
    'utf8'
  ),
  [`${main.MANIFEST_URL}/Blender3.3`]: fs.readFileSync(
    path.join(__dirname, 'blender3.3.html'),
    'utf8'
  ),
  [`${main.MANIFEST_URL}/Blender4.0`]: fs.readFileSync(
    path.join(__dirname, 'blender4.0.html'),
    'utf8'
  )
}

describe('action', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    fetchMock.mockImplementation(uri => {
      const data = fetchData[uri]
      if (typeof data === 'undefined') {
        throw new Error(`404: ${uri}`)
      }
      return Promise.resolve({
        text: () => Promise.resolve(data)
      })
    })
  })

  it('gets a list of Blender versions', async () => {
    const versions = await main.getBlenderMinorVersions()

    expect(versions).toContain('3.3')
    expect(versions).toContain('3.6')
    expect(versions).toContain('4.0')
  })

  it('gets a list of Blender releases', async () => {
    const versions = await main.getBlenderReleases('3.3')

    expect(versions).toContain('blender-3.3.16-windows-x64.zip')
    expect(versions).toContain('blender-3.3.16-linux-x64.tar.xz')
    expect(versions).toContain('blender-3.3.16-macos-x64.dmg')
    expect(versions).toContain('blender-3.3.16-macos-arm64.dmg')
  })

  it('filters releases by os and arch', async () => {
    const releases = [
      'blender-3.3.16-windows-x64.zip',
      'blender-3.3.16-linux-x64.tar.xz',
      'blender-3.3.16-macos-x64.dmg',
      'blender-3.3.16-macos-arm64.dmg'
    ]

    expect(main.filterReleases(releases, 'win32', 'x64')).toEqual([])
    expect(main.filterReleases(releases, 'windows', 'x64')).toEqual([
      'blender-3.3.16-windows-x64.zip'
    ])
    expect(main.filterReleases(releases, 'linux', 'x64')).toEqual([
      'blender-3.3.16-linux-x64.tar.xz'
    ])
    expect(main.filterReleases(releases, 'macos', 'x64')).toEqual([
      'blender-3.3.16-macos-x64.dmg'
    ])
    expect(main.filterReleases(releases, 'macos', 'arm64')).toEqual([
      'blender-3.3.16-macos-arm64.dmg'
    ])
  })

  it('sorts releases by semver', async () => {
    const releases = [
      'blender-3.3.16-windows-x64.zip',
      'blender-3.3.2-windows-x64.zip',
      'blender-3.3.15-windows-x64.zip'
    ]

    expect(main.sortReleases(releases)).toEqual([
      'blender-3.3.16-windows-x64.zip',
      'blender-3.3.15-windows-x64.zip',
      'blender-3.3.2-windows-x64.zip'
    ])
  })

  it('finds latest release', async () => {
    const release = await main.findRelease('latest', 'linux', 'x64')
    expect(release).toEqual('blender-4.0.2-linux-x64.tar.xz')
  })

  it('finds release from X.Y version', async () => {
    const release = await main.findRelease('3.3', 'windows', 'x64')
    expect(release).toEqual('blender-3.3.16-windows-x64.zip')
  })

  it('finds release from X.Y.Z version', async () => {
    const release = await main.findRelease('3.3.15', 'macos', 'arm64')
    expect(release).toEqual('blender-3.3.15-macos-arm64.dmg')
  })

  it('sets a failed status', async () => {
    // Mock the action's inputs
    getInputMock.mockImplementation(name => 'badver')

    await main.run()

    expect(runMock).toHaveReturned()
    expect(setFailedMock).toHaveBeenCalledWith('Bad version string: badver')
  })
})
