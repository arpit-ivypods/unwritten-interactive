#!/bin/zsh
cd <repo>/production/proof/probe-codex
date +%s > t_start.txt
codex exec --skip-git-repo-check -m gpt-6.1-sol -c model_reasoning_effort=low -C "$PWD" "Use your image generation tool to create a NEW vertical 9:16 photoreal cinematic frame of THE SAME woman as in the attached reference image (same face, hair, clothing), now standing at a rain-streaked bus stop at night, medium close-up, shallow depth of field, no text or logos. After generating, copy the final image into the current working directory as frame.png." -i ref.jpg < /dev/null > codex_out.txt 2>&1
date +%s > t_end.txt
