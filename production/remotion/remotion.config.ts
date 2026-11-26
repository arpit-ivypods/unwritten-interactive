// Defaults for `remotion studio` / `remotion render` in this project.
// production/scripts/render.sh passes the important flags explicitly as well.
import {Config} from '@remotion/cli/config';

Config.setVideoImageFormat('jpeg');
Config.setJpegQuality(95);
Config.setCodec('h264');
Config.setCrf(18);
Config.setPixelFormat('yuv420p');
Config.setOverwriteOutput(true);
