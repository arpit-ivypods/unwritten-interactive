# PlayerStage

The vertical 9:16 player and the deepest object on every screen. `uw-stage` on desktop (radius-stage, 6px bezel), `uw-stage--phone` on phones. Inside it: the artwork, `uw-stage-scrim`, a top block with one progress segment per episode shot group and the title/time row, and a bottom block for subtitles. Everything drawn over artwork is `on-stage` and must sit on the scrim. Only one stage is visible at a time. You provide the still or video and the subtitle line.
