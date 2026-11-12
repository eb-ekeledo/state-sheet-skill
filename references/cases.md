# Standard cases

Start here, drop what doesn't apply, and write realistic props for each.

| id | Label | How to set it up | Watch for |
| --- | --- | --- | --- |
| default | Default | Typical props | The baseline every other state is compared to |
| hover | Hover | `"interact": "hover"` | Change is visible but not jumpy |
| focus | Keyboard focus | `"interact": "focus"` (presses Tab) | A clear focus ring, in both themes |
| pressed | Pressed | `"interact": "press"` | Press feedback, no layout jump |
| disabled | Disabled | `"disabled": true` | Looks disabled in dark mode too |
| loading | Loading | `"loading": true`, add `"sameSizeAs": "default"` | Doesn't shrink or jump; label still readable |
| empty | Empty | Empty list or no data | Says what's missing and what to do next |
| error | Error | An error message | Readable, explains the fix, offers a way out |
| success | Success | Completed state | Distinguishable from default without colour alone |
| long | Long text | The longest real value (names, titles, translations) | Wraps or truncates on purpose |
| huge | Huge numbers | 99,999,999 or a 12-digit amount | Numbers are never cut off |
| rtl | RTL | `"dir": "rtl"` and Arabic or Hebrew copy | Alignment and icons mirror correctly |

## cases.json format

```json
{
  "title": "Save button",
  "cases": [
    { "id": "default", "label": "Default", "props": { "label": "Save changes" } },
    { "id": "focus", "label": "Keyboard focus", "props": { "label": "Save changes" }, "interact": "focus" },
    { "id": "loading", "label": "Loading", "props": { "label": "Save changes", "loading": true }, "sameSizeAs": "default" },
    { "id": "rtl", "label": "RTL", "props": { "label": "حفظ التغييرات" }, "dir": "rtl" }
  ]
}
```

Put `default` first: `sameSizeAs` compares against cases already rendered.
