# setup-blender

This action prints `Hello, World!` or `Hello, <who-to-greet>!` to the log. To
learn how this action was built, see
[Creating a JavaScript action](https://docs.github.com/en/actions/creating-actions/creating-a-javascript-action).

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
