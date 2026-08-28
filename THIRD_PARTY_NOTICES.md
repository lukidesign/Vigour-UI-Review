# Third-party notices

Vigour UI Review is distributed under the MIT License. It also bundles or depends on third-party software under compatible open-source licenses.

Direct runtime dependencies include:

| Component | License |
| --- | --- |
| Vue, Pinia, Ant Design Vue, Fastify, Zod | MIT |
| NumPy | BSD-3-Clause and bundled component licenses |
| OpenCV Python | Apache License 2.0 |
| Pillow | MIT-CMU |
| PaddleOCR | Apache License 2.0 |
| PaddlePaddle | Apache License 2.0 |

This table is a convenience summary, not a replacement for the upstream license text. Exact resolved versions are recorded in `pnpm-lock.yaml` and `apps/vision-engine/uv.lock`. The offline release package includes Node.js and Python license texts, a generated JavaScript dependency/license inventory, and the license files shipped in Python wheel metadata for PaddleOCR, PaddlePaddle, OpenCV, and transitive dependencies.

Downstream redistributors are responsible for preserving all applicable notices and reviewing transitive dependency licenses for their distribution context.
