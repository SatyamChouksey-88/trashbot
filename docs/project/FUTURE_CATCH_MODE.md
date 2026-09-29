# Future catch mode (not implemented)

TrashBot today collects trash on the floor. **Catch mode** would intercept gently tossed items before they land.

## Camera placement

Mount a fixed camera high above the thrower's spot, looking down. Each throw appears as a nearly straight line in the image (small perspective distortion for gentle lobs).

## Tracking pipeline

1. After 4–6 frames, fit the trajectory (start with a simple physics model: gravity + initial velocity).
2. Predict where the path crosses the bin's goal line.
3. Drive the bin along a taped floor line like a goalkeeper, limited to roughly 30–40 cm of lateral travel.
4. Log throws and add a learned correction on top of the physics fit over time.

## Limits

- Gentle lobs only; not mid-air snatching of fast throws.
- Requires a separate overhead camera and calibration — out of scope for the current XIAO-only robot.

## Research notes (read-only repos)

- HSV colour tracking and ballistic-fit ideas from community trash-can projects.
- Catcher-style robots note latency and bin travel constraints.
