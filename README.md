# setup-blender

This action downloads and installs `blender` on to the system `PATH`

## Usage

See [action.yml](action.yml)

```yaml
steps:
  - uses: actions/checkout@v4
  - uses: moguri/setup-blender@v1
    with:
      blender-version: '3.6'
  - run: blender --version
```
