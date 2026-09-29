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

## GET /api/health

Returns `{ "overall": "OK" | "DEGRADED" | "CRITICAL", "checks": [{ "name", "status", "value", "detail?" }] }`.

When `overall` is `CRITICAL`, `POST /api/clean` is blocked (see pre-flight below).

## GET /api/post

Boot self-test (POST) results: `{ "ok", "reset_reason", "checks": { ... } }`.

## GET /api/bringup — POST /api/bringup

Read or update motor invert/swap and camera flip flags (NVS).  
`POST /api/bringup/complete` (manual mode) sets `bringup_done`.

## POST /api/clean

Body: `{"max_items":1..20,"max_time_s":10..600,"label":"optional"}`

Pre-flight: returns **409** `{"error":"preflight_failed","failed":["bringup_required",...]}` if health is CRITICAL, bring-up is incomplete, minimum calibration is missing, or battery is low (when enabled).

`GET /api/status` includes `api_version: 2`, `bringup_done`, `post_ok`.

## POST /api/stop / POST /api/estop / POST /api/estop/reset

Always allowed (except drive semantics).

## GET /api/log?since=<seq>

Events may include `reason` and `reason_text`.

## Missions

- `GET /api/mission/current`
- `GET /api/mission/history?limit=20`

Mission ids: `TB-<boot_count>-<n>`.

## Profiles

Slots: `tile`, `carpet`, `custom`. `GET /api/profile`, `POST /api/profile`, `POST /api/profile/load`.

## GET /api/calib — POST /api/calib/<key>

Body: `{"value": number}` or `{"from":"current_target"|"current_distance"}`

Keys: `zone_xmin`, `zone_xmax`, `zone_ymin`, `servo_down`, `servo_carry`, `servo_tip`, `turn_dps`, `fwd_cps`, `self_echo_cm`, `max_duty`.
