# TrashBot HTTP API

Base URL: `http://192.168.4.1` (AP) or `http://trashbot.local` (mDNS).  
Optional header: `X-TrashBot-Token` when `secrets.h` sets `API_TOKEN`.

## GET /api/status

```powershell
Invoke-RestMethod http://192.168.4.1/api/status
```

```bash
curl -s http://192.168.4.1/api/status
```

## GET /api/photo

Returns `image/jpeg` or 503 if the camera is unavailable.

## POST /api/mode

Body: `{"mode":"idle"|"manual"}` — auto is started only via `/api/clean`.

## POST /api/drive

Manual mode only. Body: `{"left":-100..100,"right":-100..100,"duration_ms":100..1000}`

## POST /api/move / POST /api/turn / POST /api/scoop

Idle or manual only (409 in auto). See master prompt Section 7 for field names.

## POST /api/clean

Body: `{"max_items":1..20,"max_time_s":10..600,"label":"optional"}`

## POST /api/stop / POST /api/estop / POST /api/estop/reset

Always allowed (except drive semantics).

## GET /api/log?since=<seq>

## GET /api/calib — POST /api/calib/<key>

Body: `{"value": number}` or `{"from":"current_target"|"current_distance"}`

Keys: `zone_xmin`, `zone_xmax`, `zone_ymin`, `servo_down`, `servo_carry`, `servo_tip`, `turn_dps`, `fwd_cps`, `self_echo_cm`, `max_duty`.
