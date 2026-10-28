# workbench-zones

Independent six-view workbench and note capture plugin for DeepSeek Harness.

This package was extracted from the Haibara theme. It owns:

- `/workbench-zones/items` and `/workbench-zones/zones` host APIs;
- local JSON storage at `pet-data/workbench-zones.json`;
- note capture UI (`conversation.input.right`);
- six-view workbench UI (`sidebar.footer.action`).

## Build

```sh
npm install
npm run build
```

`dist/client.js` is the Web client half. Install the package directory as a DSH bundle.

## Data

Default file: `pet-data/workbench-zones.json`. Override with `WORKBENCH_ZONES_FILE`.

Six zones are views; status is the column. The host rejects a second active main/parallel slot with `slot-occupied`.

## Status

MVP. UI redesign and standalone GitHub repository are still pending.
