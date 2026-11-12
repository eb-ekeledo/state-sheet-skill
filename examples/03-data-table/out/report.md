# State sheet: Invoices table

6 states, light and dark, 320 and 560 px. 8 cells flagged.

| State | Theme | Width | Problem |
| --- | --- | --- | --- |
| empty | light | 320px | Renders nothing |
| empty | light | 560px | Renders nothing |
| empty | dark | 320px | Renders nothing |
| empty | dark | 560px | Renders nothing |
| error | light | 320px | Contrast 2.05:1 under 4.5:1 on "Couldn't load invoices. Check yo" |
| error | light | 560px | Contrast 2.05:1 under 4.5:1 on "Couldn't load invoices. Check yo" |
| huge | light | 320px | Number cut off: "INV-9999999" |
| huge | light | 320px | Number cut off: "$12,345,678,901.99" |
| huge | dark | 320px | Number cut off: "INV-9999999" |
| huge | dark | 320px | Number cut off: "$12,345,678,901.99" |
