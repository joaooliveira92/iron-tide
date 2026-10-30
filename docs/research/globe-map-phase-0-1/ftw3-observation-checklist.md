# Fleet the Waves 3 observation checklist

Status: **unverified**. No FTW3 measurement exists. This checklist lets a person who owns the game record observable facts without extracting its code, data, or assets. Do not copy FTW3 files. Screenshots taken by the player of their own game, for internal reference, are the only artefacts to keep, and should not be redistributed.

Record the display resolution, UI scale and window size for every observation.

| # | Observation | How to record | Value |
|---|---|---|---|
| 1 | World overview | Fully zoomed out: screenshot. Is the whole world visible? Is it a globe, a flat map or a mix? Note the visible latitude range. | |
| 2 | Minimum zoom | Is there a limit? What fraction of the map's width is the viewport? | |
| 3 | Maximum useful zoom | Zoom in until a port approach is just readable. Use the game's own scale bar or ruler: record nautical miles represented by 100 screen pixels. | |
| 4 | Smallest readable island | Name the smallest island/channel that is still legible, and at which zoom step. | |
| 5 | Zoom steps | Count wheel notches from minimum to maximum. Continuous or stepped? | |
| 6 | Zoom anchoring | Does the point under the pointer stay fixed while zooming? Does the keyboard zoom around the centre? | |
| 7 | Globe-to-plane behaviour | Is there any visible curvature at strategic zoom? Does it flatten? At roughly which zoom? Any visible pop? | |
| 8 | Markers | Do unit icons keep a constant screen size? When do they cluster or declutter? | |
| 9 | Labels | Which labels appear at which zoom? Are labels declutter-managed? | |
| 10 | Routes | Is a 5,000 nm route readable at world view? Are routes great-circle or straight on screen? | |
| 11 | Camera movement | Inertia, edge scrolling, rotation, tilt? | |
| 12 | Hidden objects | Can units behind the horizon (if a globe) be selected or searched? | |

Until this table is complete, Bluewave zoom targets are expressed only in implementation-neutral terms: metres per pixel and nautical miles per 100 px, with the current game at about 463 m/px (z~7.4) and the proposal at about 19 m/px (z~12) for tactical inspection.
