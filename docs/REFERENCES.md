# Reference repositories

Cloned shallow on 2026-09-29, then removed from `references/` per master prompt.

| Repo | Commit | Licence | Reused in TrashBot |
|------|--------|---------|-------------------|
| Mjrovai/XIAO-ESP32S3-Sense | `770dfef0745c2ec4dc49dafe67b986bceafd07b2` | Apache-2.0 | Camera pin map and `esp_camera` QVGA JPEG setup (`firmware/lib/hw/camera.cpp`); PDM mic deferred to clap stub |
| vishalmysore/choturobo | `696264139006fd8f2c56ff6229d814ff6d47e795` | MIT | MCP tool layout patterns → `agent/` structure |
| ultrafro/garbagecollector | `b92487fb2dd58028e19306f8626f3edf65f74dec` | MIT | Verify/retry ideas → `firmware/lib/core/brain.cpp` |
| claireebear/HackGT-Trash-Robot- | `eb332ce514c9af5bb345d05bbc6001db8eb4f0d2` | MIT | TB6612 drive pattern → `firmware/lib/hw/motors.cpp` |
| dngvmnh/Trash_Collecting_Robot | `ebef3c06a57392652589208bbbc447262340d43b` | Apache-2.0 | Concurrent vision + obstacle concept; clone had LFS checkout failure — notes only |
| NVIDIA-Jetson/jetson-trashformers | `78c1f3de5eabb50d967aae2681474f09840646b6` | mixed | Pick-up trigger idea — notes only |
| pedropro/TACO | `29de1a9ba05a647b83a90f18d7772e20bb23d846` | MIT (code) | Annotation download → `tools/taco_subset.py` |
| ConeNDev/AI-Powered-Thrash-Can | `903c099516d3ba3d3fb6bee04454ccd3bf620d6b` | unclear | Notes → `docs/FUTURE_CATCH_MODE.md` |
| Sanjith1009/trash-catcher | `a6e70631c3cd631125859d36c1217e465d73853e` | unclear | Notes → `docs/FUTURE_CATCH_MODE.md` |
| Vedant28082005/esp32-mcp-server | `079471374c8c18af2292c3301beda0d4dda3b159` | unclear | HTTP→MCP mapping notes only |

Licence texts for adapted code: `third_party/<name>/LICENSE`.
