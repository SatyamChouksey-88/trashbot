from __future__ import annotations

import math
from pathlib import Path


def save_gif(frames, path: Path) -> None:
    import matplotlib.pyplot as plt
    from matplotlib import patches
    from matplotlib.animation import FuncAnimation, PillowWriter

    fig, ax = plt.subplots(figsize=(5, 4))

    def draw(i):
        ax.clear()
        ax.set_xlim(0, 4)
        ax.set_ylim(0, 3)
        ax.set_aspect("equal")
        x, y, th, balls = frames[i]
        ax.add_patch(patches.Rectangle((0, 0), 4, 3, fill=False, edgecolor="black"))
        ax.plot(x, y, "bo", markersize=8)
        ax.arrow(x, y, 0.15 * math.cos(th), 0.15 * math.sin(th), head_width=0.05, color="b")
        for b in balls:
            if not b.collected:
                ax.plot(b.x, b.y, "o", color="orange", markersize=6)

    anim = FuncAnimation(fig, draw, frames=len(frames), interval=80)
    path.parent.mkdir(parents=True, exist_ok=True)
    anim.save(path, writer=PillowWriter(fps=12))
    plt.close(fig)
